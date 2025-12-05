import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { colors, spacing } from '../../theme';

interface Props extends ViewProps {
  elevated?: boolean;
}

const Card: React.FC<Props> = ({ elevated = true, style, children, ...rest }) => {
  return (
    <View {...rest} style={[styles.card, elevated && styles.elevated, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});

export default Card;
