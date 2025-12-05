import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle2, Clock, AlertCircle, FileText, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import surveyApi from '@/services/surveyApi';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface AvailableSurvey {
  _id: string;
  title: string;
  description?: string;
  subjectId: {
    _id: string;
    name: string;
    code: string;
  };
  semester: '1' | '2';
  year: string;
  questions: Array<{
    _id: string;
    question: string;
    order: number;
    weight?: number;
  }>;
  startDate?: string;
  endDate?: string;
  teachers: Array<{
    _id: string;
    name: string;
    teacherCode: string;
    submitted?: boolean;
    hasSubmitted?: boolean;
    submittedAt?: string | null;
  }>;
  teachersToEvaluate?: Array<{
    _id: string;
    name: string;
    teacherCode: string;
    hasSubmitted: boolean;
  }>;
}

export default function StudentSurveyPage() {
  const { toast } = useToast();
  const { backendUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [surveys, setSurveys] = useState<AvailableSurvey[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<AvailableSurvey | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [isEvaluateDialogOpen, setIsEvaluateDialogOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const data = await surveyApi.getAvailableSurveys();
      // ✅ Backend trả về { surveys: [...], student: {...} }
      const surveysData = data.surveys || (Array.isArray(data) ? data : []);
      
      // ✅ Map dữ liệu để phù hợp với interface
      const mappedSurveys = surveysData.map((survey: any) => ({
        ...survey,
        // ✅ Backend trả về `teachers` với `submitted`, frontend cần `teachersToEvaluate` với `hasSubmitted`
        teachersToEvaluate: (survey.teachers || survey.teachersToEvaluate || []).map((teacher: any) => ({
          _id: teacher._id,
          name: teacher.name,
          teacherCode: teacher.teacherCode,
          hasSubmitted: teacher.submitted || teacher.hasSubmitted || false,
        })),
      }));
      
      console.log('📊 Danh sách khảo sát:', mappedSurveys);
      setSurveys(mappedSurveys);
    } catch (error: any) {
      console.error('❌ Lỗi khi tải danh sách khảo sát:', error);
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể tải danh sách khảo sát',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = (survey: AvailableSurvey, teacher: any) => {
    // ✅ Validation: Đảm bảo submit 1 lần/GV/khảo sát
    if (teacher.hasSubmitted) {
      toast({
        title: 'Thông báo',
        description: 'Bạn đã đánh giá giáo viên này rồi. Mỗi học sinh chỉ có thể đánh giá một giáo viên một lần cho mỗi khảo sát.',
        variant: 'default',
      });
      return;
    }

    // ✅ Kiểm tra thời gian khảo sát
    const now = new Date();
    if (survey.startDate && now < new Date(survey.startDate)) {
      toast({
        title: 'Khảo sát chưa bắt đầu',
        description: `Khảo sát sẽ bắt đầu vào: ${format(new Date(survey.startDate), 'dd/MM/yyyy HH:mm', { locale: vi })}. Vui lòng quay lại sau.`,
        variant: 'default',
      });
      return;
    }

    if (survey.endDate && now > new Date(survey.endDate)) {
      toast({
        title: 'Khảo sát đã kết thúc',
        description: `Khảo sát đã kết thúc vào: ${format(new Date(survey.endDate), 'dd/MM/yyyy HH:mm', { locale: vi })}. Bạn không thể đánh giá nữa.`,
        variant: 'destructive',
      });
      return;
    }

    setSelectedSurvey(survey);
    setSelectedTeacher(teacher);
    // Initialize answers with empty values
    const initialAnswers: Record<string, number> = {};
    survey.questions.forEach((q) => {
      initialAnswers[q._id] = 0;
    });
    setAnswers(initialAnswers);
    setIsEvaluateDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedSurvey || !selectedTeacher) return;

    // ✅ Validation: Đảm bảo tất cả câu hỏi được trả lời
    const unansweredQuestions = selectedSurvey.questions.filter(
      (q) => !answers[q._id] || answers[q._id] < 1 || answers[q._id] > 5
    );

    if (unansweredQuestions.length > 0) {
      toast({
        title: 'Lỗi',
        description: `Vui lòng đánh giá tất cả ${selectedSurvey.questions.length} câu hỏi (từ 1 đến 5). Bạn còn thiếu ${unansweredQuestions.length} câu hỏi.`,
        variant: 'destructive',
      });
      return;
    }

    // ✅ Validation: Kiểm tra lại thời gian trước khi submit
    const now = new Date();
    if (selectedSurvey.startDate && now < new Date(selectedSurvey.startDate)) {
      toast({
        title: 'Lỗi',
        description: 'Khảo sát chưa bắt đầu. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedSurvey.endDate && now > new Date(selectedSurvey.endDate)) {
      toast({
        title: 'Lỗi',
        description: 'Khảo sát đã kết thúc. Bạn không thể gửi đánh giá nữa.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const formattedAnswers = selectedSurvey.questions.map((q) => ({
        questionId: q._id,
        score: answers[q._id],
      }));

      await surveyApi.submitSurveyResponse({
        surveyId: selectedSurvey._id,
        teacherId: selectedTeacher._id,
        answers: formattedAnswers,
      });

      toast({
        title: 'Thành công',
        description: 'Đã gửi đánh giá thành công. Cảm ơn bạn đã tham gia khảo sát!',
      });

      setIsEvaluateDialogOpen(false);
      setSelectedSurvey(null);
      setSelectedTeacher(null);
      setAnswers({});
      loadSurveys(); // Reload to update status
    } catch (error: any) {
      // ✅ Backend sẽ kiểm tra duplicate, nhưng frontend cũng hiển thị thông báo rõ ràng
      const errorMessage = error.response?.data?.message || 'Không thể gửi đánh giá';
      if (errorMessage.includes('đã gửi') || errorMessage.includes('đã đánh giá')) {
        toast({
          title: 'Lỗi',
          description: 'Bạn đã đánh giá giáo viên này rồi. Mỗi học sinh chỉ có thể đánh giá một giáo viên một lần cho mỗi khảo sát.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Lỗi',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (survey: AvailableSurvey, teacher: any) => {
    const hasSubmitted = teacher.hasSubmitted || teacher.submitted || false;
    if (hasSubmitted) {
      return (
        <Badge className="bg-green-500 text-white flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Đã hoàn thành
        </Badge>
      );
    }

    // ✅ Hiển thị thông báo rõ ràng về thời gian khảo sát
    const now = new Date();
    if (survey.startDate && now < new Date(survey.startDate)) {
      const startDate = new Date(survey.startDate);
      const daysUntilStart = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Chưa bắt đầu
          {daysUntilStart > 0 && (
            <span className="ml-1 text-xs">({daysUntilStart} ngày nữa)</span>
          )}
        </Badge>
      );
    }

    if (survey.endDate && now > new Date(survey.endDate)) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Đã kết thúc
        </Badge>
      );
    }

    // ✅ Kiểm tra thời gian còn lại
    if (survey.endDate) {
      const endDate = new Date(survey.endDate);
      const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilEnd <= 3 && daysUntilEnd > 0) {
        return (
          <Badge variant="default" className="bg-orange-500 text-white flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Sắp kết thúc ({daysUntilEnd} ngày)
          </Badge>
        );
      }
    }

    return (
      <Badge variant="default" className="bg-blue-500 text-white flex items-center gap-1">
        <FileText className="h-3 w-3" />
        Chưa làm
      </Badge>
    );
  };

  const canEvaluate = (survey: AvailableSurvey, teacher: any) => {
    const hasSubmitted = teacher.hasSubmitted || teacher.submitted || false;
    if (hasSubmitted) return false;
    const now = new Date();
    if (survey.startDate && now < new Date(survey.startDate)) return false;
    if (survey.endDate && now > new Date(survey.endDate)) return false;
    return true;
  };

  // Phân loại khảo sát theo trạng thái hoàn thành (dựa trên tất cả giáo viên cần đánh giá)
  const completedSurveys = surveys.filter(s => s.teachersToEvaluate && s.teachersToEvaluate.length > 0 && s.teachersToEvaluate.every(t => t.hasSubmitted));
  const pendingSurveys = surveys.filter(s => !(s.teachersToEvaluate && s.teachersToEvaluate.length > 0 && s.teachersToEvaluate.every(t => t.hasSubmitted)));

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Khảo sát đánh giá</h1>
        <p className="text-muted-foreground">
          Đánh giá giáo viên của bạn để cải thiện chất lượng giảng dạy
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center">Đang tải...</CardContent>
        </Card>
      ) : surveys.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Hiện tại không có khảo sát nào dành cho bạn</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Khảo sát chưa hoàn thành */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" /> Chưa khảo sát
              <Badge variant="outline" className="ml-1">{pendingSurveys.length}</Badge>
            </h2>
            {pendingSurveys.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">Không còn khảo sát cần thực hiện</CardContent>
              </Card>
            ) : (
              pendingSurveys.map((survey) => (
                <Card key={survey._id} className="border-blue-200">
                  <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <CardTitle>{survey.title}</CardTitle>
                        {survey.description && (
                          <CardDescription className="mt-2">{survey.description}</CardDescription>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                          <span>Môn: {survey.subjectId.name}</span>
                          <span>Năm học: {survey.year}</span>
                          <span>Học kỳ: {survey.semester}</span>
                          {survey.startDate && (
                            <span>
                              Bắt đầu: {format(new Date(survey.startDate), 'dd/MM/yyyy', { locale: vi })}
                            </span>
                          )}
                          {survey.endDate && (
                            <span>
                              Kết thúc: {format(new Date(survey.endDate), 'dd/MM/yyyy', { locale: vi })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Giáo viên cần đánh giá:</span>
                      </div>
                      {survey.teachersToEvaluate.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Không có giáo viên nào cần đánh giá</p>
                      ) : (
                        <div className="space-y-2">
                          {survey.teachersToEvaluate.map((teacher) => (
                            <div
                              key={teacher._id}
                              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div>
                                  <p className="font-medium">{teacher.name}</p>
                                  <p className="text-sm text-muted-foreground">Mã: {teacher.teacherCode}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 sm:justify-end">
                                {getStatusBadge(survey, teacher)}
                                {canEvaluate(survey, teacher) && (
                                  <Button
                                    size="sm"
                                    className="w-full sm:w-auto"
                                    onClick={() => handleEvaluate(survey, teacher)}
                                  >
                                    Đánh giá
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Khảo sát đã hoàn thành */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> Đã khảo sát
              <Badge variant="outline" className="ml-1">{completedSurveys.length}</Badge>
            </h2>
            {completedSurveys.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">Chưa có khảo sát nào hoàn thành toàn bộ</CardContent>
              </Card>
            ) : (
              completedSurveys.map((survey) => (
                <Card key={survey._id} className="border-green-200">
                  <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <CardTitle>{survey.title}</CardTitle>
                        {survey.description && (
                          <CardDescription className="mt-2">{survey.description}</CardDescription>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                          <span>Môn: {survey.subjectId.name}</span>
                          <span>Năm học: {survey.year}</span>
                          <span>Học kỳ: {survey.semester}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {survey.teachersToEvaluate.map((teacher) => (
                        <div
                          key={teacher._id}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-900/20"
                        >
                          <div className="flex items-start gap-3">
                            <div>
                              <p className="font-medium">{teacher.name}</p>
                              <p className="text-sm text-muted-foreground">Mã: {teacher.teacherCode}</p>
                            </div>
                          </div>
                          <Badge className="bg-green-500 text-white flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Đã hoàn thành
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Evaluate Dialog */}
      <Dialog open={isEvaluateDialogOpen} onOpenChange={setIsEvaluateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Đánh giá giáo viên: {selectedTeacher?.name}
            </DialogTitle>
            <DialogDescription>
              Khảo sát: {selectedSurvey?.title}
              <br />
              Môn: {selectedSurvey?.subjectId.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {selectedSurvey?.questions
              .sort((a, b) => a.order - b.order)
              .map((question) => (
                <div key={question._id} className="space-y-3">
                  <Label className="text-base font-medium">
                    Câu {question.order}: {question.question}
                  </Label>
                  <RadioGroup
                    value={answers[question._id]?.toString() || ''}
                    onValueChange={(value) =>
                      setAnswers({ ...answers, [question._id]: parseInt(value) })
                    }
                    className="grid grid-cols-5 gap-3 sm:flex sm:gap-4"
                  >
                    {[1, 2, 3, 4, 5].map((score) => (
                      <div key={score} className="flex items-center space-x-2">
                        <RadioGroupItem value={score.toString()} id={`q${question._id}-${score}`} />
                        <Label
                          htmlFor={`q${question._id}-${score}`}
                          className="cursor-pointer font-normal"
                        >
                          {score}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>1 = Rất không đồng ý</span>
                    <span>•</span>
                    <span>5 = Rất đồng ý</span>
                  </div>
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEvaluateDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

