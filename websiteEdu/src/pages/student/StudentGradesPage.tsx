import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import gradesApi from '@/services/gradesApi';
import { 
  BarChart3,
  BookOpen,
  TrendingUp,
  Award,
  Download,
  Loader2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface GradeSummary {
  _id: string;
  subject: {
    _id: string;
    name: string;
    code: string;
    includeInAverage: boolean;
  };
  class: {
    _id: string;
    className: string;
    classCode: string;
    grade: string;
  } | null;
  schoolYear: string;
  semester: string;
  averages: {
    oral?: number;
    quiz15?: number;
    quiz45?: number;
    midterm?: number;
    final?: number;
  };
  average: number | null; // Điểm TB (chỉ có nếu môn tính điểm TB)
  result: string | null; // "D" hoặc "K" (chỉ có nếu môn không tính điểm TB)
  computedAt: string;
}

const StudentGradesPage = () => {
  const { backendUser } = useAuth();
  const [grades, setGrades] = useState<GradeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState<string>('1');
  const [selectedYear, setSelectedYear] = useState<string>('');

  // Lấy danh sách năm học từ điểm (unique schoolYear) - chỉ khi đã có dữ liệu
  const schoolYears = grades.length > 0 
    ? Array.from(new Set(grades.map(g => g.schoolYear))).sort().reverse()
    : [];
  const displayYear = selectedYear || schoolYears[0] || '';
  
  // Nếu chưa chọn năm học và có dữ liệu, tự động chọn năm học mới nhất
  useEffect(() => {
    if (!selectedYear && schoolYears.length > 0 && !loading) {
      setSelectedYear(schoolYears[0]);
    }
  }, [schoolYears.length, loading]); // Chỉ phụ thuộc vào length để tránh loop

  useEffect(() => {
    fetchGrades();
  }, [selectedSemester]); // Chỉ fetch khi đổi học kỳ, năm học được filter ở frontend

  const fetchGrades = async () => {
    try {
      setLoading(true);
      // Lấy tất cả điểm để có danh sách năm học đầy đủ
      const res = await gradesApi.getStudentGrades({
        semester: selectedSemester,
        // Không filter theo năm học để lấy tất cả, sau đó filter ở frontend
      });

      if (res.success && res.data) {
        setGrades(res.data);
      } else {
        toast({
          title: 'Lỗi',
          description: res.message || 'Không thể tải điểm số',
          variant: 'destructive',
        });
        setGrades([]);
      }
    } catch (error: any) {
      console.error('Error fetching grades:', error);
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể tải điểm số',
        variant: 'destructive',
      });
      setGrades([]);
    } finally {
      setLoading(false);
    }
  };

  // Tính điểm trung bình chung (chỉ tính các môn có includeInAverage)
  const calculateOverallAverage = () => {
    const validGrades = grades.filter(g => g.subject.includeInAverage && g.average !== null);
    if (validGrades.length === 0) return 0;
    const sum = validGrades.reduce((acc, g) => acc + (g.average || 0), 0);
    return (sum / validGrades.length).toFixed(1);
  };

  // Tính số môn đạt/không đạt (cho môn không tính TB)
  const getPassFailCount = () => {
    const nonAverageGrades = grades.filter(g => !g.subject.includeInAverage);
    const pass = nonAverageGrades.filter(g => g.result === 'D').length;
    const fail = nonAverageGrades.filter(g => g.result === 'K').length;
    return { pass, fail };
  };

  const getGradeColor = (score: number | null | string) => {
    if (score === null || score === undefined) return 'text-muted-foreground';
    if (typeof score === 'string') {
      if (score === 'D') return 'text-green-600';
      if (score === 'K') return 'text-red-600';
      return 'text-muted-foreground';
    }
    if (score >= 8) return 'text-green-600';
    if (score >= 6.5) return 'text-blue-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderScore = (score: number | null | undefined) => {
    if (score === null || score === undefined) return '-';
    return score.toFixed(1);
  };

  const filteredGrades = grades.filter(g => 
    (!selectedYear || g.schoolYear === selectedYear) && 
    g.semester === selectedSemester
  );

  const { pass, fail } = getPassFailCount();
  const overallAvg = calculateOverallAverage();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Điểm số của tôi</h1>
          <p className="text-muted-foreground">Xem điểm số các môn học theo học kỳ và năm học</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Xuất bảng điểm
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {schoolYears.length > 0 && (
              <Select value={selectedYear || 'all'} onValueChange={(value) => setSelectedYear(value === 'all' ? '' : value)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Chọn năm học">
                    {displayYear || 'Tất cả năm học'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả năm học</SelectItem>
                  {schoolYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Select value={selectedSemester} onValueChange={setSelectedSemester}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Chọn học kỳ">
                  Học kỳ {selectedSemester}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Học kỳ 1</SelectItem>
                <SelectItem value="2">Học kỳ 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {!loading && filteredGrades.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{overallAvg}</p>
              <p className="text-sm text-muted-foreground">Điểm TB chung</p>
              <p className="text-xs text-muted-foreground mt-1">
                ({filteredGrades.filter(g => g.subject.includeInAverage && g.average !== null).length} môn)
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Award className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">
                {filteredGrades.filter(g => g.subject.includeInAverage && g.average !== null).length > 0
                  ? Math.max(...filteredGrades.filter(g => g.subject.includeInAverage && g.average !== null).map(g => g.average || 0)).toFixed(1)
                  : '-'
                }
              </p>
              <p className="text-sm text-muted-foreground">Điểm cao nhất</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <BookOpen className="h-8 w-8 text-warning mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{filteredGrades.length}</p>
              <p className="text-sm text-muted-foreground">Tổng số môn</p>
              {(pass > 0 || fail > 0) && (
                <p className="text-xs text-muted-foreground mt-1">
                  Đạt: {pass} | Không đạt: {fail}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grades Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Bảng điểm học kỳ {selectedSemester}</span>
            {displayYear && <span className="text-muted-foreground">- {displayYear}</span>}
          </CardTitle>
          <CardDescription>
            {filteredGrades.length > 0 && filteredGrades[0]?.class && (
              <span>Lớp: <strong>{filteredGrades[0].class.className}</strong> - Khối {filteredGrades[0].class.grade}</span>
            )}
            {filteredGrades.length === 0 && 'Chi tiết điểm số các môn học'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Đang tải điểm số...</p>
            </div>
          ) : filteredGrades.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Chưa có điểm số</h3>
              <p className="text-muted-foreground">
                Điểm số sẽ được cập nhật khi giáo viên nhập điểm.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left font-medium text-muted-foreground">Môn học</th>
                    <th className="p-3 text-center font-medium text-muted-foreground">Miệng</th>
                    <th className="p-3 text-center font-medium text-muted-foreground">15 phút</th>
                    <th className="p-3 text-center font-medium text-muted-foreground">1 tiết</th>
                    <th className="p-3 text-center font-medium text-muted-foreground">Giữa kỳ</th>
                    <th className="p-3 text-center font-medium text-muted-foreground">Cuối kỳ</th>
                    <th className="p-3 text-center font-medium text-muted-foreground">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGrades.map((grade, index) => (
                    <tr key={grade._id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <div>
                            <span className="font-medium">{grade.subject.name}</span>
                            {!grade.subject.includeInAverage && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Không tính TB
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={getGradeColor(grade.averages.oral)}>
                          {renderScore(grade.averages.oral)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={getGradeColor(grade.averages.quiz15)}>
                          {renderScore(grade.averages.quiz15)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={getGradeColor(grade.averages.quiz45)}>
                          {renderScore(grade.averages.quiz45)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={getGradeColor(grade.averages.midterm)}>
                          {renderScore(grade.averages.midterm)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={getGradeColor(grade.averages.final)}>
                          {renderScore(grade.averages.final)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {grade.subject.includeInAverage ? (
                          <Badge 
                            variant="outline" 
                            className={`${getGradeColor(grade.average)} border-current font-semibold`}
                          >
                            {grade.average !== null ? grade.average.toFixed(1) : '-'}
                          </Badge>
                        ) : (
                          <Badge 
                            variant={grade.result === 'D' ? 'default' : 'destructive'}
                          >
                            {grade.result || '-'}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentGradesPage;

