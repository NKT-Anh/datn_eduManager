/**
 * Student Grades Screen - Modern UI
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { studentService } from '../../services/studentService';
import { Grade } from '../../types';

const { width } = Dimensions.get('window');

// Màu sắc
const COLORS = {
  primary: '#2563EB',
  background: '#F3F4F6',
  card: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  success: '#10B981', // Giỏi
  info: '#3B82F6',    // Khá
  warning: '#F59E0B', // TB
  danger: '#EF4444',  // Yếu
  border: '#E5E7EB',
};

export default function GradesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGrades();
  }, []);

  const loadGrades = async () => {
    try {
      setLoading(true);
      const data = await studentService.getGrades();
      setGrades(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải điểm số');
    } finally {
      setLoading(false);
    }
  };

  // Hàm xác định màu dựa trên điểm số
  const getScoreColor = (score?: number) => {
    if (score === undefined || score === null) return COLORS.textSecondary;
    if (score >= 8.0) return COLORS.success;
    if (score >= 6.5) return COLORS.info;
    if (score >= 5.0) return COLORS.warning;
    return COLORS.danger;
  };

  const renderScoreItem = (label: string, score?: number) => (
    <View style={styles.scoreItem}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={[styles.scoreValue, { color: getScoreColor(score) }]}>
        {score !== undefined && score !== null ? score.toFixed(1) : '-'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* --- HEADER CỐ ĐỊNH (KHÔNG BACK) --- */}
      <View style={[styles.header, { paddingTop: insets.top + 10, height: 80 + insets.top }]}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Bảng điểm</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : grades.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="school-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Chưa có dữ liệu điểm</Text>
          </View>
        ) : (
          grades.map((grade, index) => {
            const finalScore = grade.summary?.final;
            
            return (
              <TouchableOpacity
                key={grade._id || index}
                style={styles.gradeCard}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('GradeDetail', { grade })}
              >
                {/* Card Header: Môn + Học kỳ */}
                <View style={styles.cardHeader}>
                  <View style={styles.subjectContainer}>
                    <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="book" size={20} color={COLORS.primary} />
                    </View>
                    <View>
                      <Text style={styles.subjectName}>
                        {grade.subjectId?.name || 'Môn học'}
                      </Text>
                      <View style={styles.semesterBadge}>
                        <Text style={styles.semesterText}>
                          HK{grade.semester} • {grade.year}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Điểm Tổng Kết Nổi Bật */}
                  <View style={styles.finalScoreContainer}>
                    <Text style={styles.finalLabel}>Tổng kết</Text>
                    <Text style={[styles.finalValue, { color: getScoreColor(finalScore) }]}>
                      {finalScore !== undefined ? finalScore.toFixed(1) : '--'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Card Body: Điểm thành phần */}
                {grade.summary && (
                  <View style={styles.scoresGrid}>
                    {renderScoreItem('Miệng', grade.summary.mieng)}
                    {renderScoreItem('15 Phút', grade.summary['15phut'])}
                    {renderScoreItem('1 Tiết', grade.summary['1tiet'])}
                    {renderScoreItem('Thi', grade.summary.hocky)}
                  </View>
                )}
                
                <View style={styles.footer}>
                  <Text style={styles.detailsLink}>Xem chi tiết</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
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
    marginTop: 60,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textSecondary,
  },
  errorText: {
    marginTop: 10,
    color: COLORS.danger,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Căn giữa tiêu đề vì không có nút back
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
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },

  scrollContent: {
    padding: 16,
    paddingTop: 20,
  },

  // Grade Card
  gradeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subjectContainer: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  semesterBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  semesterText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  
  // Final Score
  finalScoreContainer: {
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  finalLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  finalValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },

  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },

  // Scores Grid
  scoresGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreItem: {
    alignItems: 'center',
    flex: 1,
  },
  scoreLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 15,
    fontWeight: '600',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  detailsLink: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginRight: 2,
  },
});