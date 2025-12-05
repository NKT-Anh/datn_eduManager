import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import Text from './Text';
import { colors, spacing } from '../../theme';

interface Props {
  title: string;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
}

const Button: React.FC<Props> = ({ title, onPress, style, disabled, loading, variant = 'primary' }) => {
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        isPrimary && styles.primary,
        isOutline && styles.outline,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : colors.primary} />
      ) : (
        <Text variant="title" style={[styles.text, !isPrimary && { color: colors.primary }]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.primary,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    color: '#fff',
  },
});

export default Button;
