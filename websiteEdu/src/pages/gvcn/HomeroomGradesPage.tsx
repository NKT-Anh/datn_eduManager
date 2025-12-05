import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useSchoolYears } from '@/hooks';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import schoolConfigApi from '@/services/schoolConfigApi';
import gradesApi from '@/services/gradesApi';
import gradeConfigApi from '@/services/gradeConfigApi';
import { toast } from 'sonner';
import { FileText, BarChart3, Award, TrendingUp, TrendingDown, Minus, Download, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/services/axiosInstance';

type SubjectEntry = {
  average?: number | null;
  averages?: Record<string, number | null | undefined> & {
    final?: number | null;
    hk1?: number | null;
    hk2?: number | null;
    year?: number | null;
  };
  gradeItems?: Record<string, number[]>;
  isOfficial?: boolean;
} | null;

const toScore = (value: unknown): number | null => (typeof value === 'number' ? Number(value) : null);

const formatScore = (score: number | null, digits = 1) => (score !== null ? score.toFixed(digits) : '-');

const getPublishedAverage = (entry: SubjectEntry, allowUnpublished = false) => {
  if (!entry) return null;
  if (!allowUnpublished && entry.isOfficial !== true) return null;

  const averages = entry.averages as Record<string, number | null | undefined> & {
    final?: number | null;
    year?: number | null;
  };

  const directSources = [entry.average, averages?.final, averages?.year];
  for (const raw of directSources) {
    const value = toScore(raw);
    if (value !== null) return value;
  }

  const hk1 = toScore((averages as any)?.hk1);
  const hk2 = toScore((averages as any)?.hk2);
  if (hk1 !== null && hk2 !== null) {
    return Number(((hk1 + hk2) / 2).toFixed(2));
  }

  return hk1 ?? hk2 ?? null;
};

const getComponentAverage = (entry: SubjectEntry, component: string) => toScore(entry?.averages?.[component]);

const getGradeItems = (entry: SubjectEntry, component: string): number[] => {
  const value = entry?.gradeItems?.[component];
  return Array.isArray(value) ? (value as number[]) : [];
};

const describeSubjectAverages = (subject: any) => {
  const include = subject?.subject?.includeInAverage !== false;
  const hasFinal = (value: any, flag: boolean | undefined) => include && value !== null && flag === true;
  const hk1 = hasFinal(subject?.hk1, subject?.hk1HasFinal) ? formatScore(toScore(subject.hk1)) : '-';
  const hk2 = hasFinal(subject?.hk2, subject?.hk2HasFinal) ? formatScore(toScore(subject.hk2)) : '-';
  const yearFlag = subject?.yearHasFinal === true || (subject?.hk1HasFinal === true && subject?.hk2HasFinal === true);
  const cn = include && subject?.year !== null && yearFlag ? formatScore(toScore(subject.year)) : '-';
  return `HKI: ${hk1} | HKII: ${hk2} | CN: ${cn}`;
};

const getScoreClass = (score: number | null | undefined) => {
  if (score === null || score === undefined) return 'text-muted-foreground';
  if (score >= 8.0) return 'text-emerald-600 font-medium';
  if (score >= 6.5) return 'text-blue-600 font-medium';
  if (score >= 5.0) return 'text-amber-600 font-medium';
  return 'text-red-600 font-medium';
};

const getConductBadge = (conduct?: string) => {
  if (!conduct) return <Badge variant="outline">Chưa có</Badge>;
  const colors: Record<string, string> = {
    'Tốt': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'Khá': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'Trung bình': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'Yếu': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return (
    <Badge className={colors[conduct] || 'bg-gray-100 text-gray-800'}>
      {conduct}
    </Badge>
  );
};

const getAcademicLevelBadge = (level?: string) => {
  if (!level) return <Badge variant="outline">Chưa có</Badge>;
  const colors: Record<string, string> = {
    'Giỏi': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'Khá': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'Trung bình': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'Yếu': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return (
    <Badge className={colors[level] || 'bg-gray-100 text-gray-800'}>
      {level}
    </Badge>
  );
};

export default function HomeroomGradesPage() {
  const { backendUser } = useAuth();
  const { schoolYears: allSchoolYears } = useSchoolYears();
  const { currentYearCode, currentYearData } = useCurrentAcademicYear();
  const currentYear = currentYearCode;
  const [loading, setLoading] = useState(true);
  const [homeroomClass, setHomeroomClass] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [semesters, setSemesters] = useState<{ code: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState('all-grades');
  
  // Data states
  const [allGradesData, setAllGradesData] = useState<any[]>([]);
  const [averagesData, setAveragesData] = useState<any[]>([]);
  const [classificationData, setClassificationData] = useState<any>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [gradeConfig, setGradeConfig] = useState<{
    weights: Record<string, number>;
    columnCounts?: Record<string, number>;
    rounding?: string;
    completionPolicy?: string;
    maxScores?: Record<string, number>;
    formula?: string;
  } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [downloadingStudentId, setDownloadingStudentId] = useState<string | null>(null);
  const [downloadingClass, setDownloadingClass] = useState(false);

  // ✅ Lấy lớp chủ nhiệm
  useEffect(() => {
    const fetchHomeroomClass = async () => {
      try {
        setLoading(true);
        const year = selectedYear || currentYearData?.code || currentYear;
        if (!year) return;

        const res = await api.get('/class/homeroom/class', { params: { year } });
        if (res.data.success && res.data.data) {
          setHomeroomClass(res.data.data);
        } else {
          setHomeroomClass(null);
        }
      } catch (err: any) {
        console.error('Error fetching homeroom class:', err);
        setHomeroomClass(null);
      } finally {
        setLoading(false);
      }
    };
    fetchHomeroomClass();
  }, [selectedYear, currentYearData, currentYear]);

  // ✅ Set năm học mặc định
  useEffect(() => {
    const defaultYear = currentYearData?.code || currentYear || (allSchoolYears.length > 0 ? allSchoolYears[allSchoolYears.length - 1].code : '');
    if (defaultYear && !selectedYear) {
      setSelectedYear(defaultYear);
    }
  }, [currentYearData, currentYear, allSchoolYears, selectedYear]);

  // ✅ Lấy danh sách học kỳ
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const semestersRes = await schoolConfigApi.getSemesters();
        const baseSemesters = Array.isArray(semestersRes.data) ? semestersRes.data : [];
        const hasFullYear = baseSemesters.some(s => s.code === 'CN');
        const normalized = hasFullYear
          ? baseSemesters
          : [...baseSemesters, { code: 'CN', name: 'Cả năm' }];
        setSemesters(normalized);
        if (normalized.length > 0 && !selectedSemester) {
          setSelectedSemester(normalized[0].code);
        }
      } catch (err) {
        console.error("Load semesters failed", err);
      }
    };
    fetchSemesters();
  }, [selectedSemester]);

  const semesterOptions = useMemo(() => {
    const hasFullYear = semesters.some(s => s.code === 'CN');
    return hasFullYear ? semesters : [...semesters, { code: 'CN', name: 'Cả năm' }];
  }, [semesters]);

  useEffect(() => {
    if (selectedSemester && !semesterOptions.some(option => option.code === selectedSemester)) {
      setSelectedSemester(semesterOptions[0]?.code || '');
    }
  }, [selectedSemester, semesterOptions]);

  const selectedSemesterLabel = useMemo(() => {
    if (!selectedSemester) return '';
    return semesterOptions.find(option => option.code === selectedSemester)?.name || selectedSemester;
  }, [semesterOptions, selectedSemester]);

  // ✅ Lấy tất cả điểm của lớp chủ nhiệm
  useEffect(() => {
    const fetchAllGrades = async () => {
      if (
        !homeroomClass?._id ||
        !selectedYear ||
        !selectedSemester ||
        activeTab !== 'all-grades'
      ) {
        setAllGradesData([]);
        return;
      }

      try {
        const res = await gradesApi.getHomeroomClassAllGradesWithTrend({
          classId: homeroomClass._id,
          schoolYear: selectedYear,
          semester: selectedSemester,
        });
        setAllGradesData(res.data || []);
      } catch (err: any) {
        console.error('Error fetching all grades:', err);
        toast.error(err.response?.data?.message || 'Không thể tải bảng điểm');
        setAllGradesData([]);
      }
    };
    fetchAllGrades();
  }, [homeroomClass, selectedYear, selectedSemester, activeTab]);

  useEffect(() => {
    const fetchGradeConfig = async () => {
      if (!selectedYear || !selectedSemester) {
        setGradeConfig(null);
        return;
      }

      const defaultConfig = {
        weights: { oral: 1, quiz15: 1, quiz45: 2, midterm: 2, final: 3 },
        columnCounts: { oral: 3, quiz15: 3, quiz45: 1, midterm: 1, final: 1 },
        rounding: 'half-up',
      };

      try {
        setLoadingConfig(true);
        const semesterForConfig = selectedSemester === 'CN' ? '2' : selectedSemester;
        const res = await gradeConfigApi.getConfig({ schoolYear: selectedYear, semester: semesterForConfig });
        const payload = (res as any)?.data ?? res;
        if (payload?.weights) {
          setGradeConfig({
            weights: payload.weights,
            columnCounts: payload.columnCounts,
            rounding: payload.rounding,
            completionPolicy: payload.completionPolicy,
            maxScores: payload.maxScores,
            formula: payload.formula,
          });
        } else {
          setGradeConfig({ ...defaultConfig });
        }
      } catch (error) {
        console.warn('Không thể tải cấu hình điểm, dùng mặc định', error);
        setGradeConfig({ ...defaultConfig });
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchGradeConfig();
  }, [selectedYear, selectedSemester]);

  const handleEvaluateAcademic = async () => {
    if (!homeroomClass?._id || !selectedYear || !selectedSemester) return;
    try {
      setEvaluating(true);
      const res = await gradesApi.evaluateHomeroomAcademic({
        classId: homeroomClass._id,
        schoolYear: selectedYear,
        semester: selectedSemester,
      });
      if (res?.success) {
        toast.success(`Đã xét học lực: cập nhật ${res.updated}, bỏ qua ${res.skipped}`);
      } else {
        toast.info(res?.message || 'Đã gửi yêu cầu xét học lực');
      }
      // reload classification
      const refreshed = await gradesApi.getHomeroomClassClassification({
        classId: homeroomClass._id,
        schoolYear: selectedYear,
        semester: selectedSemester,
      });
      setClassificationData(refreshed);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể xét học lực');
    } finally {
      setEvaluating(false);
    }
  };

  // ✅ Lấy điểm trung bình
  useEffect(() => {
    const fetchAverages = async () => {
      if (!homeroomClass?._id || !selectedYear || activeTab !== 'averages') {
        setAveragesData([]);
        return;
      }

      try {
        const res = await gradesApi.getHomeroomClassAverages({
          classId: homeroomClass._id,
          schoolYear: selectedYear,
        });
        setAveragesData(res.data || []);
      } catch (err: any) {
        console.error('Error fetching averages:', err);
        toast.error(err.response?.data?.message || 'Không thể tải điểm trung bình');
        setAveragesData([]);
      }
    };
    fetchAverages();
  }, [homeroomClass, selectedYear, activeTab]);

  // ✅ Lấy kết quả xếp loại
  useEffect(() => {
    const fetchClassification = async () => {
      if (!homeroomClass?._id || !selectedYear || activeTab !== 'classification') {
        setClassificationData(null);
        return;
      }

      try {
        const res = await gradesApi.getHomeroomClassClassification({
          classId: homeroomClass._id,
          schoolYear: selectedYear,
          semester: selectedSemester,
        });
        setClassificationData(res);
      } catch (err: any) {
        console.error('Error fetching classification:', err);
        toast.error(err.response?.data?.message || 'Không thể tải kết quả xếp loại');
        setClassificationData(null);
      }
    };
    fetchClassification();
  }, [homeroomClass, selectedYear, selectedSemester, activeTab]);

  const subjectOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    allGradesData.forEach(student => {
      student.subjects?.forEach((subject: any) => {
        const id = subject?.subject?._id;
        const name = subject?.subject?.name;
        if (id && name && !map.has(id)) {
          map.set(id, { value: id, label: name });
        }
      });
    });
    return Array.from(map.values());
  }, [allGradesData]);

  useEffect(() => {
    if (subjectFilter !== 'all' && !subjectOptions.some(option => option.value === subjectFilter)) {
      setSubjectFilter('all');
    }
  }, [subjectFilter, subjectOptions]);

  const visibleSubjects = useMemo(() => {
    if (subjectFilter === 'all') {
      return subjectOptions;
    }
    const found = subjectOptions.find(option => option.value === subjectFilter);
    return found ? [found] : subjectOptions;
  }, [subjectFilter, subjectOptions]);

  const displayedSubjects = useMemo(() => {
    return visibleSubjects.length > 0 ? visibleSubjects : subjectOptions;
  }, [visibleSubjects, subjectOptions]);

  const isAllSubjects = subjectFilter === 'all';

  const selectedSubjectLabel = useMemo(() => {
    if (isAllSubjects) return '';
    const match = subjectOptions.find(option => option.value === subjectFilter);
    return match?.label || 'đã chọn';
  }, [isAllSubjects, subjectOptions, subjectFilter]);

  const studentSubjectMap = useMemo(() => {
    const map = new Map<string, Map<string, any>>();
    allGradesData.forEach(student => {
      const subjectsMap = new Map<string, any>();
      student.subjects?.forEach((entry: any) => {
        const subjectId = entry?.subject?._id;
        if (subjectId) {
          subjectsMap.set(String(subjectId), entry);
        }
      });
      map.set(String(student._id), subjectsMap);
    });
    return map;
  }, [allGradesData]);

  const {
    subjectEntryMap,
    selectedSubjectEntry,
    selectedSubjectIsOfficial
  } = useMemo(() => {
    if (subjectFilter === 'all') {
      return {
        subjectEntryMap: null as Map<string, any> | null,
        selectedSubjectEntry: null as any,
        selectedSubjectIsOfficial: false,
      };
    }

    const map = new Map<string, any>();
    let firstEntry: any = null;

    studentSubjectMap.forEach((subjects, studentId) => {
      const entry = subjects.get(subjectFilter) || null;
      map.set(studentId, entry);
      if (!firstEntry && entry) {
        firstEntry = entry;
      }
    });

    return {
      subjectEntryMap: map,
      selectedSubjectEntry: firstEntry,
      selectedSubjectIsOfficial: firstEntry?.isOfficial === true,
    };
  }, [studentSubjectMap, subjectFilter]);

  const activeGradeConfig = useMemo(() => {
    if (isAllSubjects) return null;
    if (selectedSubjectEntry?.gradeConfig) return selectedSubjectEntry.gradeConfig;
    return gradeConfig;
  }, [isAllSubjects, selectedSubjectEntry, gradeConfig]);

  const componentLabels: Record<string, string> = useMemo(() => ({
    oral: 'Miệng',
    quiz15: '15 phút',
    quiz45: '45 phút',
    midterm: 'Giữa kỳ',
    final: 'Cuối kỳ',
    project: 'Dự án',
    practice: 'Thực hành',
    attendance: 'Chuyên cần',
    bonus: 'Khuyến khích'
  }), []);

  const componentOrder = useMemo(() => ['oral', 'quiz15', 'quiz45', 'midterm', 'final', 'practice', 'project', 'attendance', 'bonus'], []);

  const gradeConfigComponents = useMemo(() => {
    if (!activeGradeConfig?.weights) return [];
    return Object.entries(activeGradeConfig.weights)
      .filter(([, weight]) => typeof weight === 'number' && weight > 0)
      .map(([component]) => component);
  }, [activeGradeConfig]);

  const subjectComponents = useMemo(() => {
    if (isAllSubjects) return [];
    const componentSet = new Set<string>(gradeConfigComponents);
    subjectEntryMap?.forEach(entry => {
      if (entry?.averages) {
        Object.entries(entry.averages).forEach(([key, value]) => {
          if (typeof value === 'number') {
            componentSet.add(key);
          }
        });
      }
      if (entry?.gradeItems) {
        Object.entries(entry.gradeItems).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            componentSet.add(key);
          }
        });
      }
    });
    return componentOrder.filter(component => componentSet.has(component));
  }, [isAllSubjects, gradeConfigComponents, componentOrder, subjectEntryMap]);

  const emptyRowColSpan = useMemo(() => {
    const baseColumns = 3; // STT, Mã HS, Họ và tên
    const subjectColumns = isAllSubjects ? displayedSubjects.length : subjectComponents.length;
    const averageColumns = isAllSubjects ? 0 : 1;
    const summaryColumns = isAllSubjects ? 3 : 0;
    const actionColumns = isAllSubjects ? 1 : 0;
    return baseColumns + subjectColumns + averageColumns + summaryColumns + actionColumns;
  }, [isAllSubjects, displayedSubjects, subjectComponents]);
  const homeroomClassId = homeroomClass?._id as string | undefined;

  const sanitizeForFileName = useCallback((value: string | undefined | null) => {
    if (!value) return 'ket-qua';
    return String(value)
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, '-');
  }, []);

  const handleDownloadReportCard = useCallback(async (studentId: string, studentCode?: string) => {
    if (!homeroomClassId || !selectedYear || !selectedSemester) {
      toast.error('Vui lòng chọn đầy đủ năm học và học kỳ.');
      return;
    }

    try {
      setDownloadingStudentId(studentId);
      const blob = await gradesApi.exportStudentReportCard({
        studentId,
        classId: homeroomClassId,
        schoolYear: selectedYear,
        semester: selectedSemester,
      });

      const url = window.URL.createObjectURL(blob);
      const fallbackCode = studentCode || studentId;
      const sanitizedCode = sanitizeForFileName(fallbackCode);
      const semesterLabel = selectedSemester === 'CN' ? 'ca-nam' : `hk${selectedSemester}`;
      const fileName = `phieu-ket-qua_${sanitizedCode}_${semesterLabel}.pdf`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      console.error('Không thể tải phiếu kết quả:', err);
      const message = err?.response?.data?.message || err?.message || 'Không thể tải phiếu kết quả';
      toast.error(message);
    } finally {
      setDownloadingStudentId(null);
    }
  }, [homeroomClassId, selectedYear, selectedSemester, sanitizeForFileName]);

  const handleDownloadClassReportCards = useCallback(async () => {
    if (!homeroomClassId || !selectedYear || !selectedSemester) {
      toast.error('Vui lòng chọn đầy đủ năm học và học kỳ.');
      return;
    }

    try {
      setDownloadingClass(true);
      const blob = await gradesApi.exportClassReportCards({
        classId: homeroomClassId,
        schoolYear: selectedYear,
        semester: selectedSemester,
      });

      const url = window.URL.createObjectURL(blob);
      const semesterLabel = selectedSemester === 'CN' ? 'ca-nam' : `hk${selectedSemester}`;
      const sanitizedClassName = sanitizeForFileName(homeroomClass?.className || homeroomClassId);
      const fileName = `phieu-ket-qua_${sanitizedClassName}_${semesterLabel}.zip`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      console.error('Không thể tải ZIP phiếu kết quả:', err);
      const message = err?.response?.data?.message || err?.message || 'Không thể tải phiếu kết quả của lớp';
      toast.error(message);
    } finally {
      setDownloadingClass(false);
    }
  }, [homeroomClassId, homeroomClass?.className, selectedYear, selectedSemester, sanitizeForFileName]);


  const filteredStudents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) {
      return allGradesData;
    }
    return allGradesData.filter(student => {
      const name = (student.name || '').toLowerCase();
      const code = (student.studentCode || '').toLowerCase();
      return name.includes(keyword) || code.includes(keyword);
    });
  }, [allGradesData, searchTerm]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bộ lọc luôn hiển thị */}
      <Card>
        <CardContent className="p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Năm học</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {allSchoolYears.map(y => (
                    <SelectItem key={y.code} value={y.code}>
                      {y.name} {currentYearData?.code === y.code && "(Hiện tại)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Học kỳ</Label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn học kỳ" />
                </SelectTrigger>
                <SelectContent>
                  {semesterOptions.map(s => (
                    <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nếu không có lớp chủ nhiệm, chỉ hiển thị thông báo */}
      {!homeroomClass ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Thầy/cô chưa được phân công làm giáo viên chủ nhiệm lớp nào trong năm học này.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Bảng điểm lớp chủ nhiệm</h1>
              <p className="text-muted-foreground">
                {homeroomClass.className} - Năm học {allSchoolYears.find(sy => sy.code === selectedYear)?.name || selectedYear}
              </p>
            </div>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all-grades">
                <FileText className="h-4 w-4 mr-2" />
                Tất cả điểm
              </TabsTrigger>
              <TabsTrigger value="averages">
                <BarChart3 className="h-4 w-4 mr-2" />
                Điểm trung bình
              </TabsTrigger>
              <TabsTrigger value="classification">
                <Award className="h-4 w-4 mr-2" />
                Xếp loại
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Tất cả điểm */}
            <TabsContent value="all-grades" className="space-y-4">
              {allGradesData.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Chưa có dữ liệu điểm số</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Bảng điểm tất cả môn học - {selectedSemesterLabel || 'Chưa chọn'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 w-full">
                        <Input
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Tìm kiếm theo tên hoặc mã học sinh..."
                          className="md:max-w-sm"
                        />
                        {isAllSubjects && (
                          <Button
                            variant="secondary"
                            onClick={handleDownloadClassReportCards}
                            disabled={downloadingClass}
                          >
                            {downloadingClass ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang nén...
                              </>
                            ) : (
                              <>
                                <Download className="mr-2 h-4 w-4" />
                                Tải phiếu cả lớp
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground">Môn học</Label>
                        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Chọn môn" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tất cả môn</SelectItem>
                            {subjectOptions.map(subject => (
                              <SelectItem key={subject.value} value={subject.value}>
                                {subject.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {!isAllSubjects && activeGradeConfig && (
                      <div className="space-y-3 mb-4">
                        <div className="p-3 border rounded bg-muted/30 flex flex-col gap-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-sm font-medium">Trọng số môn {selectedSubjectLabel}</span>
                            <div className="flex items-center gap-2">
                              {selectedSubjectIsOfficial ? (
                                <Badge className="text-xs">Đã công bố</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">Chưa công bố</Badge>
                              )}
                              {loadingConfig && <span className="text-xs text-muted-foreground">Đang tải cấu hình…</span>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {subjectComponents.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {selectedSubjectIsOfficial
                                  ? 'Chưa có cấu hình trọng số cho môn này.'
                                  : 'Chưa có dữ liệu điểm vì giáo viên bộ môn chưa công bố.'}
                              </span>
                            ) : (
                              subjectComponents.map(component => (
                                <Badge key={component} variant="secondary" className="text-xs">
                                  {componentLabels[component] || component}: ×{activeGradeConfig?.weights?.[component] ?? 1}
                                </Badge>
                              ))
                            )}
                            {subjectComponents.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                TB môn: tính theo trọng số
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>STT</TableHead>
                            <TableHead>Mã HS</TableHead>
                            <TableHead>Họ và tên</TableHead>
                            {isAllSubjects
                              ? displayedSubjects.map(subject => (
                                  <TableHead key={subject.value} className="text-center">
                                    {subject.label}
                                  </TableHead>
                                ))
                              : subjectComponents.map(component => (
                                  <TableHead key={component} className="text-center">
                                    {componentLabels[component] || component}
                                  </TableHead>
                                ))}
                            {!isAllSubjects && (
                                <TableHead className="text-center">TB môn</TableHead>
                              )}
                            {isAllSubjects && (
                                <>
                                  <TableHead className="text-center">{selectedSemester === 'CN' ? 'ĐTB CN' : 'ĐTB HK'}</TableHead>
                                  <TableHead className="text-center">Hạnh kiểm</TableHead>
                                  <TableHead className="text-center">Xếp loại</TableHead>
                                </>
                              )}
                            {isAllSubjects && (
                              <TableHead className="text-center w-[140px]">Phiếu kết quả</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStudents.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={emptyRowColSpan} className="text-center text-muted-foreground">
                                Không tìm thấy học sinh phù hợp.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredStudents.map((student, index) => {
                              const studentId = String(student._id);
                              const subjectMap = studentSubjectMap.get(studentId);
                              const subjectEntry = !isAllSubjects
                                ? ((subjectEntryMap?.get(studentId) ?? null) as SubjectEntry)
                                : null;
                              const allowYearAverage = selectedSemester === 'CN';
                              const publishedAverage = getPublishedAverage(subjectEntry, allowYearAverage);
                              const backendSemesterAverage = toScore(student.semesterAverage);
                              const subjectAveragesForOverall: number[] = [];
                              const subjectCells = isAllSubjects
                                ? displayedSubjects.map(subjectMeta => {
                                    const entry = (subjectMap?.get(subjectMeta.value) ?? null) as SubjectEntry;
                                    const subjectAverage = getPublishedAverage(entry, allowYearAverage);
                                    if (subjectAverage !== null) {
                                      subjectAveragesForOverall.push(subjectAverage);
                                    }
                                    return (
                                      <TableCell key={`${student._id}-${subjectMeta.value}`} className="text-center">
                                        {subjectAverage !== null ? (
                                          <span className={getScoreClass(subjectAverage)}>{formatScore(subjectAverage)}</span>
                                        ) : (
                                          <span className="text-muted-foreground">-</span>
                                        )}
                                      </TableCell>
                                    );
                                  })
                                : subjectComponents.map(component => {
                                    if (!subjectEntry) {
                                      return (
                                        <TableCell key={`${student._id}-${component}`} className="text-center text-muted-foreground">-</TableCell>
                                      );
                                    }
                                    const gradeItemsList = getGradeItems(subjectEntry, component);
                                    const componentAverage = getComponentAverage(subjectEntry, component);
                                    return (
                                      <TableCell key={`${student._id}-${component}`} className="text-center">
                                        {gradeItemsList.length > 0 ? (
                                          <div className="flex flex-wrap justify-center gap-1">
                                            {gradeItemsList.map((score, idx) => (
                                              <Badge key={idx} variant="outline" className={getScoreClass(score)}>
                                                {formatScore(score)}
                                              </Badge>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className={getScoreClass(componentAverage)}>{formatScore(componentAverage)}</span>
                                        )}
                                      </TableCell>
                                    );
                                  });
                              const computedOverallAverage = subjectAveragesForOverall.length > 0
                                ? Number(
                                    (
                                      subjectAveragesForOverall.reduce((sum, value) => sum + value, 0) /
                                      subjectAveragesForOverall.length
                                    ).toFixed(2)
                                  )
                                : null;
                              const semesterAverage = selectedSemester === 'CN'
                                ? (computedOverallAverage ?? backendSemesterAverage)
                                : (backendSemesterAverage ?? computedOverallAverage);
                              return (
                                <TableRow key={student._id}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>{student.studentCode}</TableCell>
                                  <TableCell className="font-medium">{student.name}</TableCell>
                                  {subjectCells}
                                  {!isAllSubjects && (
                                    <TableCell className={`text-center font-semibold ${subjectEntry ? '' : 'text-muted-foreground'}`}>
                                      {subjectEntry && publishedAverage !== null ? (
                                        <span className={getScoreClass(publishedAverage)}>{formatScore(publishedAverage)}</span>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                  )}
                                  {isAllSubjects && (
                                    <>
                                      <TableCell className="text-center font-semibold">
                                        {semesterAverage !== null
                                          ? formatScore(semesterAverage, 2)
                                          : '-'}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {getConductBadge(student.conduct)}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {getAcademicLevelBadge(student.academicLevel)}
                                      </TableCell>
                                    </>
                                  )}
                                  {isAllSubjects && (
                                    <TableCell className="text-center">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDownloadReportCard(studentId, student.studentCode)}
                                        disabled={downloadingStudentId === studentId}
                                      >
                                        {downloadingStudentId === studentId ? (
                                          <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Đang tải...
                                          </>
                                        ) : (
                                          <>
                                            <Download className="mr-2 h-4 w-4" />
                                            Tải phiếu
                                          </>
                                        )}
                                      </Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab 2: Điểm trung bình */}
            <TabsContent value="averages" className="space-y-4">
              {averagesData.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Chưa có dữ liệu điểm trung bình</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Điểm trung bình học sinh</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table className="min-w-[840px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>STT</TableHead>
                            <TableHead>Họ và tên</TableHead>
                            <TableHead>Mã HS</TableHead>
                            <TableHead className="text-center">ĐTB HKI</TableHead>
                            <TableHead className="text-center">ĐTB HKII</TableHead>
                            <TableHead className="text-center">ĐTB Cả năm</TableHead>
                            <TableHead className="text-center">Hạnh kiểm CN</TableHead>
                            <TableHead className="text-center">Học lực CN</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {averagesData.map((student, index) => {
                            const hk1 = toScore(student?.averages?.hk1);
                            const hk2 = toScore(student?.averages?.hk2);
                            const year = toScore(student?.averages?.year);
                            const conductYear = typeof student?.conduct === 'string' ? student.conduct : student?.conduct?.year;
                            const academicYear = typeof student?.academicLevel === 'string' ? student.academicLevel : student?.academicLevel?.year;
                            const subjectRows = Array.isArray(student?.subjectAverages) ? student.subjectAverages : [];

                            return (
                              <React.Fragment key={student._id}>
                                <TableRow>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell className="font-medium">{student.name}</TableCell>
                                  <TableCell>{student.studentCode}</TableCell>
                                  <TableCell className="text-center font-semibold">
                                    {hk1 !== null ? formatScore(hk1, 2) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center font-semibold">
                                    {hk2 !== null ? formatScore(hk2, 2) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center font-semibold">
                                    {year !== null ? formatScore(year, 2) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {getConductBadge(conductYear)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {getAcademicLevelBadge(academicYear)}
                                  </TableCell>
                                </TableRow>
                                {subjectRows.length > 0 && (
                                  <TableRow className="bg-muted/40">
                                    <TableCell colSpan={8} className="p-3">
                                      <div className="flex flex-wrap gap-2">
                                        {subjectRows.map((subj: any, subjIndex: number) => (
                                          <div
                                            key={subj.subject?._id || subj.subject?.code || `${student._id}-${subjIndex}`}
                                            className="min-w-[200px] flex-1 rounded border bg-background p-3"
                                          >
                                            <div className="text-sm font-semibold">{subj.subject?.name || 'Môn học'}</div>
                                            <div className="text-xs text-muted-foreground">
                                              {describeSubjectAverages(subj)}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab 3: Xếp loại */}
            <TabsContent value="classification" className="space-y-4">
              {!classificationData ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Thống kê */}
                  {classificationData.statistics && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Thống kê xếp loại</CardTitle>
                          <div className="flex items-center gap-2">
                            <button
                              className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                              onClick={handleEvaluateAcademic}
                              disabled={evaluating || !selectedSemester}
                              title="Xét học lực theo cấu hình và môn bắt buộc đã công bố"
                            >
                              {evaluating ? 'Đang xét…' : 'Xét học lực'}
                            </button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h3 className="font-semibold mb-2">Hạnh kiểm</h3>
                            <div className="space-y-1">
                              {Object.entries(classificationData.statistics.conduct).map(([key, value]: [string, any]) => (
                                <div key={key} className="flex justify-between">
                                  <span>{key}:</span>
                                  <span className="font-medium">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h3 className="font-semibold mb-2">Học lực</h3>
                            <div className="space-y-1">
                              {Object.entries(classificationData.statistics.academicLevel).map(([key, value]: [string, any]) => (
                                <div key={key} className="flex justify-between">
                                  <span>{key}:</span>
                                  <span className="font-medium">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Danh sách học sinh */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Kết quả xếp loại học tập</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>STT</TableHead>
                              <TableHead>Họ và tên</TableHead>
                              <TableHead>Mã HS</TableHead>
                              <TableHead className="text-center">ĐTB</TableHead>
                              <TableHead className="text-center">Hạnh kiểm</TableHead>
                              <TableHead className="text-center">Học lực</TableHead>
                              <TableHead className="text-center">Xếp hạng (Lớp/Khối)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {classificationData.data?.map((student: any, index: number) => (
                              <TableRow key={student._id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell className="font-medium">{student.name}</TableCell>
                                <TableCell>{student.studentCode}</TableCell>
                                <TableCell className="text-center font-semibold">
                                  {student.gpa !== null ? student.gpa.toFixed(2) : '-'}
                                </TableCell>
                                <TableCell className="text-center">
                                  {getConductBadge(student.conduct)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {getAcademicLevelBadge(student.academicLevel)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {student.rank || student.rankGrade 
                                    ? `Lớp: ${student.rank || '-'} / Khối: ${student.rankGrade || '-'}`
                                    : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

