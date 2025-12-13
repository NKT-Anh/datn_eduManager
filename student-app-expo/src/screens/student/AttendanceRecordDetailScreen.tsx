/**
 * Attendance Record Detail Screen - Modern UI
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Màu sắc
const COLORS = {
  primary: '#2563EB',
  background: '#F3F4F6',
  card: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  border: '#E5E7EB',
};

export default function AttendanceRecordDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const record: any = route?.params?.record;

  // Format Date
  const dateString = useMemo(() => {
    if (!record?.date) return '---';
    try {
      return new Date(record.date).toLocaleDateString('vi-VN', { 
        weekday: 'long', 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    } catch {
      return '---';
    }
  }, [record?.date]);

  // Helpers for Status
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'present':
        return { label: 'Có mặt', color: COLORS.success, icon: 'checkmark-circle' };
      case 'absent':
        return { label: 'Vắng mặt', color: COLORS.danger, icon: 'close-circle' };
      case 'late':
        return { label: 'Đi muộn', color: COLORS.warning, icon: 'time' };
      case 'excused':
        return { label: 'Có phép', color: COLORS.info, icon: 'document-text' };
      default:
        return { label: 'Không xác định', color: COLORS.textSecondary, icon: 'help-circle' };
    }
  };

  const statusInfo = useMemo(() => getStatusInfo(record?.status), [record?.status]);

  if (!record) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.emptyText}>Không tìm thấy dữ liệu</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonCenter}>
          <Text style={styles.backTextCenter}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* --- HEADER --- */}
      <View style={[styles.header, { paddingTop: insets.top + 10, height: 80 + insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết điểm danh</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* --- STATUS HERO CARD --- */}
        <View style={styles.statusCard}>
          <View style={[styles.iconCircle, { backgroundColor: statusInfo.color + '20' }]}>
            <Ionicons name={statusInfo.icon as any} size={40} color={statusInfo.color} />
          </View>
          <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
          <Text style={styles.dateLabel}>{dateString}</Text>
        </View>

        {/* --- DETAILS CARD --- */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Thông tin chi tiết</Text>
          
          <View style={styles.card}>
            {/* Subject */}
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name="book-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.label}>Môn học</Text>
                <Text style={styles.value}>{record?.subjectId?.name || '---'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Session / Period */}
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name="time-outline" size={20} color={COLORS.warning} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.label}>Thời gian</Text>
                <View style={styles.valueRow}>
                  {record?.session && (
                    <Text style={styles.value}>
                      Buổi {record.session === 'morning' ? 'Sáng' : 'Chiều'}
                    </Text>
                  )}
                  {record?.period && (
                    <Text style={styles.value}> • Tiết {record.period}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Notes (If any) */}
            {record?.notes ? (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <View style={styles.rowIcon}>
                    <Ionicons name="create-outline" size={20} color={COLORS.textSecondary} />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.label}>Ghi chú</Text>
                    <Text style={styles.noteText}>{record.notes}</Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* Help Text */}
        <Text style={styles.helpText}>
          Nếu có sai sót, vui lòng liên hệ Giảng viên hoặc Phòng đào tạo.
        </Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  
  // Header
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },

  scrollContent: {
    padding: 20,
  },

  // Status Hero Card
  statusCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },

  // Info Section
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  valueRow: {
    flexDirection: 'row',
  },
  noteText: {
    fontSize: 14,
    color: COLORS.text,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
    marginLeft: 48, // Indent to align with text
  },

  // Helper
  helpText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 20,
  },
  
  // Empty State
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginVertical: 12,
  },
  backButtonCenter: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  backTextCenter: {
    color: '#fff',
    fontWeight: 'bold',
  },
});