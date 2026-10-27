# panic: send on closed channel — `UdpAgent.Stop()` closes the device send queue before its sender goroutine exits

## Summary

`UdpAgent.Stop()` calls `a.device.Stop()` (which closes `Device.msgToPacketQueue`) **before** it waits for the agent's own goroutines with `a.wg.Wait()`. The agent's `sendMessageRoutine` is tracked by `a.wg`, not the device's wait group, so it can still be running when that queue is closed. If it sends one more message during that window, `Device.SendMsgToPacket` does `d.msgToPacketQueue <- md` on a closed channel, which panics. The panic is unrecovered, so the whole process aborts (`SIGABRT`). In an embedded build (the mobile SDK via gomobile/cgo) this takes down the host app.

## Affected versions

- `main` (reproduced at commit `9c4ff38`), nhp module `v0.6.0`.
- `v1.0.2` — `UdpAgent.Stop()` is byte-identical, so the same race is present. This is not a recent regression.

## Environment

- OpenNHP `endpoints/agent` + `nhp/core`, built as a c-shared / gomobile library.
- Observed on iOS (React Native binding, iPhone 16 simulator, iOS 18.6), but the faulting code is platform-independent Go in the agent/core; any host that stops an agent shortly after a send is affected.
- Go 1.27.3.

## Impact

Crash (whole-process abort). Reproducible on essentially every OTP registration request from a fresh install, because that path starts a short-lived agent, sends, then stops it immediately (see repro).

## Steps to reproduce

Conceptually: start a `UdpAgent`, enqueue at least one outbound message, then call `Stop()` while that message is still being processed by `sendMessageRoutine`.

Concrete path that hits it reliably (device registration / OTP):

1. Start an agent (no running instance yet), e.g. via the OTP request flow with no key stored, which spins up a throwaway `UdpAgent`.
2. Send a message (the NHP-OTP request): `UdpAgent.RequestOtp` → enqueues to `a.sendMsgCh` → `sendMessageRoutine` calls `a.device.SendMsgToPacket`.
3. Immediately `Stop()` that agent (the OTP helper tears the throwaway agent down right after sending).

The send in step 2 races the queue close in step 3.

## Actual result

```
panic: send on closed channel

goroutine 27 [running]:
github.com/OpenNHP/opennhp/nhp/core.(*Device).SendMsgToPacket(...)
	nhp@v0.6.0/core/device.go:585
github.com/OpenNHP/opennhp/endpoints/agent.(*UdpAgent).sendMessageRoutine(0x...)
	endpoints/agent/udpagent.go:766 +0x3d0
created by github.com/OpenNHP/opennhp/endpoints/agent.(*UdpAgent).Start in goroutine 82
	endpoints/agent/udpagent.go:461 +0x85c
```

Process aborts with `SIGABRT` (Abort trap: 6).

## Expected result

Stopping an agent after a send completes cleanly, with no panic.

## Root cause

`endpoints/agent/udpagent.go`, `Stop()` (line 538):

```go
func (a *UdpAgent) Stop() {
	a.running.Store(false)
	a.stopKnockLoop()
	close(a.signals.stop)
	a.device.Stop()   // line 542: closes Device.msgToPacketQueue
	a.StopConfigWatch()
	a.wg.Wait()       // line 544: only now waits for sendMessageRoutine
	close(a.sendMsgCh)
	...
}
```

`nhp/core/device.go`, `Device.Stop()` (line 239):

```go
func (d *Device) Stop() {
	close(d.signals.stop)
	d.wg.Wait()                  // waits for DEVICE routines only
	close(d.msgToPacketQueue)    // line 242
	close(d.packetToMsgQueue)
	close(d.DecryptedMsgQueue)
}
```

`Device.Stop()`'s `d.wg.Wait()` waits only for the device's own goroutines. It does **not** wait for the agent's `sendMessageRoutine` (started at `udpagent.go:461`, tracked by `a.wg`). So `close(d.msgToPacketQueue)` runs while `sendMessageRoutine` may still be alive and about to call, at `udpagent.go:766`:

```go
a.device.SendMsgToPacket(md)
```

which in `nhp/core/device.go:583` sends on the now-closed channel:

```go
func (d *Device) SendMsgToPacket(md *MsgData) {
	select {
	case d.msgToPacketQueue <- md:   // line 585: panics if the channel is closed
	default:
		log.Critical("msgToPacketQueue is full, discarding message")
	}
}
```

A `select` send does not avoid the panic: sending on a closed channel panics regardless of `default`.

## Suggested fix

Either of these resolves it; the first is the smallest and lowest risk:

1. Make `Device.SendMsgToPacket` safe during shutdown — guard the send so a close race becomes a drop instead of a panic (e.g. recover around the send, or select on a `d.signals.stop` / closed flag before sending):

   ```go
   func (d *Device) SendMsgToPacket(md *MsgData) {
       defer func() { _ = recover() }() // queue closed during Stop(): drop, don't crash
       select {
       case d.msgToPacketQueue <- md:
       default:
           log.Critical("msgToPacketQueue is full, discarding message")
       }
   }
   ```

2. In `UdpAgent.Stop()`, ensure the agent's sender goroutine has exited before the device closes its queues (stop/drain `sendMessageRoutine` before `a.device.Stop()`), so nothing sends after `msgToPacketQueue` is closed. This needs care so `recvMessageRoutine`, which reads device queues, does not deadlock.

## Notes

The comment already in `UdpAgent.Stop()` about `knockTargetMapUpdated` shows this class of shutdown send-on-closed-channel race has been handled case by case elsewhere; this is the same class of bug on the `msgToPacketQueue` path.
