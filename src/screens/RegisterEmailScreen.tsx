import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  Button,
  Card,
  Disclosure,
  Eyebrow,
  Field,
  H1,
  Journey,
  Muted,
  Screen,
  StatusNote,
} from '../ui/components';
import { currentDeviceId, requestCode } from '../agent';
import type { AppScreenProps } from '../navigation';

export default function RegisterEmailScreen({
  navigation,
}: AppScreenProps<'RegisterEmail'>) {
  const [email, setEmail] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [deviceError, setDeviceError] = useState('');

  useEffect(() => {
    currentDeviceId()
      .then(setDeviceId)
      .catch(() =>
        setDeviceError('Could not prepare this device. Go back and try again.'),
      );
  }, []);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // NHP-OTP stage only. Navigation carries email, not a private key or OTP;
  // the user enters the delivered code on the next screen.
  async function onSend() {
    if (!emailValid || !deviceId) {
      Alert.alert(
        'Enter a valid email',
        'The 6-digit code is sent to this address.',
      );
      return;
    }
    setBusy(true);
    try {
      const result = await requestCode(email.trim(), deviceId);
      setBusy(false);
      if (result.errCode === '0') {
        navigation.navigate('EnterCode', { email: email.trim() });
      } else {
        Alert.alert(
          'Could not send code',
          result.errMsg || `Error ${result.errCode}`,
        );
      }
    } catch (error) {
      setBusy(false);
      Alert.alert(
        'Could not send code',
        error instanceof Error ? error.message : 'Could not request a verification code. Try again.',
      );
    }
  }

  return (
    <Screen>
      <Journey step={2} />
      <Eyebrow>DEVICE REGISTRATION</Eyebrow>
      <H1>Email registration</H1>
      <Muted>
        Enter your email address to request a 6-digit verification code for device registration.
      </Muted>
      {deviceError ? (
        <StatusNote tone="danger">{deviceError}</StatusNote>
      ) : null}
      <Card>
        <Field
          label="Email address"
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <Button
          title="Send Code"
          onPress={onSend}
          loading={busy}
          disabled={!emailValid || !deviceId}
        />
      </Card>
      <Disclosure title="About Device Registration">
        <Muted>
          Registration links your email to the device key. The server
          uses this registration to verify access requests.
        </Muted>
        <Muted>
          For local testing, the verification code is also available in the server
          log.
        </Muted>
      </Disclosure>
    </Screen>
  );
}
