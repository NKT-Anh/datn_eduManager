import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Eye, Calendar, Search, X, Loader2, Pause, Play } from 'lucide-react';
import { Survey, SurveyQuestion, CreateSurveyData } from '@/services/surveyApi';
import { useSubjects, useSurveys, useSurveyProgress } from '@/hooks';
import { useSchoolYears } from '@/hooks';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';

export default function SurveyManagementPage() {
  const { toast } = useToast();
  const { subjects } = useSubjects();
  const { schoolYears } = useSchoolYears();
  const { currentYearCode, currentYearData } = useCurrentAcademicYear();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [viewProgressDialogOpen, setViewProgressDialogOpen] = useState(false);
  const [progressData, setProgressData] = useState<any>(null);
  const [createForAllSubjects, setCreateForAllSubjects] = useState(false);
  const [isCreatingMultiple, setIsCreatingMultiple] = useState(false);

  // ✅ Sử dụng hook để quản lý surveys
  const {
    surveys,
    isLoading: loading,
    refetch: refetchSurveys,
    createSurvey,
    updateSurvey,
    deleteSurvey,
    openSurveyForStudents,
    isCreating,
    isUpdating,
    isDeleting,
    isOpening,
  } = useSurveys({
    status: statusFilter,
    year: yearFilter,
    semester: semesterFilter,
    subjectId: subjectFilter,
    isDeleted: 'false',
  });

  // ✅ Load progress cho tất cả surveys (sử dụng useEffect để tự động load khi surveys thay đổi)
  const [progressMap, setProgressMap] = useState<Record<string, { submittedCount: number; totalCount: number }>>({});
  
  useEffect(() => {
    const loadProgress = async () => {
      if (surveys.length === 0) return;
      
      // Import surveyApi để load progress
      const { default: surveyApi } = await import('@/services/surveyApi');
      
      const progressPromises = surveys.map(async (survey: Survey) => {
        try {
          const progress = await surveyApi.getSurveyProgress(survey._id);
          return {
            surveyId: survey._id,
            progress: {
              submittedCount: progress.submittedCount || 0,
              totalCount: progress.totalCount || progress.totalAllowed || 0,
            },
          };
        } catch {
          return { surveyId: survey._id, progress: { submittedCount: 0, totalCount: 0 } };
        }
      });
      
      const progressResults = await Promise.all(progressPromises);
      const newProgressMap: Record<string, { submittedCount: number; totalCount: number }> = {};
      progressResults.forEach(({ surveyId, progress }) => {
        newProgressMap[surveyId] = progress;
      });
      setProgressMap(newProgressMap);
    };
    
    loadProgress();
  }, [surveys]);

  // Form state
  const [formData, setFormData] = useState<CreateSurveyData>({
    title: '',
    description: '',
    subjectId: '',
    semester: '1',
    year: currentYearCode || '',
    questions: [],
    minScore: 1,
    maxScore: 5,
    allowedClasses: [],
    startDate: '',
    endDate: '',
  });

  // ✅ Surveys được tự động load từ hook useSurveys, không cần useEffect riêng

  const handleCreate = (forAllSubjects: boolean = false) => {
    // Set default 5 questions
    const defaultQuestions: SurveyQuestion[] = [
      { question: 'Giáo viên chuẩn bị bài giảng kỹ lưỡng và đầy đủ.', order: 1, weight: 1 },
      { question: 'Giáo viên giảng bài rõ ràng, dễ hiểu.', order: 2, weight: 1 },
      { question: 'Giáo viên khuyến khích học sinh đặt câu hỏi và tham gia bài học.', order: 3, weight: 1 },
      { question: 'Giáo viên đánh giá công bằng và khách quan trong việc chấm điểm.', order: 4, weight: 1 },
      { question: 'Giáo viên quan tâm, hỗ trợ học sinh khi gặp khó khăn trong môn học.', order: 5, weight: 1 },
    ];
    setFormData({
      ...formData,
      questions: defaultQuestions,
      year: currentYearCode || '',
      subjectId: forAllSubjects ? '' : formData.subjectId,
    });
    setCreateForAllSubjects(forAllSubjects);
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (survey: Survey) => {
    setSelectedSurvey(survey);
    setFormData({
      title: survey.title,
      description: survey.description || '',
      subjectId: survey.subjectId._id,
      semester: survey.semester,
      year: survey.year,
      questions: survey.questions || [],
      minScore: survey.minScore,
      maxScore: survey.maxScore,
      allowedClasses: survey.allowedClasses?.map(c => c._id) || [],
      startDate: survey.startDate ? format(new Date(survey.startDate), 'yyyy-MM-dd') : '',
      endDate: survey.endDate ? format(new Date(survey.endDate), 'yyyy-MM-dd') : '',
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmit = async () => {
    // ✅ Validation: Ngày kết thúc phải sau ngày bắt đầu
    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      if (endDate <= startDate) {
        toast({
          title: 'Lỗi',
          description: 'Ngày kết thúc phải sau ngày bắt đầu',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      if (isCreateDialogOpen) {
        // ✅ Tạo khảo sát cho tất cả môn
        if (createForAllSubjects) {
          if (!formData.title || !formData.semester || !formData.year) {
            toast({
              title: 'Lỗi',
              description: 'Vui lòng điền đầy đủ thông tin bắt buộc (Tiêu đề, Học kỳ, Năm học)',
              variant: 'destructive',
            });
            return;
          }

          if (!subjects || subjects.length === 0) {
            toast({
              title: 'Lỗi',
              description: 'Không có môn học nào trong hệ thống',
              variant: 'destructive',
            });
            return;
          }

          setIsCreatingMultiple(true);
          let successCount = 0;
          let errorCount = 0;
          const errors: string[] = [];

          // Tạo khảo sát cho từng môn
          for (const subject of subjects) {
            try {
              if (!subject._id) {
                errorCount++;
                errors.push(`${subject.name}: Không có ID môn học`);
                continue;
              }

              await createSurvey({
                ...formData,
                title: `${formData.title} - ${subject.name}`,
                subjectId: subject._id,
                questions: formData.questions || [],
              });
              successCount++;
            } catch (error: any) {
              errorCount++;
              const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Lỗi không xác định';
              errors.push(`${subject.name}: ${errorMessage}`);
              console.error(`❌ Lỗi khi tạo khảo sát cho môn ${subject.name}:`, error);
            }
          }

          setIsCreatingMultiple(false);
          
          if (successCount > 0) {
            toast({
              title: 'Thành công',
              description: `Đã tạo ${successCount} khảo sát thành công${errorCount > 0 ? `, ${errorCount} khảo sát thất bại` : ''}`,
            });
            if (errorCount > 0 && errors.length > 0) {
              // Hiển thị chi tiết lỗi nếu có
              console.error('Chi tiết lỗi:', errors);
            }
          } else {
            toast({
              title: 'Lỗi',
              description: `Không thể tạo khảo sát. ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`,
              variant: 'destructive',
            });
            return;
          }
        } else {
          // ✅ Tạo khảo sát cho 1 môn
          if (!formData.subjectId) {
            toast({
              title: 'Lỗi',
              description: 'Vui lòng chọn môn học',
              variant: 'destructive',
            });
            return;
          }
          await createSurvey(formData);
          toast({
            title: 'Thành công',
            description: 'Đã tạo khảo sát thành công',
          });
        }
      } else if (isEditDialogOpen && selectedSurvey) {
        await updateSurvey({ id: selectedSurvey._id, data: formData });
        toast({
          title: 'Thành công',
          description: 'Đã cập nhật khảo sát thành công',
        });
      }
      setIsCreateDialogOpen(false);
      setIsEditDialogOpen(false);
      setCreateForAllSubjects(false);
      setFormData({
        title: '',
        description: '',
        subjectId: '',
        semester: '1',
        year: currentYearCode || '',
        questions: [],
        minScore: 1,
        maxScore: 5,
        allowedClasses: [],
        startDate: '',
        endDate: '',
      });
      refetchSurveys();
    } catch (error: any) {
      setIsCreatingMultiple(false);
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Có lỗi xảy ra',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa khảo sát này?')) return;
    try {
      await deleteSurvey(id);
      toast({
        title: 'Thành công',
        description: 'Đã xóa khảo sát thành công',
      });
      refetchSurveys();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Có lỗi xảy ra',
        variant: 'destructive',
      });
    }
  };

  const handleOpenSurvey = async (id: string) => {
    try {
      // ✅ Gửi thông báo mặc định khi mở khảo sát
      const result = await openSurveyForStudents({
        id,
        data: { sendNotification: true },
      });
      toast({
        title: 'Thành công',
        description: result.message || 'Đã mở khảo sát cho học sinh và gửi thông báo',
      });
      refetchSurveys();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Có lỗi xảy ra khi mở khảo sát',
        variant: 'destructive',
      });
    }
  };

  const handlePauseSurvey = async (id: string) => {
    try {
      await updateSurvey({ id, data: { status: 'inactive' } });
      toast({
        title: 'Thành công',
        description: 'Đã tạm dừng khảo sát',
      });
      refetchSurveys();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Có lỗi xảy ra khi tạm dừng khảo sát',
        variant: 'destructive',
      });
    }
  };

  const handleResumeSurvey = async (id: string) => {
    try {
      await updateSurvey({ id, data: { status: 'active' } });
      toast({
        title: 'Thành công',
        description: 'Đã tiếp tục khảo sát',
      });
      refetchSurveys();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Có lỗi xảy ra khi tiếp tục khảo sát',
        variant: 'destructive',
      });
    }
  };

  const handleViewProgress = async (id: string) => {
    try {
      // Import surveyApi để lấy progress
      const { default: surveyApi } = await import('@/services/surveyApi');
      const data = await surveyApi.getSurveyProgress(id);
      setProgressData(data);
      setViewProgressDialogOpen(true);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Có lỗi xảy ra',
        variant: 'destructive',
      });
    }
  };

  const addQuestion = () => {
    const newOrder = (formData.questions?.length || 0) + 1;
    setFormData({
      ...formData,
      questions: [
        ...(formData.questions || []),
        { question: '', order: newOrder, weight: 1 },
      ],
    });
  };

  const removeQuestion = (index: number) => {
    const newQuestions = formData.questions?.filter((_, i) => i !== index) || [];
    setFormData({ ...formData, questions: newQuestions });
  };

  const updateQuestion = (index: number, field: keyof SurveyQuestion, value: any) => {
    const newQuestions = [...(formData.questions || [])];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setFormData({ ...formData, questions: newQuestions });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Bản nháp', variant: 'outline' },
      active: { label: 'Đang hoạt động', variant: 'default' },
      inactive: { label: 'Tạm dừng', variant: 'secondary' },
      closed: { label: 'Đã đóng', variant: 'destructive' },
    };
    const statusInfo = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const filteredSurveys = surveys.filter(survey =>
    survey.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    survey.subjectId.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ✅ Lấy danh sách năm học unique từ surveys và schoolYears
  const availableYears = Array.from(
    new Set([
      ...surveys.map(s => s.year),
      ...(schoolYears?.map(sy => sy.code || sy.name) || []),
      ...(currentYearCode ? [currentYearCode] : []),
    ])
  ).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý khảo sát</h1>
          <p className="text-muted-foreground">Tạo và quản lý khảo sát đánh giá giáo viên</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleCreate(false)}>
            <Plus className="h-4 w-4 mr-2" />
            Tạo khảo sát mới
          </Button>
          <Button onClick={() => handleCreate(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Tạo cho tất cả môn
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm khảo sát..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Năm học" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả năm học</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={semesterFilter} onValueChange={setSemesterFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Học kỳ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả học kỳ</SelectItem>
                <SelectItem value="1">Học kỳ 1</SelectItem>
                <SelectItem value="2">Học kỳ 2</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Môn học" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả môn học</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject._id} value={subject._id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="draft">Bản nháp</SelectItem>
                <SelectItem value="active">Đang hoạt động</SelectItem>
                <SelectItem value="inactive">Tạm dừng</SelectItem>
                <SelectItem value="closed">Đã đóng</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Môn học</TableHead>
                <TableHead>Năm học</TableHead>
                <TableHead>Học kỳ</TableHead>
                <TableHead>Ngày bắt đầu</TableHead>
                <TableHead>Ngày kết thúc</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Số câu hỏi</TableHead>
                <TableHead>Phản hồi</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center">Đang tải...</TableCell>
                </TableRow>
              ) : filteredSurveys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center">Không có khảo sát nào</TableCell>
                </TableRow>
              ) : (
                filteredSurveys.map((survey) => (
                  <TableRow key={survey._id}>
                    <TableCell className="font-medium">{survey.title}</TableCell>
                    <TableCell>{survey.subjectId.name}</TableCell>
                    <TableCell>{survey.year}</TableCell>
                    <TableCell>Học kỳ {survey.semester}</TableCell>
                    <TableCell>
                      {survey.startDate
                        ? format(new Date(survey.startDate), 'dd/MM/yyyy', { locale: vi })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {survey.endDate
                        ? format(new Date(survey.endDate), 'dd/MM/yyyy', { locale: vi })
                        : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(survey.status)}</TableCell>
                    <TableCell>{survey.questions.length}</TableCell>
                    <TableCell>
                      {progressMap[survey._id] ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            <span className="font-medium text-muted-foreground">Đã nộp:</span> {progressMap[survey._id].submittedCount} / <span className="font-medium text-muted-foreground">Sĩ số:</span> {progressMap[survey._id].totalCount}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewProgress(survey._id)}
                            title="Xem chi tiết tiến độ"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewProgress(survey._id)}
                          title="Xem chi tiết tiến độ"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(survey)}
                          title="Chỉnh sửa"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {/* ✅ Chỉ hiện nút "Mở" khi status = 'draft' */}
                        {survey.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenSurvey(survey._id)}
                            title="Mở khảo sát"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                        )}
                        {/* ✅ Hiện nút "Tạm dừng" khi status = 'active' */}
                        {survey.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePauseSurvey(survey._id)}
                            title="Tạm dừng khảo sát"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {/* ✅ Hiện nút "Tiếp tục" khi status = 'inactive' */}
                        {survey.status === 'inactive' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResumeSurvey(survey._id)}
                            title="Tiếp tục khảo sát"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(survey._id)}
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreateDialogOpen ? 'Tạo khảo sát mới' : 'Chỉnh sửa khảo sát'}</DialogTitle>
            <DialogDescription>
              {isCreateDialogOpen
                ? 'Tạo khảo sát mới với 5 câu hỏi mặc định (có thể chỉnh sửa)'
                : 'Chỉnh sửa thông tin khảo sát'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Thông tin cơ bản */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Thông tin cơ bản</h3>
              <div>
                <Label>Tiêu đề *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Nhập tiêu đề khảo sát"
                />
              </div>
              <div>
                <Label>Mô tả</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Nhập mô tả khảo sát"
                  rows={3}
                />
              </div>
            </div>
            {/* Cấu hình khảo sát */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Cấu hình khảo sát</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Môn học *</Label>
                    {isCreateDialogOpen && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="createForAllSubjects"
                          checked={createForAllSubjects}
                          onChange={(e) => {
                            setCreateForAllSubjects(e.target.checked);
                            if (e.target.checked) {
                              setFormData({ ...formData, subjectId: '' });
                            }
                          }}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="createForAllSubjects" className="text-sm font-normal cursor-pointer">
                          Tạo cho tất cả môn
                        </Label>
                      </div>
                    )}
                  </div>
                  <Select
                    value={formData.subjectId}
                    onValueChange={(value) => setFormData({ ...formData, subjectId: value })}
                    disabled={createForAllSubjects && isCreateDialogOpen}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={createForAllSubjects && isCreateDialogOpen ? "Sẽ tạo cho tất cả môn" : "Chọn môn học"} />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject._id} value={subject._id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {createForAllSubjects && isCreateDialogOpen && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Sẽ tạo {subjects.length} khảo sát cho {subjects.length} môn học
                    </p>
                  )}
                </div>
                <div>
                  <Label>Năm học *</Label>
                  <Select
                    value={formData.year}
                    onValueChange={(value) => setFormData({ ...formData, year: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn năm học" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Học kỳ *</Label>
                  <Select
                    value={formData.semester}
                    onValueChange={(value: '1' | '2') => setFormData({ ...formData, semester: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Học kỳ 1</SelectItem>
                      <SelectItem value="2">Học kỳ 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ngày bắt đầu</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label>Ngày kết thúc</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
            </div>
            {/* Câu hỏi */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Câu hỏi</h3>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-1" />
                  Thêm câu hỏi
                </Button>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {formData.questions?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Chưa có câu hỏi nào. Nhấn "Thêm câu hỏi" để bắt đầu.
                  </p>
                ) : (
                  formData.questions?.map((q, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium min-w-[60px]">Câu {q.order}:</span>
                          <Input
                            value={q.question}
                            onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                            placeholder="Nhập câu hỏi"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeQuestion(index)}
                            title="Xóa câu hỏi"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setIsEditDialogOpen(false);
              setCreateForAllSubjects(false);
            }} disabled={isCreatingMultiple}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={isCreatingMultiple}>
              {isCreatingMultiple ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                <>
                  {isCreateDialogOpen
                    ? (createForAllSubjects ? `Tạo ${subjects.length} khảo sát` : 'Tạo khảo sát')
                    : 'Cập nhật'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog open={viewProgressDialogOpen} onOpenChange={setViewProgressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Theo dõi tiến độ khảo sát</DialogTitle>
          </DialogHeader>
          {progressData && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Tổng số học sinh đã submit:</p>
                <p className="text-2xl font-bold">{progressData.submittedCount || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tổng số học sinh cần submit:</p>
                <p className="text-2xl font-bold">{progressData.totalCount || progressData.totalAllowed || 0}</p>
              </div>
              {progressData.completionRate && (
                <div>
                  <p className="text-sm text-muted-foreground">Tỷ lệ hoàn thành:</p>
                  <p className="text-2xl font-bold">{progressData.completionRate}%</p>
                </div>
              )}
              {progressData.notSubmittedCount > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Số học sinh chưa làm:</p>
                  <p className="text-2xl font-bold text-orange-600">{progressData.notSubmittedCount}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

