import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, spacing } from './theme';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={font.h1}>
      {children}
    </Text>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      style={[font.h2, { marginBottom: spacing(1) }]}
    >
      {children}
    </Text>
  );
}

export function Muted({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[font.muted, style]}>{children}</Text>;
}

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: spacing(2) }}>
      <Text style={[font.label, { marginBottom: spacing(0.75) }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, props.style]}
      />
      {hint ? <Muted style={{ marginTop: spacing(0.75) }}>{hint}</Muted> : null}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const base =
    variant === 'secondary'
      ? styles.btnSecondary
      : variant === 'danger'
      ? styles.btnDanger
      : styles.btnPrimary;
  const textStyle =
    variant === 'secondary'
      ? styles.btnSecondaryText
      : variant === 'danger'
      ? { color: colors.danger }
      : styles.btnPrimaryText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityLabel={title}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        base,
        isDisabled && styles.btnDisabled,
        pressed && !isDisabled && styles.btnPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' ? colors.primary : colors.onPrimary}
        />
      ) : (
        <Text
          style={[
            styles.btnText,
            textStyle,
            isDisabled && styles.btnDisabledText,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function KeyText({ value }: { value: string }) {
  return (
    <View style={styles.keyBox}>
      <Text selectable style={font.mono}>
        {value}
      </Text>
    </View>
  );
}

export function StatusNote({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'success' | 'danger';
}) {
  const toneStyle =
    tone === 'success'
      ? styles.noteSuccess
      : tone === 'danger'
      ? styles.noteDanger
      : styles.noteMuted;
  return (
    <View style={[styles.note, toneStyle]}>
      <Text style={font.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    padding: spacing(3),
    paddingTop: spacing(1),
    paddingBottom: spacing(5),
    gap: spacing(2.5),
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing(2.5),
    gap: spacing(1.5),
  },
  input: {
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.75),
    paddingVertical: Platform.OS === 'ios' ? spacing(1.75) : spacing(1.25),
    fontSize: 16,
    color: colors.text,
  },
  btn: {
    borderRadius: radius.sm,
    minHeight: 56,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.9),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDanger: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  btnDisabled: {
    backgroundColor: colors.primaryDisabled,
    borderColor: colors.primaryDisabled,
  },
  btnPressed: { opacity: 0.85 },
  btnText: { fontSize: 16, fontWeight: '700' },
  btnPrimaryText: { color: colors.onPrimary },
  btnSecondaryText: { color: colors.primary },
  btnDisabledText: { color: colors.text },
  keyBox: {
    backgroundColor: colors.field,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
  },
  note: { borderRadius: radius.sm, padding: spacing(1.75) },
  noteMuted: {
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteSuccess: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#bfe0d2',
  },
  noteDanger: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: '#f3c7c2',
  },
});

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={extra.eyebrow}>{children}</Text>;
}

export function Journey({ step }: { step: number }) {
  return (
    <View
      accessibilityLabel={`Step ${step} of 3: Link, Register, Access`}
      style={extra.journey}
    >
      {['Link', 'Register', 'Access'].map((label, index) => (
        <View key={label} style={extra.step}>
          <View style={[extra.track, index < step && extra.activeTrack]} />
          <Text
            style={[extra.stepLabel, index === step - 1 && extra.activeLabel]}
          >
            {index + 1} {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function AccessGraphic({ ready = false }: { ready?: boolean }) {
  return (
    <View
      style={extra.graphic}
      accessible
      accessibilityLabel={ready ? 'Device registered' : 'Registration required'}
    >
      <View style={extra.orbit}>
        <View style={extra.innerOrbit}>
          <View style={extra.lockLoop} />
          <View style={extra.lockBody}>
            <Text style={extra.lockMark}>{ready ? '✓' : '•'}</Text>
          </View>
        </View>
      </View>
      <View style={extra.graphicBadge}>
        <Text style={extra.badgeText}>
          {ready ? 'Device registered' : 'Registration required'}
        </Text>
      </View>
    </View>
  );
}

export function Disclosure({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={extra.disclosure}
      >
        <Text style={font.label}>{title}</Text>
        <Text style={extra.plus}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? children : null}
    </Card>
  );
}

export function InfoRow({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <View style={extra.infoRow}>
      <View style={extra.number}>
        <Text style={font.label}>{number}</Text>
      </View>
      <View style={extra.infoCopy}>
        <Text style={font.label}>{title}</Text>
        <Muted>{body}</Muted>
      </View>
    </View>
  );
}

const extra = StyleSheet.create({
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.muted,
  },
  journey: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  step: { flex: 1, gap: 8 },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.border },
  activeTrack: { backgroundColor: colors.success },
  stepLabel: { fontSize: 12, color: colors.muted },
  activeLabel: { color: colors.text, fontWeight: '600' },
  graphic: {
    height: 182,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  orbit: {
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 1,
    borderColor: '#D1DDC9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerOrbit: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockLoop: {
    width: 30,
    height: 30,
    borderWidth: 3,
    borderColor: colors.text,
    borderRadius: 15,
    marginBottom: -10,
  },
  lockBody: {
    width: 46,
    height: 35,
    borderRadius: 10,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockMark: { color: colors.accent, fontSize: 22, fontWeight: '600' },
  graphicBadge: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: { fontSize: 12, color: colors.success, fontWeight: '600' },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  plus: { fontSize: 23, color: colors.muted },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  number: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: { flex: 1, gap: 4 },
});
