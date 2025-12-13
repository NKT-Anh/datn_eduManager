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
  StatusBar,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
// 1. Import Safe Area
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/studentService';

const { width } = Dimensions.get('window');

// Màu sắc chủ đạo
const COLORS = {
  primary: '#2563EB',
  secondary: '#FFFFFF',
  background: '#F3F4F6',
  text: '#1F2937',
  textLight: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  border: '#E5E7EB',
  inputBg: '#F9FAFB',
};

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

export default function SurveyScreen({ navigation }: any) {
  const insets = useSafeAreaInsets(); // 2. Lấy thông số tai thỏ
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
      Alert.alert('Chưa hoàn thành', `Vui lòng đánh giá hết ${missing.length} câu hỏi còn lại.`);
      return;
    }

    try {
      setSubmitting(true);
      await studentService.submitSurveyResponse({
        surveyId: selectedSurvey._id,
        teacherId: selectedTeacher._id,
        answers: qs.map((q) => ({ questionId: q._id, score: answers[q._id] })),
      });

      Alert.alert('Thành công', 'Cảm ơn bạn đã gửi đánh giá!', [
        {
          text: 'Đóng',
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

  // Render Rating Buttons (1 to 5)
  const renderRatingButtons = (questionId: string) => {
    return (
      <View style={styles.ratingWrapper}>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((score) => {
            const isSelected = answers[questionId] === score;
            
            // Logic màu sắc: 1-2 Đỏ, 3 Vàng, 4-5 Xanh
            let activeColor = COLORS.primary;
            if (score <= 2) activeColor = '#EF4444';
            else if (score === 3) activeColor = '#F59E0B';
            else activeColor = '#10B981';

            return (
              <TouchableOpacity
                key={score}
                style={[
                  styles.ratingButton,
                  isSelected && { backgroundColor: activeColor, borderColor: activeColor }
                ]}
                onPress={() => setAnswers((prev) => ({ ...prev, [questionId]: score }))}
                activeOpacity={0.7}
              >
                <Text style={[styles.ratingText, isSelected && { color: '#fff' }]}>
                  {score}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.ratingLabels}>
          <Text style={styles.ratingLabelText}>Không hài lòng</Text>
          <Text style={styles.ratingLabelText}>Rất tốt</Text>
        </View>
      </View>
    );
  };

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
      
      {/* 3. Header Xanh Cố Định - Có nút Back */}
      <View style={[styles.header, { paddingTop: insets.top + 10, height: 80 + insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Khảo sát ý kiến</Text>
        
        {/* View rỗng để cân giữa Title */}
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageDescription}>
          Đóng góp ý kiến để nâng cao chất lượng giảng dạy
        </Text>

        {surveys.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Hiện không có khảo sát nào</Text>
          </View>
        ) : (
          surveys.map((survey) => (
            <View key={survey._id} style={styles.surveyCard}>
              {/* Survey Header Info */}
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="document-text" size={24} color={COLORS.primary} />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.surveyTitle}>{survey.title}</Text>
                  {survey.subjectId && (
                    <View style={styles.subjectTag}>
                      <Ionicons name="book-outline" size={12} color={COLORS.textLight} />
                      <Text style={styles.surveySubject}>{survey.subjectId.name}</Text>
                    </View>
                  )}
                </View>
              </View>

              {survey.description && (
                <Text style={styles.surveyDescription}>{survey.description}</Text>
              )}
              
              <View style={styles.divider} />

              {/* Teachers List */}
              {survey.teachersToEvaluate && survey.teachersToEvaluate.length > 0 && (
                <View style={styles.teacherList}>
                  <Text style={styles.sectionTitle}>Giáo viên cần đánh giá:</Text>
                  {survey.teachersToEvaluate.map((teacher) => (
                    <View key={teacher._id} style={styles.teacherRow}>
                      <View style={styles.teacherAvatar}>
                        <Text style={styles.avatarText}>
                          {teacher.name ? teacher.name.charAt(0).toUpperCase() : 'G'}
                        </Text>
                      </View>
                      
                      <View style={styles.teacherInfo}>
                        <Text style={styles.teacherName}>{teacher.name}</Text>
                        <Text style={styles.teacherCode}>MSGV: {teacher.teacherCode}</Text>
                      </View>

                      {teacher.hasSubmitted ? (
                        <View style={styles.statusBadgeSuccess}>
                          <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                          <Text style={styles.statusTextSuccess}>Hoàn tất</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.evaluateButton}
                          onPress={() => handleEvaluate(survey, teacher)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.evaluateButtonText}>Đánh giá</Text>
                          <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Evaluate Modal - Bottom Sheet Style */}
      <Modal
        visible={showEvaluateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEvaluateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderDrag} />
              <Text style={styles.modalTitle}>Phiếu đánh giá</Text>
              <Text style={styles.modalSubtitle}>
                GV: <Text style={{ fontWeight: 'bold', color: COLORS.primary }}>{selectedTeacher?.name}</Text>
              </Text>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setShowEvaluateModal(false)}
              >
                <Ionicons name="close-circle" size={28} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            {/* Questions List */}
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalContent}>
                <Text style={styles.surveyNameInModal}>{selectedSurvey?.title}</Text>
                
                {(selectedSurvey?.questions || [])
                  .slice()
                  .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                  .map((q: any, idx: number) => (
                    <View key={q._id || idx} style={styles.questionBlock}>
                      <Text style={styles.questionText}>
                        <Text style={styles.questionNumber}>Câu {idx + 1}:</Text> {q.question}
                      </Text>
                      {renderRatingButtons(q._id)}
                    </View>
                  ))}
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Modal Footer Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.buttonCancel]}
                onPress={() => setShowEvaluateModal(false)}
              >
                <Text style={styles.buttonCancelText}>Hủy bỏ</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.buttonSubmit, submitting && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonSubmitText}>Gửi kết quả</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textLight,
  },
  
  // New Blue Header Style
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

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  pageDescription: {
    textAlign: 'center',
    color: COLORS.textLight,
    marginBottom: 20,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textLight,
  },

  // Survey Card
  surveyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
    justifyContent: 'center',
  },
  surveyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  surveySubject: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  surveyDescription: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  
  // Teachers List
  teacherList: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  teacherAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  teacherInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  teacherCode: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  
  // Buttons
  evaluateButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  evaluateButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusTextSuccess: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    position: 'relative',
  },
  modalHeaderDrag: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: 20,
  },
  surveyNameInModal: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 20,
    textAlign: 'center',
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Question Block
  questionBlock: {
    marginBottom: 24,
    backgroundColor: '#fff',
  },
  questionText: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: 12,
  },
  questionNumber: {
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  
  // Rating Custom UI
  ratingWrapper: {
    marginTop: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    width: '100%',
  },
  ratingLabelText: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  // Modal Footer
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCancel: {
    backgroundColor: '#F3F4F6',
  },
  buttonCancelText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
  },
  buttonSubmit: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonSubmitText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});