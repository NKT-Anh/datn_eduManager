/**
 * Student Notification Detail Screen
 */

import React, {useState} from 'react';
import {View, StyleSheet, TextInput} from 'react-native';
import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {colors, spacing} from '../../theme';
import {useRoute} from '@react-navigation/native';

const StudentNotificationDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const item = route.params?.item;
  const [reply, setReply] = useState('');

  const attachments = item?.attachments || [];

  return (
    <View style={styles.container}>
      <Card>
        <Text variant="title" style={{ marginBottom: spacing.sm }}>{item?.title}</Text>
        <View style={styles.metaRow}>
          <Text variant="caption" style={styles.tag}>Hệ thống</Text>
        </View>
        <Text variant="caption" muted style={{ marginTop: spacing.xs }}>
          {new Date(item?.createdAt).toLocaleString('vi-VN')}
        </Text>
        <Text variant="caption" muted style={{ marginTop: spacing.xs }}>
          Gửi đến: Toàn trường
        </Text>

        {!!attachments.length && (
          <View style={{ marginTop: spacing.md }}>
            <Text variant="title" style={{ marginBottom: spacing.xs }}>Tệp đính kèm ({attachments.length})</Text>
            {attachments.map((att: any, idx: number) => (
              <Card key={idx} style={styles.attachment} elevated={false}>
                <Text variant="body" style={{ color: colors.textPrimary }}>{att.name || 'Tệp đính kèm'}</Text>
                {!!att.size && (
                  <Text variant="caption" muted style={{ marginTop: spacing.xs }}>{att.size}</Text>
                )}
              </Card>
            ))}
          </View>
        )}

        {!!item?.content && (
          <Text style={{ marginTop: spacing.md }}>{item.content}</Text>
        )}
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="title" style={{ marginBottom: spacing.sm }}>Phản hồi</Text>
        <TextInput
          value={reply}
          onChangeText={setReply}
          placeholder="Viết phản hồi..."
          placeholderTextColor={colors.textSecondary}
          multiline
          style={styles.input}
        />
        <Button title="Gửi phản hồi" variant="outline" />
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    color: colors.primaryText,
  },
  attachment: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});

export default StudentNotificationDetailScreen;
