/**
 * Student Dashboard Screen
 */

import React from 'react';
import {StyleSheet, ScrollView, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {colors, spacing} from '../../theme';
import {useAuth} from '../../context/AuthContext';

const StudentDashboardScreen: React.FC = () => {
  const {user} = useAuth();
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h1" style={styles.pageTitle}>Trang chủ</Text>
      <Card style={styles.welcomeCard}>
        <Text variant="h2" style={{marginBottom: spacing.sm}}>Xin chào 👋</Text>
        <Text variant="title" muted>
          {user?.name || 'Học sinh'}
        </Text>
      </Card>
      <View style={styles.quickActions}>
        <Button title="Lịch học" variant="outline" style={styles.actionBtn} onPress={() => (navigation as any).navigate('StudentSchedule')} />
        <Button title="Điểm số" variant="outline" style={styles.actionBtn} onPress={() => (navigation as any).navigate('StudentGrades')} />
        <Button title="Lịch thi" variant="outline" style={styles.actionBtn} onPress={() => (navigation as any).navigate('StudentExams')} />
      </View>

      <View style={[styles.quickActions, { marginTop: spacing.md }]}>
        <Button title="Thông báo" variant="outline" style={styles.actionBtn} onPress={() => (navigation as any).navigate('StudentNotifications')} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
  },
  pageTitle: {
    marginBottom: spacing.lg,
  },
  welcomeCard: {
    marginBottom: spacing.xl,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
});

export default StudentDashboardScreen;

