import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Trophy, Award, Star, TrendingUp, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import surveyApi from '@/services/surveyApi';
import { useSchoolYears } from '@/hooks';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Award {
  _id: string;
  title: string;
  year?: string;
  semester?: string;
  reason?: string;
  awardedAt: string;
  awardedBy?: {
    _id: string;
    email: string;
  };
  surveyAverageScore?: number;
}

interface TeacherAwardsData {
  teacher: {
    _id: string;
    name: string;
    teacherCode: string;
  };
  currentRating?: {
    level: 'excellent' | 'good' | 'average' | 'needs_improvement' | null;
    averageScore?: number;
    year?: string;
    semester?: string;
    updatedAt?: string;
  };
  awards: Award[];
  totalAwards: number;
}

export default function TeacherAwardsPage() {
  const { toast } = useToast();
  const { backendUser } = useAuth();
  const { schoolYears } = useSchoolYears();
  const { currentYearCode } = useCurrentAcademicYear();

  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('');
  
  // ✅ Set năm học hiện tại khi có dữ liệu
  useEffect(() => {
    if (currentYearCode && !selectedYear) {
      setSelectedYear(currentYearCode);
    }
  }, [currentYearCode, selectedYear]);
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [awardsData, setAwardsData] = useState<TeacherAwardsData | null>(null);
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    if (selectedYear) {
      loadAwards();
      loadStatistics();
    }
  }, [selectedYear, selectedSemester]);

  const loadAwards = async () => {
    setLoading(true);
    try {
      // ✅ Sử dụng API riêng để lấy danh hiệu của giáo viên hiện tại
      const data = await surveyApi.getMyAwards({
        year: selectedYear || undefined,
        semester: selectedSemester !== 'all' ? selectedSemester : undefined,
      });

      setAwardsData({
        teacher: {
          _id: data.teacher._id,
          name: data.teacher.name,
          teacherCode: data.teacher.teacherCode,
        },
        currentRating: data.currentRating || null,
        awards: data.awards || [],
        totalAwards: data.totalAwards || 0,
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể tải danh sách danh hiệu',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const data = await surveyApi.getTeacherStatistics({
        year: selectedYear || undefined,
        semester: selectedSemester !== 'all' ? selectedSemester : undefined,
      });
      setStatistics(data);
    } catch (error: any) {
      console.error('Error loading statistics:', error);
    }
  };

  const getRatingLabel = (level: string | null | undefined) => {
    const ratingMap: Record<string, { label: string; color: string; icon: any }> = {
      excellent: { label: 'Xuất sắc', color: 'bg-yellow-500', icon: Trophy },
      good: { label: 'Khá', color: 'bg-green-500', icon: Star },
      average: { label: 'Trung bình', color: 'bg-blue-500', icon: Award },
      needs_improvement: { label: 'Cần cải thiện', color: 'bg-orange-500', icon: TrendingUp },
    };
    return ratingMap[level || ''] || { label: 'Chưa đánh giá', color: 'bg-gray-500', icon: Award };
  };

  const getRatingBadge = (level: string | null | undefined) => {
    const ratingInfo = getRatingLabel(level);
    const Icon = ratingInfo.icon;
    return (
      <Badge className={`${ratingInfo.color} text-white flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {ratingInfo.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Danh hiệu / Khen thưởng</h1>
          <p className="text-muted-foreground">
            Theo dõi thành tích và danh hiệu của bạn theo học kỳ
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Năm học:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year._id} value={year.code}>
                      {year.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Học kỳ:</Label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="1">Học kỳ 1</SelectItem>
                  <SelectItem value="2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center">Đang tải...</CardContent>
        </Card>
      ) : (
        <>
          {/* Current Rating & Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Xếp loại hiện tại</CardTitle>
              </CardHeader>
              <CardContent>
                {awardsData?.currentRating?.level ? (
                  <div className="space-y-2">
                    <div>{getRatingBadge(awardsData.currentRating.level)}</div>
                    {awardsData.currentRating.averageScore && (
                      <div className="text-sm text-muted-foreground">
                        Điểm trung bình: <span className="font-semibold">{awardsData.currentRating.averageScore}</span>
                      </div>
                    )}
                    {awardsData.currentRating.year && (
                      <div className="text-sm text-muted-foreground">
                        Năm học: {awardsData.currentRating.year}
                      </div>
                    )}
                    {awardsData.currentRating.semester && (
                      <div className="text-sm text-muted-foreground">
                        Học kỳ: {awardsData.currentRating.semester}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Chưa có xếp loại</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tổng số danh hiệu</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{awardsData?.totalAwards || 0}</div>
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedSemester !== 'all' 
                    ? `Trong học kỳ ${selectedSemester}` 
                    : 'Tất cả các học kỳ'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Điểm khảo sát trung bình</CardTitle>
              </CardHeader>
              <CardContent>
                {statistics?.summary?.averageScore ? (
                  <div className="space-y-2">
                    <div className="text-3xl font-bold">
                      {statistics.summary.averageScore.toFixed(2)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Tổng số phản hồi: {statistics.summary.totalResponses}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Chưa có dữ liệu</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Awards List */}
          <Card>
            <CardHeader>
              <CardTitle>Danh sách danh hiệu / Khen thưởng</CardTitle>
              <CardDescription>
                {selectedSemester !== 'all' 
                  ? `Danh hiệu trong học kỳ ${selectedSemester}, năm học ${selectedYear}`
                  : `Tất cả danh hiệu trong năm học ${selectedYear}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {awardsData?.awards && awardsData.awards.length > 0 ? (
                <div className="space-y-4">
                  {awardsData.awards.map((award) => (
                    <div
                      key={award._id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                          <Trophy className="h-6 w-6 text-yellow-600" />
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{award.title}</h3>
                          {award.surveyAverageScore && (
                            <Badge variant="outline">
                              Điểm: {award.surveyAverageScore}
                            </Badge>
                          )}
                        </div>
                        {award.reason && (
                          <p className="text-sm text-muted-foreground">{award.reason}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {award.year && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Năm học: {award.year}
                            </span>
                          )}
                          {award.semester && (
                            <span>Học kỳ: {award.semester}</span>
                          )}
                          <span>
                            Ngày trao: {format(new Date(award.awardedAt), 'dd/MM/yyyy', { locale: vi })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Chưa có danh hiệu/khen thưởng nào</p>
                  <p className="text-sm mt-2">
                    {selectedSemester !== 'all' 
                      ? `Trong học kỳ ${selectedSemester}, năm học ${selectedYear}`
                      : `Trong năm học ${selectedYear}`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistics Details */}
          {statistics && statistics.statistics && statistics.statistics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Chi tiết thống kê khảo sát</CardTitle>
                <CardDescription>
                  Điểm trung bình theo từng khảo sát
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {statistics.statistics.map((stat: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{stat.survey.title}</h4>
                        <Badge>Điểm TB: {stat.overallAverage.toFixed(2)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Môn: {stat.survey.subjectId.name} | Số phản hồi: {stat.responseCount}
                      </p>
                      {stat.questionStatistics && stat.questionStatistics.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Điểm từng câu hỏi:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {stat.questionStatistics.map((qStat: any, qIndex: number) => (
                              <div key={qIndex} className="text-sm">
                                <span className="text-muted-foreground">
                                  Câu {qStat.order}: {qStat.averageScore.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

