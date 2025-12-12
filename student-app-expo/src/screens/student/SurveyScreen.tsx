/**
 * Student Survey Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/studentService';

interface Survey {
  _id: string;
  title: string;
  description?: string;
  subjectId: {
    _id: string;
    name: string;
  };
  questions?: Array<{
    _id: string;
    question: string;
    order: number;
    weight?: number;
  }>;
  teachersToEvaluate?: Array<{
    _id: string;
    name: string;
    teacherCode: string;
    hasSubmitted: boolean;
  }>;
  startDate?: string;
  endDate?: string;
}

export default function SurveyScreen() {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [showEvaluateModal, setShowEvaluateModal] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    try {
      setLoading(true);
      const data = await studentService.getAvailableSurveys();
      const surveysData = data.surveys || (Array.isArray(data) ? data : []);
      setSurveys(surveysData);
    } catch (err: any) {
      console.error('Error loading surveys:', err);
      Alert.alert('Lỗi', 'Không thể tải danh sách khảo sát');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = (survey: Survey, teacher: any) => {
    setSelectedSurvey(survey);
    setSelectedTeacher(teacher);
    setAnswers({});
    setShowEvaluateModal(true);
  };

  const handleSubmit = async () => {
    if (!selectedSurvey || !selectedTeacher) return;

    const qs = (selectedSurvey.questions || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    if (qs.length === 0) {
      Alert.alert('Lỗi', 'Khảo sát chưa có câu hỏi.');
      return;
    }
    const missing = qs.filter((q) => !answers[q._id]);
    if (missing.length > 0) {
      Alert.alert('Thiếu đánh giá', `Bạn còn ${missing.length} câu chưa chấm điểm.`);
      return;
    }

    try {
      setSubmitting(true);
      await studentService.submitSurveyResponse({
        surveyId: selectedSurvey._id,
        teacherId: selectedTeacher._id,
        answers: qs.map((q) => ({ questionId: q._id, score: answers[q._id] })),
      });

      Alert.alert('Thành công', 'Đã gửi đánh giá thành công', [
        {
          text: 'OK',
          onPress: () => {
            setShowEvaluateModal(false);
            loadSurveys();
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể gửi đánh giá');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Khảo sát đánh giá</Text>
        <Text style={styles.subtitle}>Đánh giá chất lượng giảng dạy của giáo viên</Text>
      </View>

      {surveys.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Chưa có khảo sát nào</Text>
        </View>
      ) : (
        surveys.map((survey) => (
          <View key={survey._id} style={styles.surveyCard}>
            <View style={styles.surveyHeader}>
              <Text style={styles.surveyTitle}>{survey.title}</Text>
              {survey.subjectId && (
                <Text style={styles.surveySubject}>Môn: {survey.subjectId.name}</Text>
              )}
            </View>

            {survey.description && (
              <Text style={styles.surveyDescription}>{survey.description}</Text>
            )}

            {survey.teachersToEvaluate && survey.teachersToEvaluate.length > 0 && (
              <View style={styles.teachersContainer}>
                <Text style={styles.teachersTitle}>Giáo viên cần đánh giá:</Text>
                {survey.teachersToEvaluate.map((teacher) => (
                  <View key={teacher._id} style={styles.teacherItem}>
                    <View style={styles.teacherInfo}>
                      <Text style={styles.teacherName}>{teacher.name}</Text>
                      <Text style={styles.teacherCode}>{teacher.teacherCode}</Text>
                    </View>
                    {teacher.hasSubmitted ? (
                      <View style={styles.submittedBadge}>
                        <Text style={styles.submittedText}>Đã đánh giá</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.evaluateButton}
                        onPress={() => handleEvaluate(survey, teacher)}
                      >
                        <Text style={styles.evaluateButtonText}>Đánh giá</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))
      )}

      {/* Evaluate Modal */}
      <Modal
        visible={showEvaluateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEvaluateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Đánh giá {selectedTeacher?.name}
            </Text>
            <Text style={styles.modalSubtitle}>
              {selectedSurvey?.title}
            </Text>

            <ScrollView style={styles.questionsContainer}>
              {(selectedSurvey?.questions || [])
                .slice()
                .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                .map((q: any, idx: number) => (
                  <View key={q._id || idx} style={styles.questionBlock}>
                    <Text style={styles.questionTitle}>
                      {idx + 1}. {q.question}
                    </Text>
                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((val) => {
                        const active = answers[q._id] === val;
                        return (
                          <TouchableOpacity
                            key={val}
                            style={[styles.ratingBtn, active && styles.ratingBtnActive]}
                            onPress={() => setAnswers((prev) => ({ ...prev, [q._id]: val }))}
                          >
                            <Text style={[styles.ratingText, active && styles.ratingTextActive]}>{val}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowEvaluateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, submitting && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Gửi đánh giá</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  surveyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  surveyHeader: {
    marginBottom: 12,
  },
  surveyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  surveySubject: {
    fontSize: 14,
    color: '#666',
  },
  surveyDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  teachersContainer: {
    marginTop: 12,
  },
  teachersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  teacherItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  teacherInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  teacherCode: {
    fontSize: 12,
    color: '#999',
  },
  submittedBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  submittedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  evaluateButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  evaluateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  questionsContainer: {
    maxHeight: 400,
    marginBottom: 20,
  },
  questionBlock: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  questionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  ratingBtn: {
    width: 44,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  ratingBtnActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  ratingTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

