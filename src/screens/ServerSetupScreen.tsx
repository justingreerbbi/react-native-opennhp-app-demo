import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  AccessGraphic,
  Button,
  Card,
  Disclosure,
  Eyebrow,
  Field,
  H1,
  H2,
  Journey,
  Muted,
  Screen,
} from '../ui/components';
import { useServer } from '../ServerContext';
import { sanitizeServerConfig } from '../serverStore';
import type { SetupScreenProps } from '../navigation';

export default function ServerSetupScreen({
  navigation,
  route,
}: SetupScreenProps<'ServerSetup'>) {
  const { link } = useServer();
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [pubkey, setPubkey] = useState('');
  const [authServiceId, setAuthServiceId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [busy, setBusy] = useState(false);

  const scanned = route.params?.scanned;
  useEffect(() => {
    if (!scanned) {
      return;
    }
    if (scanned.host) {
      setHost(scanned.host);
    }
    if (scanned.port) {
      setPort(String(scanned.port));
    }
    setAuthServiceId(scanned.authServiceId ?? '');
    setResourceId(scanned.resourceId ?? '');
    if (scanned.pubkey) {
      setPubkey(scanned.pubkey);
    }
  }, [scanned]);

  const portNum = Number(port);
  const safeConfig = /^\d+$/.test(port.trim()) ? sanitizeServerConfig({
    host,
    port: portNum,
    pubkey,
    ...(authServiceId ? {authServiceId} : {}),
    ...(resourceId ? {resourceId} : {}),
  }) : null;
  const valid = safeConfig !== null;

  async function onLink() {
    if (!safeConfig) {
      Alert.alert(
        'Check server details',
        'Enter a host, a valid port, and a 44-character base64 server public key.',
      );
      return;
    }
    setBusy(true);
    try {
      // Once linked, the navigator switches to the dashboard on its own.
      await link(safeConfig);
    } catch (error) {
      setBusy(false);
      Alert.alert(
        'Could not link server',
        error instanceof Error ? error.message : 'Could not save server details. Try again.',
      );
    }
  }

  return (
    <Screen>
      <Journey step={1} />
      <Eyebrow>OPENNHP / SERVER SETUP</Eyebrow>
      <H1>Server setup</H1>
      <Muted>
        Scan a server QR code or enter the details provided by your server manager.
      </Muted>
      <AccessGraphic />
      <Button
        title="Scan Server QR Code"
        onPress={() => navigation.navigate('Scanner')}
        variant="secondary"
      />
      {valid ? (
        <Card>
          <Eyebrow>SERVER DETAILS</Eyebrow>
          <H2>{host}</H2>
          <Muted>Confirm the server details before linking.</Muted>
        </Card>
      ) : null}
      {valid ? (
        <Button
          title="Link Server"
          onPress={onLink}
          loading={busy}
        />
      ) : null}
      {scanned ? (
        <Muted>QR code scanned. Review the details and fill in any missing fields.</Muted>
      ) : null}
      <Disclosure key={JSON.stringify(scanned)} title="Edit Server Details" defaultOpen={!!scanned}>
        <Field
          label="Server host"
          value={host}
          onChangeText={setHost}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="nhp.example.com or 1.2.3.4"
        />
        <Field
          label="UDP port"
          value={port}
          onChangeText={setPort}
          keyboardType="number-pad"
          placeholder="Server UDP port"
        />
        <Field
          label="Server public key"
          value={pubkey}
          onChangeText={setPubkey}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          placeholder="base64 public key"
          hint="44-character base64 key provided by your server manager."
        />
        {authServiceId || resourceId ? (
          <Muted>Authentication service: {authServiceId}. Resource: {resourceId}.</Muted>
        ) : null}
      </Disclosure>
      <Disclosure title="About Server Linking">
        <Muted>
          Linking saves the server address and public key on this device.
          Register the device with the server before requesting access.
        </Muted>
      </Disclosure>
    </Screen>
  );
}
