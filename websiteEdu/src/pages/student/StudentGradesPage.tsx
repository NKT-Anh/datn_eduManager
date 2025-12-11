import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import gradesApi from '@/services/gradesApi';
import conductApi from '@/services/conductApi';
import gradeConfigApi from '@/services/gradeConfigApi';
import { 
  BarChart3,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Loader2,
  GraduationCap,
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
  gradeItemLogs?: {
    oral?: { score: number; attempt?: number; teacher?: { _id?: string; name?: string; code?: string } | null; date?: string }[];
    quiz15?: { score: number; attempt?: number; teacher?: { _id?: string; name?: string; code?: string } | null; date?: string }[];
    quiz45?: { score: number; attempt?: number; teacher?: { _id?: string; name?: string; code?: string } | null; date?: string }[];
    midterm?: { score: number; attempt?: number; teacher?: { _id?: string; name?: string; code?: string } | null; date?: string }[];
    final?: { score: number; attempt?: number; teacher?: { _id?: string; name?: string; code?: string } | null; date?: string }[];
  };
  average: number | null; // Điểm TB (chỉ có nếu môn tính điểm TB)
  result: string | null; // "D" hoặc "K" (chỉ có nếu môn không tính điểm TB)
  computedAt: string;
  isOfficial?: boolean;
  officialAt?: string | null;
  officialBy?: string | null;
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
  const [studentId, setStudentId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [gradeConfig, setGradeConfig] = useState<{
    weights: Record<string, number>;
    columnCounts?: Record<string, number>;
    rounding: 'half-up' | 'none';
    classification?: {
      excellent: { minAverage: number; minSubjectScore: number };
      good: { minAverage: number; minSubjectScore: number };
      average: { minAverage: number; minSubjectScore: number };
      weak: { maxAverage: number; maxSubjectScore?: number };
    };
  } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  // Helper: current school year string and semester
  const getCurrentSchoolYear = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1; // 1-12
    // School year starts in Sep (9)
    return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  };
  const getCurrentSemesterTab = () => {
    const m = new Date().getMonth() + 1;
    if (m >= 9 || m === 12) return 'HK1';
    if (m >= 1 && m <= 5) return 'HK2';
    return 'CN'; // summer: show yearly summary
  };

  const [selectedYear, setSelectedYear] = useState<string>(getCurrentSchoolYear());
  const [currentClass, setCurrentClass] = useState<{ className: string; grade: string; classCode?: string } | null>(null);
  const [conductRecords, setConductRecords] = useState<ConductRecord[]>([]);
  const [activeTab, setActiveTab] = useState<string>(getCurrentSemesterTab()); // Mặc định: học kỳ hiện tại
  const [previousSemesterComparison, setPreviousSemesterComparison] = useState<{ semester: string; schoolYear: string; comparison: TrendComparison[] } | null>(null);
  const [previousYearComparison, setPreviousYearComparison] = useState<{ schoolYear: string; semester: string; comparison: TrendComparison[] } | null>(null);

  // Lấy danh sách năm học từ điểm (unique schoolYear) - chỉ khi đã có dữ liệu
  const schoolYears = grades.length > 0 
    ? Array.from(new Set(grades.map(g => g.schoolYear))).sort().reverse()
    : [];
  const displayYear = selectedYear || schoolYears[0] || '';
  
  // Nếu chưa chọn năm học và có dữ liệu, tự động chọn năm học mới nhất
  useEffect(() => {
    if (!loading && schoolYears.length > 0) {
      const prefer = schoolYears.includes(getCurrentSchoolYear())
        ? getCurrentSchoolYear()
        : schoolYears[0];
      if (!selectedYear || !schoolYears.includes(selectedYear)) {
        setSelectedYear(prefer);
      }
    }
  }, [schoolYears, loading]);

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
          if ((currentYearGrades[0].class as any)?._id) {
            setClassId(String((currentYearGrades[0].class as any)._id));
          }
        }
        
        // Nếu không có trong điểm, lấy từ student API
        const studentApi = await import('@/services/studentApi');
        const students = await studentApi.default.getAll();
        const student = students.find((s: any) => 
          s.accountId?._id === backendUser._id || 
          s.accountId?._id?.toString() === backendUser._id?.toString() ||
          s.accountId === backendUser._id
        );
        
        if (student?._id) setStudentId(String(student._id));
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
            if (classInfo._id) setClassId(String(classInfo._id));
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
  }, [selectedYear]); // Refetch khi đổi năm học

  useEffect(() => {
    fetchConducts();
  }, [selectedYear]); // Fetch lại conduct khi đổi năm học

  const fetchGrades = async () => {
    try {
      setLoading(true);
      // Lấy điểm của cả 2 học kỳ với xu hướng
      const [hk1Res, hk2Res] = await Promise.all([
        (gradesApi as any).getStudentGradesWithTrend({ semester: '1', schoolYear: selectedYear || undefined }),
        (gradesApi as any).getStudentGradesWithTrend({ semester: '2', schoolYear: selectedYear || undefined }),
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

  // 🔧 Lấy cấu hình điểm theo năm học + học kỳ (chỉ cho HK1/HK2)
  useEffect(() => {
    const loadConfig = async () => {
      try {
        if (!selectedYear) {
          setGradeConfig(null);
          return;
        }
        // Luôn lấy config: HK1 -> '1', HK2 -> '2', CN -> ưu tiên '2' để có classification
        const semesterParam = activeTab === 'HK1' ? '1' : activeTab === 'HK2' ? '2' : '2';
        setLoadingConfig(true);
        const res = await gradeConfigApi.getConfig({ schoolYear: selectedYear, semester: semesterParam });
        const cfg = res.data || res;
        if (cfg && cfg.weights) {
          setGradeConfig({
            weights: cfg.weights,
            columnCounts: cfg.columnCounts,
            rounding: cfg.rounding || 'half-up',
            classification: cfg.classification,
          });
        } else {
          setGradeConfig({
            weights: { oral: 1, quiz15: 1, quiz45: 2, midterm: 2, final: 3 },
            rounding: 'half-up',
          });
        }
      } catch (e) {
        // Fallback cấu hình mặc định
        setGradeConfig({
          weights: { oral: 1, quiz15: 1, quiz45: 2, midterm: 2, final: 3 },
          rounding: 'half-up',
        });
      } finally {
        setLoadingConfig(false);
      }
    };
    loadConfig();
  }, [selectedYear, activeTab]);

  // ✅ GPA học kỳ từ backend (chỉ hiện khi đủ môn)
  const [gpaHK1, setGpaHK1] = useState<number | null>(null);
  const [gpaHK2, setGpaHK2] = useState<number | null>(null);

  useEffect(() => {
    const fetchSemesterGPA = async () => {
      try {
        if (!classId || !selectedYear) {
          setGpaHK1(null);
          setGpaHK2(null);
          return;
        }
        const [res1, res2] = await Promise.all([
          (gradesApi as any).getClassSemesterGPA({ classId, schoolYear: selectedYear, semester: '1' }),
          (gradesApi as any).getClassSemesterGPA({ classId, schoolYear: selectedYear, semester: '2' }),
        ]);
        const sid = studentId;
        const pick = (res: any): number | null => {
          const list = res?.data || [];
          if (!sid) return null;
          const row = list.find((r: any) => String(r.studentId) === String(sid));
          return typeof row?.gpa === 'number' ? row.gpa : null;
        };
        setGpaHK1(pick(res1));
        setGpaHK2(pick(res2));
      } catch (e) {
        console.warn('Không lấy được GPA học kỳ', e);
        setGpaHK1(null);
        setGpaHK2(null);
      }
    };
    fetchSemesterGPA();
  }, [classId, selectedYear, studentId]);

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

      const hk1IsOfficial = hk1?.isOfficial === true;
      const hk2IsOfficial = hk2?.isOfficial === true;
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
        isOfficial: hk1IsOfficial && hk2IsOfficial,
        // Thêm điểm TB HK1 và HK2 để hiển thị trong bảng cả năm
        hk1Average: hk1?.average ?? null,
        hk2Average: hk2?.average ?? null,
        hk1IsOfficial,
        hk2IsOfficial,
      } as GradeSummary & { hk1Average?: number | null; hk2Average?: number | null; hk1IsOfficial?: boolean; hk2IsOfficial?: boolean };
    }).filter((g): g is GradeSummary => g !== null);
  }, [hk1Grades, hk2Grades, displayYear]);

  // Tính điểm trung bình chung cho từng học kỳ (chỉ tính từ các môn đã được công bố)
  const calculateOverallAverage = (gradesList: GradeSummary[]) => {
    // ✅ Chỉ tính từ các môn đã được công bố (isOfficial === true)
    const validGrades = gradesList.filter(g => 
      g.subject.includeInAverage !== false && 
      g.average !== null && 
      g.isOfficial === true
    );
    if (validGrades.length === 0) return null;
    const sum = validGrades.reduce((acc, g) => acc + (g.average || 0), 0);
    return sum / validGrades.length;
  };

  // Tính điểm TB tất cả các môn cho từng học kỳ
  // ✅ Ưu tiên dùng GPA từ backend (đã kiểm tra isOfficial), nếu không có thì tính từ các môn đã công bố
  const overallHk1Average = gpaHK1 !== null ? gpaHK1 : calculateOverallAverage(hk1Grades);
  const overallHk2Average = gpaHK2 !== null ? gpaHK2 : calculateOverallAverage(hk2Grades);

  // Tính điểm TB tất cả các môn cả năm = (TB HK1 + TB HK2) / 2
  const overallYearAverage = useMemo(() => {
    if (overallHk1Average !== null && overallHk2Average !== null) {
      return (overallHk1Average + overallHk2Average) / 2;
    }
    return null;
  }, [overallHk1Average, overallHk2Average]);

  // ✅ Chỉ coi ĐTB môn là chính thức khi đã được công bố (isOfficial)
  const isOfficialAverage = (g: GradeSummary | (GradeSummary & { hk1Average?: number | null; hk2Average?: number | null; hk1IsOfficial?: boolean; hk2IsOfficial?: boolean })) => {
    if (!g || g.subject?.includeInAverage === false) return false;
    // Trường hợp render theo học kỳ hiện tại
    if (g.average !== undefined) {
      return g.average !== null && (g as any).isOfficial === true;
    }
    return false;
  };

  // 🧮 Tính học lực dự kiến (dựa trên điểm TB và ngưỡng trong gradeConfig)
  const computeProvisionalAcademicLevel = (
    gradesList: GradeSummary[],
    overallAverage: number | null
  ): string | null => {
    const cls = gradeConfig?.classification;
    if (!cls || overallAverage === null) return null;
    // Tính điểm TB tối thiểu của từng môn (chỉ các môn tính TB)
    const subjectAverages = gradesList
      .filter(g => g.subject.includeInAverage !== false && g.average !== null)
      .map(g => g.average as number);
    if (subjectAverages.length === 0) return null;
    const minSubjectAvg = Math.min(...subjectAverages);

    // Xác định học lực dựa trên ngưỡng
    if (
      overallAverage >= (cls.excellent?.minAverage ?? 8) &&
      minSubjectAvg >= (cls.excellent?.minSubjectScore ?? 6.5)
    ) return 'Giỏi';

    if (
      overallAverage >= (cls.good?.minAverage ?? 6.5) &&
      minSubjectAvg >= (cls.good?.minSubjectScore ?? 5.0)
    ) return 'Khá';

    if (
      overallAverage >= (cls.average?.minAverage ?? 5.0) &&
      minSubjectAvg > (cls.average?.minSubjectScore ?? 3.5)
    ) return 'Trung bình';

    return 'Yếu';
  };

  const provisionalHK1 = null;
  const provisionalHK2 = null;
  const provisionalCN = null;

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

    // Chỉ lưu khi có đủ dữ liệu (đã có GPA HK1 & HK2) và không đang loading
    if (!loading && overallYearAverage !== null && displayYear) {
      saveYearGPA();
    }
  }, [overallYearAverage, displayYear, backendUser, loading]);

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

  // 🔤 Nhãn thành phần điểm + danh sách component đang bật theo cấu hình
  const componentLabels: Record<string, string> = {
    oral: 'Miệng',
    quiz15: '15 phút',
    quiz45: '45 phút',
    midterm: 'Giữa kỳ',
    final: 'Cuối kỳ',
  };

  const activeComponents: string[] = useMemo(() => {
    if (!gradeConfig?.weights) return [];
    return Object.entries(gradeConfig.weights)
      .filter(([_, w]) => (w ?? 0) > 0)
      .map(([k]) => k);
  }, [gradeConfig]);

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
    const MobileItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
      <div className="flex items-start justify-between py-1">
        <span className="text-sm text-muted-foreground mr-3">{label}</span>
        <div className="text-sm font-medium text-right">{value}</div>
      </div>
    );
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>{title}</span>
          </CardTitle>
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
            <>
              {/* Cấu hình điểm (chỉ HK1/HK2) */}
              {(semester === 'HK1' || semester === 'HK2') && gradeConfig && (
                <div className="mx-3 my-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                    Cấu hình điểm: {activeComponents.map((comp) => `${componentLabels[comp] || comp} (×${gradeConfig.weights[comp]})`).join(' + ')}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Làm tròn: {gradeConfig.rounding === 'half-up' ? 'Làm tròn 0.5 lên' : 'Không làm tròn'}
                  </p>
                </div>
              )}
              {/* Desktop/tablet: bảng chi tiết */}
              <div className="hidden sm:block overflow-x-auto">
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
                          {activeComponents.map((comp) => (
                            <th key={comp} className="p-3 text-center font-medium text-muted-foreground">
                              {componentLabels[comp] || comp}
                              {gradeConfig?.weights?.[comp] !== undefined && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (×{gradeConfig.weights[comp]})
                                </span>
                              )}
                            </th>
                          ))}
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
                            <td className="p-3 text-center">
                              {grade.subject.includeInAverage !== false ? (
                                <Badge 
                                  variant="outline" 
                                  className={`${getGradeColor((grade as any).hk1Average)} border-current font-semibold`}
                                >
                                  {((grade as any).hk1Average !== null && (grade as any).hk1Average !== undefined && (grade as any).hk1IsOfficial)
                                    ? (grade as any).hk1Average.toFixed(1)
                                    : '-'}
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
                                  {((grade as any).hk2Average !== null && (grade as any).hk2Average !== undefined && (grade as any).hk2IsOfficial)
                                    ? (grade as any).hk2Average.toFixed(1)
                                    : '-'}
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
                                    {isOfficialAverage(grade) ? grade.average!.toFixed(1) : '-'}
                                  </Badge>
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
                            {activeComponents.map((comp) => {
                              const logs = (grade.gradeItemLogs?.[comp as keyof NonNullable<typeof grade.gradeItemLogs>] as any[] | undefined) || [];
                              const latest = logs
                                .slice()
                                .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())[0];
                              const latestLabel = latest && latest.teacher ? `${latest.teacher.name || ''}${latest.teacher.code ? ` (${latest.teacher.code})` : ''}` : null;
                              const latestDate = latest?.date ? new Date(latest.date).toLocaleDateString('vi-VN') : null;
                              return (
                                <td key={comp} className="p-3 text-center">
                                  {grade.gradeItems?.[comp as keyof NonNullable<typeof grade.gradeItems>] && (grade.gradeItems?.[comp as keyof NonNullable<typeof grade.gradeItems>] as number[])?.length > 0 ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="flex flex-wrap gap-1 justify-center">
                                        {(grade.gradeItems?.[comp as keyof NonNullable<typeof grade.gradeItems>] as number[]).map((score: number, idx: number) => (
                                          <span key={idx} className={getGradeColor(score)}>
                                            {score.toFixed(1)}
                                            {idx < (grade.gradeItems?.[comp as keyof NonNullable<typeof grade.gradeItems>] as number[]).length - 1 && <span className="text-muted-foreground">,</span>}
                                          </span>
                                        ))}
                                      </div>
                                      {latestLabel && (
                                        <div className="text-[10px] text-muted-foreground">GV nhập: {latestLabel}{latestDate ? ` · ${latestDate}` : ''}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className={getGradeColor(grade.averages?.[comp as keyof NonNullable<typeof grade.averages>] as number | undefined)}>
                                        {renderScore(grade.averages?.[comp as keyof NonNullable<typeof grade.averages>] as number | undefined)}
                                      </span>
                                      {latestLabel && (
                                        <div className="text-[10px] text-muted-foreground">GV nhập: {latestLabel}{latestDate ? ` · ${latestDate}` : ''}</div>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="p-3 text-center">
                              {grade.subject.includeInAverage !== false ? (
                                <div className="flex flex-col items-center gap-1">
                                  <Badge 
                                    variant="outline" 
                                    className={`${getGradeColor(grade.average)} border-current font-semibold`}
                                  >
                                    {isOfficialAverage(grade) ? grade.average!.toFixed(1) : '-'}
                                  </Badge>
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
                    {(semester === 'HK1' || semester === 'HK2') && (
                      <tr className="bg-primary/10 border-t-2 border-primary">
                        <td className="p-3 font-semibold" colSpan={1 + activeComponents.length}>
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

              {/* Mobile: thẻ gọn cho từng môn */}
              <div className="block sm:hidden space-y-3">
                {gradesList.map((grade) => (
                  <div key={grade._id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{grade.subject.name}</span>
                      </div>
                      {grade.subject.includeInAverage === false && (
                        <Badge variant="outline" className="text-[10px]">Đánh giá nhận xét</Badge>
                      )}
                    </div>

                    {semester === 'CN' ? (
                      <div className="mt-2 space-y-1">
                        <MobileItem
                          label="ĐTB HK1"
                          value={grade.subject.includeInAverage !== false ? (
                            <span className={getGradeColor((grade as any).hk1Average)}>
                              {((grade as any).hk1Average !== null && (grade as any).hk1Average !== undefined && (grade as any).hk1IsOfficial) ? (grade as any).hk1Average.toFixed(1) : '-'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        />
                        <MobileItem
                          label="ĐTB HK2"
                          value={grade.subject.includeInAverage !== false ? (
                            <span className={getGradeColor((grade as any).hk2Average)}>
                              {((grade as any).hk2Average !== null && (grade as any).hk2Average !== undefined && (grade as any).hk2IsOfficial) ? (grade as any).hk2Average.toFixed(1) : '-'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        />
                        <MobileItem
                          label="Cả năm"
                          value={grade.subject.includeInAverage !== false ? (
                            <Badge variant="outline" className={`${getGradeColor(grade.average)} border-current`}>
                              {isOfficialAverage(grade) ? grade.average!.toFixed(1) : '-'}
                            </Badge>
                          ) : (
                            <Badge variant={grade.result === 'D' ? 'default' : grade.result === 'K' ? 'destructive' : 'outline'}>
                              {grade.result === 'D' ? 'Đạt' : grade.result === 'K' ? 'Không đạt' : '-'}
                            </Badge>
                          )}
                        />
                      </div>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {activeComponents.map((comp) => (
                          <MobileItem
                            key={comp}
                            label={`${componentLabels[comp] || comp}${gradeConfig?.weights?.[comp] !== undefined ? ` (×${gradeConfig.weights[comp]})` : ''}`}
                            value={
                              (grade.gradeItems?.[comp as keyof NonNullable<typeof grade.gradeItems>] as number[] | undefined)?.length ? (
                                <span className="space-x-1">
                                  {(grade.gradeItems?.[comp as keyof NonNullable<typeof grade.gradeItems>] as number[])!.map((s, i) => (
                                    <span key={i} className={getGradeColor(s)}>
                                      {s.toFixed(1)}{i < (grade.gradeItems?.[comp as keyof NonNullable<typeof grade.gradeItems>] as number[])!.length - 1 ? ',' : ''}
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span className={getGradeColor(grade.averages?.[comp as keyof NonNullable<typeof grade.averages>] as number | undefined)}>
                                  {renderScore(grade.averages?.[comp as keyof NonNullable<typeof grade.averages>] as number | undefined)}
                                </span>
                              )
                            }
                          />
                        ))}
                        <div className="flex items-center justify-between pt-2 border-t mt-2">
                          <span className="text-sm text-muted-foreground">ĐTB môn</span>
                          {grade.subject.includeInAverage !== false ? (
                            <Badge variant="outline" className={`${getGradeColor(grade.average)} border-current`}>
                              {isOfficialAverage(grade) ? grade.average!.toFixed(1) : '-'}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                        {grade.subject.includeInAverage === false && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Kết quả</span>
                            <Badge variant={grade.result === 'D' ? 'default' : grade.result === 'K' ? 'destructive' : 'outline'}>
                              {grade.result === 'D' ? 'Đạt' : grade.result === 'K' ? 'Không đạt' : '-'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Tổng kết TB tất cả môn cho mobile */}
                {(semester === 'HK1' || semester === 'HK2') && (
                  <div className="border rounded-lg p-3 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">TB tất cả các môn</span>
                      </div>
                      <Badge variant="outline" className={`${getGradeColor(semester === 'HK1' ? overallHk1Average : overallHk2Average)} border-current`}>
                        {semester === 'HK1' 
                          ? (overallHk1Average !== null ? overallHk1Average.toFixed(1) : '-')
                          : (overallHk2Average !== null ? overallHk2Average.toFixed(1) : '-')}
                      </Badge>
                    </div>
                  </div>
                )}
                {semester === 'CN' && (
                  <div className="border rounded-lg p-3 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">TB tất cả các môn</span>
                      </div>
                      <Badge variant="outline" className={`${getGradeColor(overallYearAverage)} border-current`}>
                        {overallYearAverage !== null ? overallYearAverage.toFixed(1) : '-'}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Điểm số của tôi</h1>
          <p className="text-muted-foreground">Xem điểm số các môn học theo học kỳ và năm học</p>
        </div>
      </div>

      {/* Filters - Bảng điểm: năm học + học kỳ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-xl">Bảng điểm</CardTitle>
              <CardDescription>Xem điểm theo năm học và học kỳ</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Năm học</p>
              {schoolYears.length > 0 ? (
                <Select value={selectedYear || schoolYears[0]} onValueChange={(value) => setSelectedYear(value)}>
                  <SelectTrigger className="w-full sm:w-[240px]">
                    <SelectValue placeholder="Chọn năm học" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground">Đang tải năm học...</div>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Học kỳ</p>
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder="Chọn học kỳ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HK1">Học kỳ I</SelectItem>
                  <SelectItem value="HK2">Học kỳ II</SelectItem>
                  <SelectItem value="CN">Cả năm</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            {activeTab === 'HK1' && (
              <>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    <Card className="bg-muted/50 flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <GraduationCap className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Học lực học kỳ 1</p>
                            <p className="text-lg font-semibold">
                              {getConductInfo('HK1').academicLevel || provisionalHK1 || 'Chưa có'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
                  <Card className="bg-gradient-to-br from-emerald-500 to-green-600 border-none shadow-md">
                    <CardContent className="p-4">
                      <div className="flex flex-col text-white">
                        <span className="text-sm/5 opacity-90">Điểm trung bình</span>
                        <span className="mt-1 text-4xl font-bold">
                          {overallHk1Average !== null ? overallHk1Average.toFixed(1) : '-'}
                        </span>
                        <span className="mt-1 text-sm/5 opacity-90">
                          {getConductInfo('HK1').academicLevel || provisionalHK1 || 'Chưa có'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {renderGradeTable('Bảng điểm học kỳ 1', hk1Grades, 'HK1', displayYear)}
              </>
            )}

            {activeTab === 'HK2' && (
              <>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    <Card className="bg-muted/50 flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <GraduationCap className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Học lực học kỳ 2</p>
                            <p className="text-lg font-semibold">
                              {getConductInfo('HK2').academicLevel || provisionalHK2 || 'Chưa có'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
                  <Card className="bg-gradient-to-br from-emerald-500 to-green-600 border-none shadow-md">
                    <CardContent className="p-4">
                      <div className="flex flex-col text-white">
                        <span className="text-sm/5 opacity-90">Điểm trung bình</span>
                        <span className="mt-1 text-4xl font-bold">
                          {overallHk2Average !== null ? overallHk2Average.toFixed(1) : '-'}
                        </span>
                        <span className="mt-1 text-sm/5 opacity-90">
                          {getConductInfo('HK2').academicLevel || provisionalHK2 || 'Chưa có'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {renderGradeTable('Bảng điểm học kỳ 2', hk2Grades, 'HK2', displayYear)}
              </>
            )}

            {activeTab === 'CN' && (
              <>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    <Card className="bg-muted/50 flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <GraduationCap className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Học lực cả năm</p>
                            <p className="text-lg font-semibold">
                              {getConductInfo('CN').academicLevel || provisionalCN || 'Chưa có'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
                  <Card className="bg-gradient-to-br from-emerald-500 to-green-600 border-none shadow-md">
                    <CardContent className="p-4">
                      <div className="flex flex-col text-white">
                        <span className="text-sm/5 opacity-90">Điểm trung bình</span>
                        <span className="mt-1 text-4xl font-bold">
                          {overallYearAverage !== null ? overallYearAverage.toFixed(1) : '-'}
                        </span>
                        <span className="mt-1 text-sm/5 opacity-90">
                          {getConductInfo('CN').academicLevel || provisionalCN || 'Chưa có'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

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
                                    {((grade as any).hk1Average !== null && (grade as any).hk1Average !== undefined && (grade as any).hk1IsOfficial)
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
                                    {((grade as any).hk2Average !== null && (grade as any).hk2Average !== undefined && (grade as any).hk2IsOfficial)
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
                                    {isOfficialAverage(grade) && grade.average !== null ? grade.average.toFixed(1) : '-'}
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
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentGradesPage;

