import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import gradesApi from '@/services/gradesApi';
import conductApi from '@/services/conductApi';
import { 
  BarChart3,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Download,
  Loader2,
  GraduationCap,
  Calendar,
  Info
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  gradeItems?: {
    oral?: number[];
    quiz15?: number[];
    quiz45?: number[];
    midterm?: number[];
    final?: number[];
  };
  average: number | null; // Điểm TB (chỉ có nếu môn tính điểm TB)
  result: string | null; // "D" hoặc "K" (chỉ có nếu môn không tính điểm TB)
  computedAt: string;
}

interface ConductRecord {
  _id: string;
  year: string;
  semester: string;
  conduct: string;
  academicLevel: string | null;
  gpa: number;
  conductStatus?: 'draft' | 'pending' | 'approved' | 'locked';
}

interface TrendComparison {
  subjectId: string;
  subjectName: string;
  currentAverage: number | null;
  previousAverage: number | null;
  trend: number | null;
  trendPercentage: number | null;
}

const StudentGradesPage = () => {
  const { backendUser } = useAuth();
  const [grades, setGrades] = useState<GradeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [currentClass, setCurrentClass] = useState<{ className: string; grade: string; classCode?: string } | null>(null);
  const [conductRecords, setConductRecords] = useState<ConductRecord[]>([]);
  const [activeTab, setActiveTab] = useState<string>('HK2'); // Mặc định là HK2
  const [previousSemesterComparison, setPreviousSemesterComparison] = useState<{ semester: string; schoolYear: string; comparison: TrendComparison[] } | null>(null);
  const [previousYearComparison, setPreviousYearComparison] = useState<{ schoolYear: string; semester: string; comparison: TrendComparison[] } | null>(null);

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

  // Lấy thông tin lớp từ dữ liệu điểm hoặc từ student API
  useEffect(() => {
    const fetchStudentInfo = async () => {
      if (!backendUser) return;
      try {
        // Thử lấy từ dữ liệu điểm trước
        const currentYearGrades = grades.filter(g => 
          (!selectedYear || g.schoolYear === selectedYear)
        );
        
        if (currentYearGrades.length > 0 && currentYearGrades[0]?.class) {
          setCurrentClass({
            className: currentYearGrades[0].class.className,
            grade: currentYearGrades[0].class.grade,
            classCode: currentYearGrades[0].class.classCode,
          });
          return;
        }
        
        // Nếu không có trong điểm, lấy từ student API
        const studentApi = await import('@/services/studentApi');
        const students = await studentApi.default.getAll();
        const student = students.find((s: any) => 
          s.accountId?._id === backendUser._id || 
          s.accountId?._id?.toString() === backendUser._id?.toString() ||
          s.accountId === backendUser._id
        );
        
        if (student?.classId) {
          const classInfo = typeof student.classId === 'object' 
            ? student.classId 
            : null;
          if (classInfo) {
            setCurrentClass({
              className: classInfo.className || '',
              grade: classInfo.grade || '',
              classCode: classInfo.classCode || '',
            });
          }
        }
      } catch (err) {
        console.error('Error fetching student info:', err);
      }
    };

    if (grades.length > 0 || backendUser) {
      fetchStudentInfo();
    }
  }, [backendUser, grades, selectedYear]);

  useEffect(() => {
    fetchGrades();
  }, []); // Fetch điểm một lần khi component mount

  useEffect(() => {
    fetchConducts();
  }, [selectedYear]); // Fetch lại conduct khi đổi năm học

  const fetchGrades = async () => {
    try {
      setLoading(true);
      // Lấy điểm của cả 2 học kỳ với xu hướng
      const [hk1Res, hk2Res] = await Promise.all([
        gradesApi.getStudentGradesWithTrend({ semester: '1', schoolYear: selectedYear || undefined }),
        gradesApi.getStudentGradesWithTrend({ semester: '2', schoolYear: selectedYear || undefined }),
      ]);

      const allGrades: GradeSummary[] = [];
      if (hk1Res.success && hk1Res.data) {
        allGrades.push(...hk1Res.data);
      }
      if (hk2Res.success && hk2Res.data) {
        allGrades.push(...hk2Res.data);
        // Lưu so sánh HK2 với HK1
        if (hk2Res.previousSemesterComparison) {
          setPreviousSemesterComparison(hk2Res.previousSemesterComparison);
        }
        // Lưu so sánh với năm trước
        if (hk2Res.previousYearComparison) {
          setPreviousYearComparison(hk2Res.previousYearComparison);
        }
      }

      setGrades(allGrades);
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

  const fetchConducts = async () => {
    try {
      const params: any = {};
      if (selectedYear) {
        params.year = selectedYear;
      }
      const res = await conductApi.getConducts(params);
      if (res.success && res.data) {
        // ✅ Backend đã filter: học sinh chỉ nhận được hạnh kiểm đã được phê duyệt (approved/locked)
        // ✅ Thêm filter ở frontend như một lớp bảo vệ bổ sung (defense in depth)
        const filteredData = res.data
          .filter((r: any) => r.conductStatus === 'approved' || r.conductStatus === 'locked')
          .map((r: any) => ({
            _id: r._id,
            year: r.year,
            semester: r.semester, // "HK1", "HK2", "CN"
            conduct: r.conduct,
            academicLevel: r.academicLevel,
            gpa: r.gpa,
            conductStatus: r.conductStatus, // Lưu trạng thái để hiển thị
          }));
        setConductRecords(filteredData);
      } else {
        // Nếu không có dữ liệu, có thể do chưa được phê duyệt
        setConductRecords([]);
      }
    } catch (error: any) {
      console.error('Error fetching conducts:', error);
      // Nếu lỗi 403, có thể do hạnh kiểm chưa được phê duyệt
      if (error.response?.status === 403) {
        setConductRecords([]);
      }
    }
  };

  // Lọc điểm theo năm học
  const yearGrades = grades.filter(g => 
    (!selectedYear || g.schoolYear === selectedYear)
  );

  // Lọc điểm theo học kỳ
  const hk1Grades = yearGrades.filter(g => g.semester === '1');
  const hk2Grades = yearGrades.filter(g => g.semester === '2');

  // Tính điểm TB cả năm cho từng môn
  const yearAverageGrades = useMemo(() => {
    const subjectMap = new Map<string, { hk1: GradeSummary | null; hk2: GradeSummary | null }>();
    
    // Nhóm điểm theo môn học
    hk1Grades.forEach(grade => {
      const subjectId = grade.subject._id;
      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, { hk1: null, hk2: null });
      }
      subjectMap.get(subjectId)!.hk1 = grade;
    });
    
    hk2Grades.forEach(grade => {
      const subjectId = grade.subject._id;
      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, { hk1: null, hk2: null });
      }
      subjectMap.get(subjectId)!.hk2 = grade;
    });

    // Tính điểm TB cả năm
    return Array.from(subjectMap.entries()).map(([subjectId, { hk1, hk2 }]) => {
      const subject = hk1?.subject || hk2?.subject;
      if (!subject) return null;

      let yearAverage: number | null = null;
      let yearResult: string | null = null;

      if (subject.includeInAverage !== false) {
        // Môn tính điểm TB
        if (hk1?.average !== null && hk1?.average !== undefined && hk2?.average !== null && hk2?.average !== undefined) {
          yearAverage = (hk1.average + hk2.average) / 2;
        } else if (hk1?.average !== null && hk1?.average !== undefined) {
          yearAverage = hk1.average;
        } else if (hk2?.average !== null && hk2?.average !== undefined) {
          yearAverage = hk2.average;
        }
      } else {
        // Môn không tính điểm TB - xác định Đạt/Không đạt
        const hk1Result = hk1?.result;
        const hk2Result = hk2?.result;
        if (hk1Result === 'D' || hk2Result === 'D') {
          yearResult = 'D';
        } else if (hk1Result === 'K' && hk2Result === 'K') {
          yearResult = 'K';
        } else if (hk1Result || hk2Result) {
          yearResult = hk1Result || hk2Result;
        }
      }

      return {
        _id: `${subjectId}_year`,
        subject,
        class: hk1?.class || hk2?.class || null,
        schoolYear: hk1?.schoolYear || hk2?.schoolYear || displayYear,
        semester: 'CN',
        averages: {
          oral: hk1?.averages?.oral || hk2?.averages?.oral,
          quiz15: hk1?.averages?.quiz15 || hk2?.averages?.quiz15,
          quiz45: hk1?.averages?.quiz45 || hk2?.averages?.quiz45,
          midterm: hk1?.averages?.midterm || hk2?.averages?.midterm,
          final: hk1?.averages?.final || hk2?.averages?.final,
        },
        average: yearAverage,
        result: yearResult,
        computedAt: new Date().toISOString(),
        // Thêm điểm TB HK1 và HK2 để hiển thị trong bảng cả năm
        hk1Average: hk1?.average ?? null,
        hk2Average: hk2?.average ?? null,
      } as GradeSummary & { hk1Average?: number | null; hk2Average?: number | null };
    }).filter((g): g is GradeSummary => g !== null);
  }, [hk1Grades, hk2Grades, displayYear]);

  // Tính điểm trung bình chung cho từng học kỳ
  const calculateOverallAverage = (gradesList: GradeSummary[]) => {
    const validGrades = gradesList.filter(g => 
      g.subject.includeInAverage !== false && g.average !== null
    );
    if (validGrades.length === 0) return null;
    const sum = validGrades.reduce((acc, g) => acc + (g.average || 0), 0);
    return sum / validGrades.length;
  };

  // Tính điểm TB tất cả các môn cho từng học kỳ
  const overallHk1Average = useMemo(() => {
    return calculateOverallAverage(hk1Grades);
  }, [hk1Grades]);

  const overallHk2Average = useMemo(() => {
    return calculateOverallAverage(hk2Grades);
  }, [hk2Grades]);

  // Tính điểm TB tất cả các môn cả năm = (TB HK1 + TB HK2) / 2
  const overallYearAverage = useMemo(() => {
    if (overallHk1Average !== null && overallHk2Average !== null) {
      return (overallHk1Average + overallHk2Average) / 2;
    } else if (overallHk1Average !== null) {
      return overallHk1Average;
    } else if (overallHk2Average !== null) {
      return overallHk2Average;
    }
    return null;
  }, [overallHk1Average, overallHk2Average]);

  // Tự động lưu điểm TB cả năm lên backend
  useEffect(() => {
    const saveYearGPA = async () => {
      if (overallYearAverage === null || !displayYear || !backendUser) return;
      
      try {
        // Lấy studentId từ backendUser
        const studentApi = await import('@/services/studentApi');
        const students = await studentApi.default.getAll();
        const student = students.find((s: any) => 
          s.accountId?._id === backendUser._id || 
          s.accountId?._id?.toString() === backendUser._id?.toString() ||
          s.accountId === backendUser._id
        );
        
        if (!student?._id) return;

        // Tìm hoặc tạo StudentYearRecord cho cả năm
        const conductRes = await conductApi.getConducts({ 
          year: displayYear, 
          semester: 'CN',
          studentId: student._id 
        });
        
        if (conductRes.success && conductRes.data && conductRes.data.length > 0) {
          // Cập nhật record hiện có
          const record = conductRes.data[0];
          await conductApi.updateConduct(record._id, { gpa: overallYearAverage });
        } else {
          // Tạo mới record nếu chưa có
          // Lấy classId từ grades
          let classIdToUse: string | null = null;
          if (yearAverageGrades.length > 0 && yearAverageGrades[0]?.class?._id) {
            classIdToUse = yearAverageGrades[0].class._id;
          } else if (hk1Grades.length > 0 && hk1Grades[0]?.class?._id) {
            classIdToUse = hk1Grades[0].class._id;
          } else if (hk2Grades.length > 0 && hk2Grades[0]?.class?._id) {
            classIdToUse = hk2Grades[0].class._id;
          }
          
          if (classIdToUse) {
            await conductApi.createConduct({
              studentId: student._id,
              classId: classIdToUse,
              year: displayYear,
              semester: 'CN',
              gpa: overallYearAverage,
            });
          }
        }
      } catch (error: any) {
        console.error('Error saving year GPA:', error);
        // Không hiển thị toast vì đây là tự động lưu
      }
    };

    // Chỉ lưu khi có đủ dữ liệu và không đang loading
    if (!loading && overallYearAverage !== null && displayYear) {
      saveYearGPA();
    }
  }, [overallYearAverage, displayYear, backendUser, yearAverageGrades, hk1Grades, hk2Grades, loading]);

  // Tính số môn đạt/không đạt (cho môn không tínhTB)
  const getPassFailCount = (gradesList: GradeSummary[]) => {
    const nonAverageGrades = gradesList.filter(g => g.subject.includeInAverage === false);
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
    // Màu mới: Đỏ <5, Đen 5-6.5, Xanh lam 6.5-8, Xanh lục >8
    if (score > 8) return 'text-green-600'; // Xanh lục
    if (score >= 6.5) return 'text-blue-600'; // Xanh lam
    if (score >= 5) return 'text-foreground'; // Đen (màu chữ mặc định)
    return 'text-red-600'; // Đỏ
  };

  const renderScore = (score: number | null | undefined) => {
    if (score === null || score === undefined) return '-';
    return score.toFixed(1);
  };

  // 🎯 Lấy xu hướng điểm của môn học
  const getSubjectTrend = (subjectId: string, semester: 'HK1' | 'HK2') => {
    if (semester === 'HK2' && previousSemesterComparison) {
      const trend = previousSemesterComparison.comparison.find(
        (c) => String(c.subjectId) === String(subjectId)
      );
      return trend || null;
    }
    return null;
  };

  // 🎨 Lấy icon xu hướng
  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (trend < 0) return <TrendingDown className="h-3 w-3 text-red-600" />;
    return <Minus className="h-3 w-3 text-gray-500" />;
  };

  // 🎨 Lấy màu xu hướng
  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  // Lấy học lực và hạnh kiểm theo học kỳ/năm
  // ✅ Chỉ lấy hạnh kiểm đã được phê duyệt (approved/locked)
  const getConductInfo = (semester: 'HK1' | 'HK2' | 'CN') => {
    const record = conductRecords.find(r => 
      (!selectedYear || r.year === selectedYear) &&
      (semester === 'HK1' ? r.semester === 'HK1' : 
       semester === 'HK2' ? r.semester === 'HK2' : 
       r.semester === 'CN') &&
      // ✅ Đảm bảo chỉ lấy hạnh kiểm đã được phê duyệt
      (r.conductStatus === 'approved' || r.conductStatus === 'locked')
    );
    return {
      conduct: record?.conduct || null,
      academicLevel: record?.academicLevel || null,
      conductStatus: record?.conductStatus || null,
    };
  };

  // Component render bảng điểm
  const renderGradeTable = (
    title: string,
    gradesList: GradeSummary[],
    semester: 'HK1' | 'HK2' | 'CN',
    yearLabel: string
  ) => {
    const conductInfo = getConductInfo(semester);
    
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span>{title}</span>
                {yearLabel && <span className="text-muted-foreground">- {yearLabel}</span>}
              </CardTitle>
              <CardDescription className="mt-1">
                {gradesList.length > 0 && gradesList[0]?.class && (
                  <span>
                    Lớp: <strong className="text-foreground">{gradesList[0].class.className}</strong>
                    {gradesList[0].class.classCode && ` (${gradesList[0].class.classCode})`}
                    {' - '}
                    Khối <strong className="text-foreground">{gradesList[0].class.grade}</strong>
                  </span>
                )}
                {gradesList.length === 0 && !loading && 'Chi tiết điểm số các môn học'}
              </CardDescription>
            </div>
            {/* Học lực và Hạnh kiểm - Góc phải */}
            <div className="flex flex-col items-end gap-2 ml-4 min-w-[120px]">
              {conductInfo.academicLevel ? (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Học lực</p>
                  <Badge 
                    variant="outline" 
                    className={`font-semibold ${
                      conductInfo.academicLevel === 'Giỏi' ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950' :
                      conductInfo.academicLevel === 'Khá' ? 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950' :
                      conductInfo.academicLevel === 'Trung bình' ? 'border-yellow-500 text-yellow-700 bg-yellow-50 dark:bg-yellow-950' :
                      'border-red-500 text-red-700 bg-red-50 dark:bg-red-950'
                    }`}
                  >
                    {conductInfo.academicLevel}
                  </Badge>
                </div>
              ) : (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Học lực</p>
                  <Badge variant="outline" className="font-semibold text-muted-foreground">
                    Chưa có
                  </Badge>
                </div>
              )}
              {conductInfo.conduct ? (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Hạnh kiểm</p>
                  <Badge 
                    variant="outline" 
                    className={`font-semibold ${
                      conductInfo.conduct === 'Tốt' ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950' :
                      conductInfo.conduct === 'Khá' ? 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950' :
                      conductInfo.conduct === 'Trung bình' ? 'border-yellow-500 text-yellow-700 bg-yellow-50 dark:bg-yellow-950' :
                      'border-red-500 text-red-700 bg-red-50 dark:bg-red-950'
                    }`}
                  >
                    {conductInfo.conduct}
                  </Badge>
                </div>
              ) : (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Hạnh kiểm</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950 border-amber-300 cursor-help">
                          Chờ phê duyệt
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm font-medium">Hạnh kiểm đang chờ phê duyệt từ Ban Giám Hiệu</p>
                        <p className="text-xs text-muted-foreground mt-1">Sau khi được phê duyệt, hạnh kiểm sẽ hiển thị tại đây</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
              {/* Thông báo xét giấy khen cho bảng cả năm */}
              {semester === 'CN' && conductInfo.academicLevel && conductInfo.conduct && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs font-medium text-primary">
                    {conductInfo.academicLevel === 'Giỏi' && conductInfo.conduct === 'Tốt' 
                      ? '✅ Đủ điều kiện xét giấy khen'
                      : conductInfo.academicLevel === 'Khá' && conductInfo.conduct === 'Tốt'
                      ? '✅ Đủ điều kiện xét giấy khen'
                      : '📋 Xem xét điều kiện xét giấy khen'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Đang tải điểm số...</p>
            </div>
          ) : gradesList.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {selectedYear ? `Năm học ${selectedYear} chưa có điểm số` : 'Chưa có điểm số'}
              </h3>
              <p className="text-muted-foreground">
                {selectedYear 
                  ? `Bạn chưa có điểm số cho năm học ${selectedYear}. Điểm số sẽ được cập nhật khi giáo viên nhập điểm.`
                  : 'Điểm số sẽ được cập nhật khi giáo viên nhập điểm.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left font-medium text-muted-foreground">Môn học</th>
                    {semester === 'CN' ? (
                      <>
                        <th className="p-3 text-center font-medium text-muted-foreground">ĐTB HK1</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">ĐTB HK2</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">ĐTB cả năm</th>
                      </>
                    ) : (
                      <>
                        <th className="p-3 text-center font-medium text-muted-foreground">Miệng</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">15 phút</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">1 tiết</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">Giữa kỳ</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">Cuối kỳ</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">ĐTB môn</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">Kết quả</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {gradesList.map((grade, index) => (
                    <tr key={grade._id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{grade.subject.name}</span>
                            {grade.subject.includeInAverage === false && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-xs cursor-help">
                                      Đánh giá nhận xét
                                      <Info className="h-3 w-3 ml-1 inline" />
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-sm">
                                      Môn này <strong>không tính vào điểm trung bình</strong>. 
                                      Kết quả đánh giá: <strong>Đạt (D)</strong> hoặc <strong>Không đạt (K)</strong>.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </td>
                      {semester === 'CN' ? (
                        <>
                          {/* Bảng cả năm - chỉ hiển thị điểm TB */}
                          <td className="p-3 text-center">
                            {grade.subject.includeInAverage !== false ? (
                              <Badge 
                                variant="outline" 
                                className={`${getGradeColor((grade as any).hk1Average)} border-current font-semibold`}
                              >
                                {(grade as any).hk1Average !== null && (grade as any).hk1Average !== undefined 
                                  ? (grade as any).hk1Average.toFixed(1) 
                                  : '-'
                                }
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {grade.subject.includeInAverage !== false ? (
                              <Badge 
                                variant="outline" 
                                className={`${getGradeColor((grade as any).hk2Average)} border-current font-semibold`}
                              >
                                {(grade as any).hk2Average !== null && (grade as any).hk2Average !== undefined 
                                  ? (grade as any).hk2Average.toFixed(1) 
                                  : '-'
                                }
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {grade.subject.includeInAverage !== false ? (
                              <div className="flex flex-col items-center gap-1">
                                <Badge 
                                  variant="outline" 
                                  className={`${getGradeColor(grade.average)} border-current font-semibold`}
                                >
                                  {grade.average !== null ? grade.average.toFixed(1) : '-'}
                                </Badge>
                                {/* Hiển thị xu hướng */}
                                {(() => {
                                  const trend = getSubjectTrend(grade.subject._id, semester as 'HK1' | 'HK2');
                                  if (trend && trend.trend !== null && trend.trend !== undefined) {
                                    return (
                                      <div className="flex items-center gap-1 text-xs">
                                        {getTrendIcon(trend.trend)}
                                        <span className={getTrendColor(trend.trend)}>
                                          {trend.trend > 0 ? '+' : ''}{trend.trend.toFixed(1)}
                                        </span>
                                        {trend.trendPercentage !== null && (
                                          <span className={`text-xs ${getTrendColor(trend.trend)}`}>
                                            ({trend.trendPercentage > 0 ? '+' : ''}{trend.trendPercentage.toFixed(1)}%)
                                          </span>
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Badge 
                                  variant={grade.result === 'D' ? 'default' : grade.result === 'K' ? 'destructive' : 'outline'}
                                  className="font-semibold"
                                >
                                  {grade.result === 'D' ? 'Đạt' : grade.result === 'K' ? 'Không đạt' : '-'}
                                </Badge>
                                {grade.result && (
                                  <span className="text-xs text-muted-foreground">
                                    ({grade.result})
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Bảng HK1/HK2 - hiển thị chi tiết */}
                          <td className="p-3 text-center">
                            {grade.gradeItems?.oral && grade.gradeItems.oral.length > 0 ? (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {grade.gradeItems.oral.map((score, idx) => (
                                  <span key={idx} className={getGradeColor(score)}>
                                    {score.toFixed(1)}
                                    {idx < grade.gradeItems!.oral!.length - 1 && <span className="text-muted-foreground">,</span>}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={getGradeColor(grade.averages?.oral)}>
                                {renderScore(grade.averages?.oral)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {grade.gradeItems?.quiz15 && grade.gradeItems.quiz15.length > 0 ? (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {grade.gradeItems.quiz15.map((score, idx) => (
                                  <span key={idx} className={getGradeColor(score)}>
                                    {score.toFixed(1)}
                                    {idx < grade.gradeItems!.quiz15!.length - 1 && <span className="text-muted-foreground">,</span>}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={getGradeColor(grade.averages?.quiz15)}>
                                {renderScore(grade.averages?.quiz15)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {grade.gradeItems?.quiz45 && grade.gradeItems.quiz45.length > 0 ? (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {grade.gradeItems.quiz45.map((score, idx) => (
                                  <span key={idx} className={getGradeColor(score)}>
                                    {score.toFixed(1)}
                                    {idx < grade.gradeItems!.quiz45!.length - 1 && <span className="text-muted-foreground">,</span>}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={getGradeColor(grade.averages?.quiz45)}>
                                {renderScore(grade.averages?.quiz45)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {grade.gradeItems?.midterm && grade.gradeItems.midterm.length > 0 ? (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {grade.gradeItems.midterm.map((score, idx) => (
                                  <span key={idx} className={getGradeColor(score)}>
                                    {score.toFixed(1)}
                                    {idx < grade.gradeItems!.midterm!.length - 1 && <span className="text-muted-foreground">,</span>}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={getGradeColor(grade.averages?.midterm)}>
                                {renderScore(grade.averages?.midterm)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {grade.gradeItems?.final && grade.gradeItems.final.length > 0 ? (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {grade.gradeItems.final.map((score, idx) => (
                                  <span key={idx} className={getGradeColor(score)}>
                                    {score.toFixed(1)}
                                    {idx < grade.gradeItems!.final!.length - 1 && <span className="text-muted-foreground">,</span>}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={getGradeColor(grade.averages?.final)}>
                                {renderScore(grade.averages?.final)}
                              </span>
                            )}
                          </td>
                          {/* Cột ĐTB môn (tính theo hệ số) */}
                          <td className="p-3 text-center">
                            {grade.subject.includeInAverage !== false ? (
                              <div className="flex flex-col items-center gap-1">
                                <Badge 
                                  variant="outline" 
                                  className={`${getGradeColor(grade.average)} border-current font-semibold`}
                                >
                                  {grade.average !== null ? grade.average.toFixed(1) : '-'}
                                </Badge>
                                {/* Hiển thị xu hướng */}
                                {(() => {
                                  const trend = getSubjectTrend(grade.subject._id, semester as 'HK1' | 'HK2');
                                  if (trend && trend.trend !== null && trend.trend !== undefined) {
                                    return (
                                      <div className="flex items-center gap-1 text-xs">
                                        {getTrendIcon(trend.trend)}
                                        <span className={getTrendColor(trend.trend)}>
                                          {trend.trend > 0 ? '+' : ''}{trend.trend.toFixed(1)}
                                        </span>
                                        {trend.trendPercentage !== null && (
                                          <span className={`text-xs ${getTrendColor(trend.trend)}`}>
                                            ({trend.trendPercentage > 0 ? '+' : ''}{trend.trendPercentage.toFixed(1)}%)
                                          </span>
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          {/* Cột Kết quả (Đạt/Không đạt cho môn không tính điểm TB) */}
                          <td className="p-3 text-center">
                            {grade.subject.includeInAverage !== false ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Badge 
                                  variant={grade.result === 'D' ? 'default' : grade.result === 'K' ? 'destructive' : 'outline'}
                                  className="font-semibold"
                                >
                                  {grade.result === 'D' ? 'Đạt' : grade.result === 'K' ? 'Không đạt' : '-'}
                                </Badge>
                                {grade.result && (
                                  <span className="text-xs text-muted-foreground">
                                    ({grade.result})
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {/* Hàng hiển thị điểm TB tất cả các môn - cho HK1, HK2 và cả năm */}
                  {(semester === 'HK1' || semester === 'HK2') && (
                    <tr className="bg-primary/10 border-t-2 border-primary">
                      <td className="p-3 font-semibold" colSpan={6}>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <span>Điểm trung bình tất cả các môn</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge 
                          variant="outline" 
                          className={`${getGradeColor(
                            semester === 'HK1' ? overallHk1Average : overallHk2Average
                          )} border-current font-semibold text-base px-4 py-2`}
                        >
                          {semester === 'HK1' 
                            ? (overallHk1Average !== null ? overallHk1Average.toFixed(1) : '-')
                            : (overallHk2Average !== null ? overallHk2Average.toFixed(1) : '-')
                          }
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-muted-foreground">-</span>
                      </td>
                    </tr>
                  )}
                  {/* Hàng hiển thị điểm TB tất cả các môn - cho bảng cả năm */}
                  {semester === 'CN' && (
                    <tr className="bg-primary/10 border-t-2 border-primary">
                      <td className="p-3 font-semibold">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <span>Điểm trung bình tất cả các môn</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge 
                          variant="outline" 
                          className={`${getGradeColor(overallHk1Average)} border-current font-semibold`}
                        >
                          {overallHk1Average !== null ? overallHk1Average.toFixed(1) : '-'}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge 
                          variant="outline" 
                          className={`${getGradeColor(overallHk2Average)} border-current font-semibold`}
                        >
                          {overallHk2Average !== null ? overallHk2Average.toFixed(1) : '-'}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge 
                          variant="outline" 
                          className={`${getGradeColor(overallYearAverage)} border-current font-semibold text-base px-4 py-2`}
                        >
                          {overallYearAverage !== null ? overallYearAverage.toFixed(1) : '-'}
                        </Badge>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
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

        {/* Thông tin lớp - Hiển thị nổi bật */}
        {currentClass && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Lớp hiện tại</p>
                    <p className="text-lg font-semibold text-foreground">
                      {currentClass.className}
                      {currentClass.classCode && ` (${currentClass.classCode})`}
                    </p>
                  </div>
                </div>
                {currentClass.grade && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm">
                      Khối {currentClass.grade}
                    </Badge>
                  </div>
                )}
                {displayYear && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Năm học: <strong>{displayYear}</strong></span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters - Chỉ còn năm học */}
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
          </div>
        </CardContent>
      </Card>

      {/* Kiểm tra nếu không có dữ liệu cho năm học đã chọn */}
      {selectedYear && yearGrades.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Năm học {selectedYear} chưa có điểm số
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Bạn chưa có điểm số cho năm học <strong>{selectedYear}</strong>. 
              Điểm số sẽ được cập nhật khi giáo viên nhập điểm.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Bảng điểm chi tiết</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="HK1">
                  Học kỳ 1{displayYear ? `, ${displayYear}` : ''}
                </TabsTrigger>
                <TabsTrigger value="HK2">
                  Học kỳ 2{displayYear ? `, ${displayYear}` : ''}
                </TabsTrigger>
                <TabsTrigger value="CN">
                  Cả năm
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="HK1" className="mt-4">
                {/* Summary boxes - hiển thị trong tab HK1 */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  {/* 2 hộp xám bên trái */}
                  <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    {/* Học lực HK1 */}
                    <Card className="bg-muted/50 flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <GraduationCap className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Học lực học kỳ 1</p>
                            <p className="text-lg font-semibold">
                              {getConductInfo('HK1').academicLevel || 'Chưa có'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Hạnh kiểm HK1 */}
                    <Card className="bg-muted/50 flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Award className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Hạnh kiểm học kỳ 1</p>
                            <p className="text-lg font-semibold">
                              {getConductInfo('HK1').conduct || 'Chưa có'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Hộp xanh bên phải */}
                  <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="text-sm text-muted-foreground">Điểm TB chung học kỳ 1</p>
                          <p className={`text-2xl font-bold text-blue-600 dark:text-blue-400`}>
                            {overallHk1Average !== null ? overallHk1Average.toFixed(1) : '-'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {renderGradeTable(
                  'Bảng điểm học kỳ 1',
                  hk1Grades,
                  'HK1',
                  displayYear
                )}
              </TabsContent>
              
              <TabsContent value="HK2" className="mt-4">
                {/* Summary boxes - hiển thị trong tab HK2 */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  {/* 2 hộp xám bên trái */}
                  <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    {/* Học lực HK2 */}
                    <Card className="bg-muted/50 flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <GraduationCap className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Học lực học kỳ 2</p>
                            <p className="text-lg font-semibold">
                              {getConductInfo('HK2').academicLevel || 'Chưa có'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Hạnh kiểm HK2 */}
                    <Card className="bg-muted/50 flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Award className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Hạnh kiểm học kỳ 2</p>
                            <p className="text-lg font-semibold">
                              {getConductInfo('HK2').conduct || 'Chưa có'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Hộp xanh bên phải */}
                  <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="text-sm text-muted-foreground">Điểm TB chung học kỳ 2</p>
                          <p className={`text-2xl font-bold text-blue-600 dark:text-blue-400`}>
                            {overallHk2Average !== null ? overallHk2Average.toFixed(1) : '-'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {renderGradeTable(
                  'Bảng điểm học kỳ 2',
                  hk2Grades,
                  'HK2',
                  displayYear
                )}
              </TabsContent>
              
              <TabsContent value="CN" className="mt-4">
                {/* Summary boxes - hiển thị trong tab CN */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  {/* 2 hộp xám bên trái */}
                  <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    {/* Học lực cả năm */}
                    <Card className="bg-muted/50 flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <GraduationCap className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Học lực cả năm</p>
                            <p className="text-lg font-semibold">
                              {getConductInfo('CN').academicLevel || 'Chưa có'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Hạnh kiểm cả năm */}
                    <Card className="bg-muted/50 flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Award className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Hạnh kiểm cả năm</p>
                            <p className="text-lg font-semibold">
                              {getConductInfo('CN').conduct || 'Chưa có'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Hộp xanh bên phải */}
                  <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="text-sm text-muted-foreground">Điểm TB chung cả năm</p>
                          <p className={`text-2xl font-bold text-blue-600 dark:text-blue-400`}>
                            {overallYearAverage !== null ? overallYearAverage.toFixed(1) : '-'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Bảng điểm cả năm - layout đặc biệt */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Bảng điểm Chi tiết các Môn học</h3>
                  {loading ? (
                    <div className="p-12 text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-muted-foreground">Đang tải điểm số...</p>
                    </div>
                  ) : yearAverageGrades.length === 0 ? (
                    <div className="p-12 text-center">
                      <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Chưa có điểm số</h3>
                      <p className="text-muted-foreground">
                        Điểm số sẽ được cập nhật khi giáo viên nhập điểm.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 text-left font-medium text-muted-foreground">Môn học</th>
                            <th className="p-3 text-center font-medium text-muted-foreground">Điểm TB Học kỳ 1</th>
                            <th className="p-3 text-center font-medium text-muted-foreground">Điểm TB Học kỳ 2</th>
                            <th className="p-3 text-center font-medium text-muted-foreground">Điểm Tổng kết Cả năm</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yearAverageGrades.map((grade, index) => (
                            <tr key={grade._id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                              <td className="p-3">
                                <div className="flex items-center space-x-2">
                                  <BookOpen className="h-4 w-4 text-primary" />
                                  <span className="font-medium">{grade.subject.name}</span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                {grade.subject.includeInAverage !== false ? (
                                  <span className={getGradeColor((grade as any).hk1Average)}>
                                    {(grade as any).hk1Average !== null && (grade as any).hk1Average !== undefined 
                                      ? (grade as any).hk1Average.toFixed(1) 
                                      : '-'
                                    }
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {grade.subject.includeInAverage !== false ? (
                                  <span className={getGradeColor((grade as any).hk2Average)}>
                                    {(grade as any).hk2Average !== null && (grade as any).hk2Average !== undefined 
                                      ? (grade as any).hk2Average.toFixed(1) 
                                      : '-'
                                    }
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {grade.subject.includeInAverage !== false ? (
                                  <span className={`font-bold ${getGradeColor(grade.average)}`}>
                                    {grade.average !== null ? grade.average.toFixed(1) : '-'}
                                  </span>
                                ) : (
                                  <span className="font-bold text-green-600">
                                    {grade.result === 'D' ? 'Đạt' : grade.result === 'K' ? 'Không đạt' : '-'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentGradesPage;

