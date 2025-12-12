/**
 * Student Grades Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { studentService } from '../../services/studentService';
import { Grade } from '../../types';

export default function GradesScreen({ navigation }: any) {
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải điểm số...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (grades.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Chưa có điểm số</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Điểm số</Text>
      </View>

      {grades.map((grade) => (
        <TouchableOpacity
          key={grade._id}
          style={styles.gradeCard}
          onPress={() => navigation.navigate('GradeDetail', { grade })}
          activeOpacity={0.85}
        >
          <Text style={styles.subjectName}>
            {grade.subjectId?.name || 'Môn học'}
          </Text>
          <Text style={styles.semester}>
            {grade.year} - Học kỳ {grade.semester}
          </Text>

          {grade.summary && (
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Điểm miệng:</Text>
                <Text style={styles.summaryValue}>
                  {grade.summary.mieng?.toFixed(1) || '-'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Điểm 15 phút:</Text>
                <Text style={styles.summaryValue}>
                  {grade.summary['15phut']?.toFixed(1) || '-'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Điểm 1 tiết:</Text>
                <Text style={styles.summaryValue}>
                  {grade.summary['1tiet']?.toFixed(1) || '-'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Điểm học kỳ:</Text>
                <Text style={styles.summaryValue}>
                  {grade.summary.hocky?.toFixed(1) || '-'}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.finalRow]}>
                <Text style={styles.finalLabel}>Điểm tổng kết:</Text>
                <Text style={styles.finalValue}>
                  {grade.summary.final?.toFixed(2) || '-'}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  gradeCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subjectName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  semester: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  summary: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  finalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  finalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  finalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
});

