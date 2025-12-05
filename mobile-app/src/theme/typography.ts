export const type = {
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: '700' as const },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
};

export type TypeKeys = keyof typeof type;
