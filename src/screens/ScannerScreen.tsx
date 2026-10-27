import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { Button, Card, Eyebrow, H1, H2, KeyText, Muted, Screen } from '../ui/components';
import { colors, radius, spacing } from '../ui/theme';
import ReviewModal from '../ui/ReviewModal';
import type { ServerConfig } from '../serverStore';
import { parseServerPayload } from '../serverStore';
import type { SetupScreenProps } from '../navigation';

export default function ScannerScreen({
  navigation,
}: SetupScreenProps<'Scanner'>) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const handled = useRef(false);
  const [pending, setPending] = useState<Partial<ServerConfig> | null>(null);
  const isFocused = useIsFocused();
  const [message, setMessage] = useState('Point at the server QR code');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (!hasPermission && !requested) {
      setRequested(true);
      requestPermission().catch(() => {
        setCameraError('Camera permission could not be requested. Open Settings to allow camera access.');
      });
    }
  }, [hasPermission, requested, requestPermission]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (handled.current) {
        return;
      }
      if (!isFocused) {
        return;
      }
      let detectedValue = false;
      for (const code of codes) {
        if (!code.value) {
          continue;
        }
        detectedValue = true;
        const parsed = parseServerPayload(code.value);
        if (parsed) {
          handled.current = true;
          setPending(parsed);
          return;
        }
      }
      if (detectedValue) {
        setMessage('QR code detected, but it is not a supported server code. Check schemaVersion (1), host, port, serverPublicKey, authServiceId, and resourceId.');
      }
    },
  });

  function cancelReview() {
    setPending(null);
    handled.current = false;
    setMessage('Point at the server QR code');
  }

  function confirmReview() {
    if (pending) {
      navigation.popTo('ServerSetup', { scanned: pending });
    }
  }

  // No camera (the iOS simulator has none) or permission not granted.
  if (!device || !hasPermission) {
    return (
      <Screen>
        <Eyebrow>SERVER QR CODE</Eyebrow>
        <H1>{!device ? 'Camera unavailable' : 'Camera permission needed'}</H1>
        <Card>
          {cameraError ? <Muted>{cameraError}</Muted> : null}
          <Muted>
            {!device
              ? 'No camera was found on this device. Enter the server details manually.'
              : 'Allow camera access in Settings to scan a server QR code, or enter the details manually.'}
          </Muted>
          {device && !hasPermission ? (
            <Button
              title="Open Settings"
              variant="secondary"
              onPress={() => Linking.openSettings()}
            />
          ) : null}
          <Button
            title="Enter Details Manually"
            onPress={() => navigation.goBack()}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <View style={styles.full}>
      {pending ? (
        <ReviewModal visible onClose={cancelReview}>
          <Eyebrow>SERVER QR CODE</Eyebrow>
          <H2>Review server details</H2>
          <Muted>Verify the server address and public key with your server manager before accepting these details.</Muted>
          <Card>
            <Eyebrow>SERVER</Eyebrow>
            <H2>{pending.host || 'Host not included'}</H2>
            <Muted>UDP port: {pending.port ?? 'Not included'}</Muted>
            <Muted>Authentication service: {pending.authServiceId ?? 'Not included'}</Muted>
            <Muted>Resource: {pending.resourceId ?? 'Not included'}</Muted>
            <Eyebrow>SERVER PUBLIC KEY</Eyebrow>
            <KeyText value={pending.pubkey || ''} />
          </Card>
          <Button title="Use These Details" onPress={confirmReview} />
          <Button title="Scan Again" variant="secondary" onPress={cancelReview} />
        </ReviewModal>
      ) : null}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused && !cameraError && !pending}
        codeScanner={codeScanner}
        onError={error => setCameraError(`Camera error (${error.code}): ${error.message}`)}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.hint}>{cameraError || message}</Text>
      </View>
      <View style={styles.cancel}>
        <Button
          title="Cancel"
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: '#000' },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  hint: {
    color: '#ffffff',
    marginTop: spacing(2),
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: spacing(3),
  },
  cancel: {
    position: 'absolute',
    left: spacing(2.5),
    right: spacing(2.5),
    bottom: spacing(5),
  },
});
