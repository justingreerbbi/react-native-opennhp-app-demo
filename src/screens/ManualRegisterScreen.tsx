import React, {useEffect, useState} from 'react';
import {Clipboard} from 'react-native';
import {devicePublicKey} from '../agent';
import {useServer} from '../ServerContext';
import {Button, Card, Eyebrow, H1, H2, InfoRow, Journey, KeyText, Muted, Screen, StatusNote} from '../ui/components';
import type {AppScreenProps} from '../navigation';

export default function ManualRegisterScreen({navigation}: AppScreenProps<'ManualRegister'>) {
  const {config} = useServer();
  const [publicKey, setPublicKey] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Generate/load and display a PUBLIC key for out-of-band administration.
  // This screen sends no registration request, saves no receipt, and does not
  // poll the server; dashboard access still depends on the OTP receipt flow.
  useEffect(() => {
    let active = true;
    devicePublicKey().then(key => {
      if (!key) {
        throw new Error('No device key is available. Go back and try again.');
      }
      if (active) {
        setPublicKey(key);
      }
    }).catch(reason => {
      if (active) {
        setError(reason instanceof Error ? reason.message : 'Could not load the device key.');
      }
    });
    return () => {active = false;};
  }, []);

  function copyKey() {
    if (!publicKey) {
      return;
    }
    try {
      Clipboard.setString(publicKey);
      setCopied(true);
      setError('');
    } catch {
      setError('Could not copy the key. Press and hold the key to copy it manually.');
    }
  }

  return (
    <Screen>
      <Journey step={2} />
      <Eyebrow>MANUAL REGISTRATION</Eyebrow>
      <H1>Manual registration</H1>
      <Muted>Ask your server manager to register this device for {config?.host || 'your server'}.</Muted>
      <Card>
        <H2>Device Key</H2>
        <Muted>Provide this key to your server manager to register the device.</Muted>
        <KeyText value={publicKey || 'Loading…'} />
        <Button title={copied ? 'Device Key Copied' : 'Copy Device Key'} onPress={copyKey} disabled={!publicKey} />
        {copied ? <StatusNote tone="success">Device key copied to clipboard.</StatusNote> : null}
      </Card>
      {error ? <StatusNote tone="danger">{error}</StatusNote> : null}
      <Card>
        <InfoRow number="1" title="Copy your device key" body="Use the button above to copy the complete device key." />
        <InfoRow number="2" title="Send it to your server manager" body="Ask them to add this key to the server’s trusted devices and grant access to the protected resource." />
        <InfoRow number="3" title="Wait for confirmation" body="Your server manager must complete registration on the server. Copying this key does not register your device." />
      </Card>
      <Button title="Back To Server" variant="secondary" onPress={() => navigation.goBack()} />
      <Button title="Register With OTP" variant="secondary" onPress={() => navigation.navigate('RegisterEmail')} />
    </Screen>
  );
}
