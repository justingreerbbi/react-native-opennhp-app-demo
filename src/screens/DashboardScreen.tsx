import React, { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  AccessGraphic,
  Disclosure,
  Eyebrow,
  InfoRow,
  Journey,
  Button,
  Card,
  H1,
  H2,
  KeyText,
  Muted,
  Screen,
  StatusNote,
} from '../ui/components';
import { colors, font } from '../ui/theme';
import { useServer } from '../ServerContext';
import { ASP_ID, RES_ID, siteUrl } from '../connection';
import {
  devicePublicKey,
  knockWeb,
  prepareWorkspace,
  registrationIsCurrent,
} from '../agent';
import type { AppScreenProps } from '../navigation';

function shortKey(key: string): string {
  return key.length > 18 ? `${key.slice(0, 10)}...${key.slice(-6)}` : key;
}

export default function DashboardScreen({
  navigation,
}: AppScreenProps<'Dashboard'>) {
  const { config, unlink } = useServer();
  const [deviceId, setDeviceId] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading...');
  const [knocking, setKnocking] = useState(false);
  const [tone, setTone] = useState<'muted' | 'success' | 'danger'>('muted');
  const [ready, setReady] = useState(false);

  // Re-read the enrollment receipt when returning from registration. This is
  // a local readiness check; only the subsequent knock asks the server for access.
  const refresh = useCallback(async () => {
    setReady(false);
    setTone('muted');
    try {
      const ws = await prepareWorkspace();
      setDeviceId(ws.deviceId);
      if (ws.registration && registrationIsCurrent(ws.registration.expiresAt)) {
        setRegisteredEmail(ws.registration.email);
        setStatus('');
      } else {
        setRegisteredEmail(null);
        setStatus('');
      }
      setPublicKey(await devicePublicKey());
    } catch (error) {
      setTone('danger');
      setStatus(
        error instanceof Error ? error.message : 'Could not prepare the agent.',
      );
    } finally {
      setReady(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // One user action -> one native knock -> browser launch on explicit success.
  // No loop, expiry timer, API request, or background renewal is started here.
  async function onKnock() {
    if (!registeredEmail || !config) {
      return;
    }
    setKnocking(true);
    setTone('muted');
    setStatus('Requesting access…');
    try {
      const ack = await knockWeb(registeredEmail, deviceId);
      if (String(ack.errCode) === '0') {
        setTone('success');
        setStatus('Access granted. Opening site…');
        // Demo destination ignores ACK resHost/redirectUrl/opnTime. NHP grants
        // network access; this separate browser connection carries website traffic.
        await Linking.openURL(siteUrl(config.host));
      } else {
        setTone('danger');
        setStatus(`Access request failed: ${ack.errMsg || ack.errCode}`);
      }
    } catch (error) {
      setTone('danger');
      setStatus(error instanceof Error ? error.message : 'Access request failed.');
    } finally {
      setKnocking(false);
    }
  }

  function onUnlink() {
    Alert.alert(
      'Unlink Server',
      'This removes the server and this device’s registration. You can then link a new server. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: () => {
            unlink().catch(error =>
              Alert.alert(
                'Could not unlink',
                error instanceof Error ? error.message : 'Try again.',
              ),
            );
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Eyebrow>OPENNHP / ACCESS</Eyebrow>
      <H1>
        {registeredEmail
          ? 'Resource access'
          : 'Device registration'}
      </H1>
      <Muted>
        {registeredEmail
          ? 'Send an access request to the server. The site opens if access is granted.'
          : 'The server is linked. Choose a registration method for this device.'}
      </Muted>
      <Journey step={registeredEmail ? 3 : 2} />
      <Card style={{ backgroundColor: colors.accentSoft }}>
        <View style={styles.cardHeader}>
          <Eyebrow>PROTECTED SITE</Eyebrow>
          <Text style={styles.badge}>
            {registeredEmail ? '● Registered' : '○ Not registered'}
          </Text>
        </View>
        <Text style={font.h2}>{config?.host || 'Your server'}</Text>
        <AccessGraphic ready={!!registeredEmail} />
        <Muted>
          {registeredEmail || 'Register with an email code, or share your device key with the server manager.'}
        </Muted>
        <Button
          title={
            registeredEmail ? 'Request Access & Open Site' : 'Register With OTP'
          }
          onPress={
            registeredEmail
              ? onKnock
              : () => navigation.navigate('RegisterEmail')
          }
          loading={knocking || !ready}
          disabled={!ready}
        />
        {!registeredEmail ? (
          <Button
            title="Manual Registration"
            variant="secondary"
            onPress={() => navigation.navigate('ManualRegister')}
            disabled={!ready || !publicKey}
          />
        ) : null}
      </Card>
      {status ? <StatusNote tone={tone}>{status}</StatusNote> : null}
      <Disclosure title="Access Process">
        <InfoRow
          number="1"
          title="Link a server"
          body="Save the server address and public key provided by your server manager."
        />
        <InfoRow
          number="2"
          title="Register this device"
          body="Register using an email verification code, or ask your server manager to register the device key."
        />
        <InfoRow
          number="3"
          title="Request access"
          body="Send an authenticated request. When the server grants access, the site opens in your browser."
        />
      </Disclosure>
      <Disclosure title="Server & Device Details">
        <H2>Server</H2>
        <Muted>
          {config?.host} · UDP {config?.port}
        </Muted>
        <Muted>
          Provider {config?.authServiceId ?? ASP_ID} · Resource {config?.resourceId ?? RES_ID}
        </Muted>
        <Muted>Server key {shortKey(config?.pubkey || '')}</Muted>
        <H2>This device</H2>
        <Muted>{deviceId || 'Loading…'}</Muted>
        <Muted>
          Device key · Share with your server manager for manual
          registration.
        </Muted>
        <KeyText value={publicKey || 'Loading…'} />
        {registeredEmail ? (
          <Button
            title="Register Again"
            variant="secondary"
            onPress={() => navigation.navigate('RegisterEmail')}
          />
        ) : null}
        <Button title="Unlink Server" variant="danger" onPress={onUnlink} />
      </Disclosure>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  badge: { fontSize: 12, color: colors.success },
});
