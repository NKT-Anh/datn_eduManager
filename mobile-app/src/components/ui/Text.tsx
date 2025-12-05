import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { colors, type as typeScale } from '../../theme';

type Variant = keyof typeof typeScale;

interface Props extends TextProps {
  variant?: Variant;
  muted?: boolean;
}

const Text: React.FC<Props> = ({ variant = 'body', muted = false, style, children, ...rest }) => {
  return (
    <RNText
      {...rest}
      style={[
        styles.base,
        styles[variant],
        { color: muted ? colors.textSecondary : colors.textPrimary },
        style,
      ]}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  base: {
    color: colors.textPrimary,
  },
  h1: { ...typeScale.h1 },
  h2: { ...typeScale.h2 },
  h3: { ...typeScale.h3 },
  title: { ...typeScale.title },
  body: { ...typeScale.body },
  caption: { ...typeScale.caption },
});

export default Text;
