import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import {
  Button,
  Card,
  Eyebrow,
  Field,
  H1,
  Journey,
  Muted,
  Screen,
  StatusNote,
} from '../ui/components';
import { currentDeviceId, submitRegistration } from '../agent';
import type { AppScreenProps } from '../navigation';

export default function EnterCodeScreen({
  navigation,
  route,
}: AppScreenProps<'EnterCode'>) {
  const { email } = route.params;
  const [code, setCode] = useState('');
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

  const codeValid = /^\d{6}$/.test(code.trim());

  // NHP-REG stage. submitRegistration persists the enrollment receipt only
  // after server success; dashboard focus reloads it. No resource knock here.
  async function onRegister() {
    if (!codeValid || !deviceId) {
      Alert.alert(
        'Enter the 6-digit code',
        'Check the code from your email or the server log.',
      );
      return;
    }
    setBusy(true);
    try {
      const result = await submitRegistration(email, deviceId, code.trim());
      setBusy(false);
      if (result.errCode === '0') {
        navigation.navigate('Dashboard');
      } else {
        Alert.alert(
          'Registration failed',
          result.errMsg || `Error ${result.errCode}`,
        );
      }
    } catch (error) {
      setBusy(false);
      Alert.alert(
        'Registration failed',
        error instanceof Error ? error.message : 'Could not complete registration. Try again.',
      );
    }
  }

  return (
    <Screen>
      <Journey step={2} />
      <Eyebrow>EMAIL VERIFICATION</Eyebrow>
      <H1>Enter verification code</H1>
      <Muted>Enter the 6-digit code sent to {email}.</Muted>
      {deviceError ? (
        <StatusNote tone="danger">{deviceError}</StatusNote>
      ) : null}
      <Card>
        <Field
          label="6-digit code"
          value={code}
          onChangeText={value => setCode(value.replace(/\D/g, ''))}
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          style={styles.code}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
        />
        <Button
          title="Verify & Register Device"
          onPress={onRegister}
          loading={busy}
          disabled={!codeValid || !deviceId}
        />
      </Card>
      <Muted>
        If the code has not arrived, check your spam folder. For local testing, check
        the server log.
      </Muted>
      <Button
        title="Use A Different Email Or Request A New Code"
        variant="secondary"
        onPress={() => navigation.goBack()}
        disabled={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 28, letterSpacing: 8, textAlign: 'center' },
});
