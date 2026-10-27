export const colors = {
  bg: '#F3F4F1',
  card: '#ffffff',
  text: '#20231F',
  muted: '#73796F',
  primary: '#20231F',
  accent: '#B2DDA3',
  accentSoft: '#E9F1E3',
  primaryDisabled: '#C3CEBC',
  onPrimary: '#ffffff',
  border: '#E4E7DF',
  field: '#F4F5F1',
  danger: '#b3261e',
  dangerBg: '#fdecea',
  success: '#456637',
  codeBg: '#20231F',
};

export const spacing = (n: number) => n * 8;

export const radius = { sm: 16, md: 26, lg: 32 };

export const font = {
  h1: {
    fontSize: 34,
    letterSpacing: -1.2,
    lineHeight: 40,
    fontWeight: '600' as const,
    color: colors.text,
  },
  h2: {
    fontSize: 20,
    letterSpacing: -0.4,
    fontWeight: '600' as const,
    color: colors.text,
  },
  label: { fontSize: 13, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  mono: {
    fontSize: 13,
    color: colors.text,
    fontFamily: 'Menlo',
  },
};
