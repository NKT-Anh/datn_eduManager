/**
 * Student Grade Detail Screen - Modern UI
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
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
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  border: '#E5E7EB',
};

const TYPE_LABELS: Record<string, string> = {
  mieng: 'Kiểm tra Miệng',
  '15phut': 'Kiểm tra 15 phút',
  '1tiet': 'Kiểm tra 1 tiết',
  hocky: 'Thi Học kỳ',
};

// Hàm xác định màu dựa trên điểm số
const getScoreColor = (score: number) => {
  if (score >= 8.0) return COLORS.success;
  if (score >= 6.5) return COLORS.info;
  if (score >= 5.0) return COLORS.warning;
  return COLORS.danger;
};

export default function GradeDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const grade: any = route?.params?.grade;

  const title = useMemo(() => grade?.subjectId?.name || 'Chi tiết điểm', [grade?.subjectId?.name]);
  
  const semesterLabel = useMemo(() => {
    if (!grade) return '';
    const y = grade.year || grade.schoolYear || '';
    const sem = grade.semester || '';
    return y && sem ? `HK${sem} • ${y}` : '';
  }, [grade]);

  // Phân loại điểm theo Type
  const itemsByType = useMemo(() => {
    const map: Record<string, number[]> = {};
    const gradeItems = grade?.gradeItems || [];
    for (const it of gradeItems) {
      const type = it?.type;
      const value = typeof it?.value === 'number' ? it.value : Number(it?.value);
      if (!type || Number.isNaN(value)) continue;
      if (!map[type]) map[type] = [];
      map[type].push(value);
    }
    return map;
  }, [grade]);

  // Lấy điểm tổng kết
  const finalScore = grade?.summary?.final != null ? Number(grade.summary.final) : null;

  if (!grade) {
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
        <Text style={styles.headerTitle}>Chi tiết điểm môn học</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* --- HERO CARD (Subject & Final Score) --- */}
        <View style={styles.heroCard}>
          <View style={styles.heroInfo}>
            <Text style={styles.subjectName}>{title}</Text>
            <View style={styles.semesterBadge}>
              <Text style={styles.semesterText}>{semesterLabel}</Text>
            </View>
          </View>
          
          <View style={styles.finalScoreCircle}>
            <Text style={styles.finalLabel}>Tổng kết</Text>
            <Text style={[styles.finalValue, { color: finalScore !== null ? getScoreColor(finalScore) : COLORS.textSecondary }]}>
              {finalScore !== null ? finalScore.toFixed(1) : '--'}
            </Text>
          </View>
        </View>

        {/* --- DETAIL SCORES --- */}
        <View style={styles.detailsContainer}>
          <Text style={styles.sectionTitle}>Các đầu điểm thành phần</Text>
          
          {Object.keys(TYPE_LABELS).map((typeKey) => {
            const list = itemsByType[typeKey] || [];
            return (
              <View key={typeKey} style={styles.typeBlock}>
                <View style={styles.typeHeader}>
                  <View style={styles.typeDot} />
                  <Text style={styles.typeTitle}>{TYPE_LABELS[typeKey]}</Text>
                  <Text style={styles.countText}>({list.length})</Text>
                </View>

                {list.length === 0 ? (
                  <Text style={styles.emptySubText}>Chưa có điểm</Text>
                ) : (
                  <View style={styles.chipsContainer}>
                    {list.map((v, idx) => (
                      <View 
                        key={`${typeKey}-${idx}`} 
                        style={[
                          styles.scoreChip, 
                          { borderColor: getScoreColor(v), backgroundColor: getScoreColor(v) + '15' } // 15% opacity bg
                        ]}
                      >
                        <Text style={[styles.chipText, { color: getScoreColor(v) }]}>
                          {Number(v).toString().replace(/\.0$/, '')}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <View style={{ height: 40 }} />
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
    padding: 16,
    paddingTop: 20,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  heroInfo: {
    flex: 1,
    paddingRight: 16,
  },
  subjectName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  semesterBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  semesterText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  finalScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  finalLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  finalValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },

  // Details
  detailsContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  typeBlock: {
    marginBottom: 20,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  countText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  emptySubText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginLeft: 14,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 14,
    gap: 10,
  },
  scoreChip: {
    width: 44,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  chipText: {
    fontSize: 15,
    fontWeight: 'bold',
  },

  // Empty State & Buttons
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 20,
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