import React from 'react';
import {TouchableOpacity, StyleSheet, ViewStyle} from 'react-native';
import {colors, spacing} from '../../theme';
import Text from './Text';

interface Props {
  title?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

const FloatingAction: React.FC<Props> = ({ title = 'Gửi', onPress, style }) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.fab, style]}>
      <Text variant="title" style={{ color: '#fff' }}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    height: 52,
    minWidth: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});

export default FloatingAction;
