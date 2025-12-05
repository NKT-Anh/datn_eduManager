/**
 * Student Exam Grades Screen
 * Hiển thị chi tiết điểm thi theo kỳ thi đã chọn
 */

import React, {useEffect, useMemo, useState} from 'react';
import {View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity} from 'react-native';
import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import {colors, spacing} from '../../theme';
import {useAuth} from '../../context/AuthContext';
import {studentApi, StudentExam, StudentGrade} from '../../services/studentApi';

const scoreColor = (score?: number) => {
  if (score == null) return colors.textSecondary;
  if (score >= 8.5) return colors.success;
  if (score >= 6.5) return colors.info;
  if (score >= 5) return colors.warning;
  return colors.danger;
};

const StudentExamGradesScreen: React.FC = () => {
  const {user} = useAuth();
  const studentId = user?._id || user?.id;
  const [exams, setExams] = useState<StudentExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingGrades, setLoadingGrades] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!studentId) return;
      setLoadingExams(true);
      try {
        const data = await studentApi.getExams(studentId);
        setExams(data);
        if (data.length) setSelectedExamId(data[0]._id);
      } finally {
        setLoadingExams(false);
      }
    };
    run();
  }, [studentId]);

  useEffect(() => {
    const run = async () => {
      if (!studentId || !selectedExamId) return;
      setLoadingGrades(true);
      try {
        const data = await studentApi.getExamGrades(selectedExamId, studentId);
        setGrades(data || []);
      } finally {
        setLoadingGrades(false);
      }
    };
    run();
  }, [studentId, selectedExamId]);

  const examOptions = useMemo(() => exams.map(e => ({
    id: e._id,
    label: `${e.name} • HK${e.semester} • ${e.year}`,
    type: e.type === 'midterm' ? 'Giữa kỳ' : 'Cuối kỳ',
  })), [exams]);

  const renderGradeItem = ({item}: {item: StudentGrade}) => (
    <Card style={styles.gradeItem}>
      <View style={styles.gradeLeft}>
        <Text variant="title" style={{marginBottom: 2}}>{item.subject?.name}</Text>
        <Text variant="caption" muted>
          HK{item.semester} • {item.schoolYear}
        </Text>
      </View>
      <Text variant="h2" style={{ color: scoreColor(item.average) }}>
        {item.average != null ? Number(item.average).toString() : '—'}
      </Text>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Text variant="h1" style={styles.title}>Chi tiết điểm thi</Text>

      <Card style={styles.examPicker}>
        {loadingExams ? (
          <ActivityIndicator />
        ) : (
          <View style={styles.examOptions}>
            {examOptions.length === 0 ? (
              <Text muted>Chưa có kỳ thi nào</Text>
            ) : (
              examOptions.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setSelectedExamId(opt.id)}
                  style={[styles.examChip, selectedExamId === opt.id && styles.examChipActive]}
                >
                  <Text variant="caption" style={selectedExamId === opt.id ? { color: colors.primaryText } : undefined}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </Card>

      <View style={{marginTop: spacing.lg}}>
        {loadingGrades ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={grades}
            renderItem={renderGradeItem}
            keyExtractor={item => item._id}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            ListEmptyComponent={<Text muted style={{textAlign: 'center'}}>Chưa có điểm thi</Text>}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    marginBottom: spacing.lg,
  },
  examPicker: {
    padding: spacing.md,
  },
  examOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  examChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  examChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  gradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  gradeLeft: {
    flexDirection: 'column',
  },
});

export default StudentExamGradesScreen;
