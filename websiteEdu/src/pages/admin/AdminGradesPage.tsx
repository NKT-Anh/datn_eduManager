import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Edit, Trash2, RefreshCw, TrendingUp, TrendingDown, Minus, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import gradesApi from '@/services/gradesApi';
import schoolConfigApi from '@/services/schoolConfigApi';
import conductApi from '@/services/conductApi';
import { useClasses } from '@/hooks/classes/useClasses';
import { useSubjects } from '@/hooks/subjects/useSubjects';
import { useSchoolYears } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import gradeConfigApi from '@/services/gradeConfigApi';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
// @ts-ignore - sweetalert2 types are included in the package
import Swal from 'sweetalert2';

const gradeComponents = ['oral', 'quiz15', 'quiz45', 'midterm', 'final'] as const;

type GradeComponent = typeof gradeComponents[number];

const gradeComponentLabels: Record<GradeComponent, string> = {
  oral: 'Điểm miệng',
  quiz15: 'Điểm 15 phút',
  quiz45: 'Điểm 45 phút',
  midterm: 'Điểm giữa kỳ',
  final: 'Điểm cuối kỳ',
};

const gradeComponentHeaderLabels: Record<GradeComponent, string> = {
  oral: 'Miệng',
  quiz15: "15'",
  quiz45: "45'",
  midterm: 'Giữa kỳ',
  final: 'Cuối kỳ',
};

const DEFAULT_COLUMN_COUNTS: Record<GradeComponent, number> = {
  oral: 3,
  quiz15: 3,
  quiz45: 1,
  midterm: 1,
  final: 1,
};

type EditFormState = Record<GradeComponent, string[]>;

const createInitialEditForm = (): EditFormState =>
  gradeComponents.reduce((acc, comp) => {
    acc[comp] = [''];
    return acc;
  }, {} as EditFormState);

type EditContext = {
  studentId: string;
  studentName: string;
  studentCode?: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className?: string;
  schoolYear: string;
  semester: string;
  gradeItems: Record<GradeComponent, number[]>;
};

type InlineEditContext = {
  studentId: string;
  studentName: string;
  studentCode?: string;
  classId: string;
  className?: string;
  schoolYear: string;
  semester: string;
  // Lưu form data cho tất cả các môn: key là subjectId
  subjectsForm: Map<string, EditFormState>;
  // Lưu gradeItems cho tất cả các môn: key là subjectId
  subjectsGradeItems: Map<string, Record<GradeComponent, number[]>>;
};

const parseScoreValue = (value: string): number | null => {
  if (!value || !value.trim()) return null;
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const num = Number(normalized);
  if (Number.isNaN(num) || num < 0 || num > 10) return null;
  return Number(num.toFixed(2));
};

const formatScoreValue = (score?: number): string => {
  if (typeof score !== 'number' || Number.isNaN(score)) return '';
  const normalized = Number(score.toFixed(2));
  return Number.isInteger(normalized) ? normalized.toFixed(0) : normalized.toString();
};

const formatDisplayScore = (score?: number): string => {
  if (typeof score !== 'number' || Number.isNaN(score)) return '-';
  return Number(score.toFixed(2)).toFixed(1);
};

const getGradeItemsList = (subject: any, component: GradeComponent): number[] => {
  const list = subject?.gradeItems?.[component];
  if (!Array.isArray(list)) return [];
  return list
    .map((value: any) => {
      if (typeof value === 'number') return Number(value);
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? Number.NaN : parsed;
      }
      return Number.NaN;
    })
    .filter((val: number) => !Number.isNaN(val));
};

const scoresEqual = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const valA = typeof a[i] === 'number' ? Number(a[i].toFixed(2)) : NaN;
    const valB = typeof b[i] === 'number' ? Number(b[i].toFixed(2)) : NaN;
    if (Number.isNaN(valA) || Number.isNaN(valB) || valA !== valB) {
      return false;
    }
  }
  return true;
};

// Helper functions để normalize ID và semester (giống HomeroomGradesPage)
const normalizeId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (value._id) return normalizeId(value._id);
    if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
      return value.toString();
    }
  }
  return String(value);
};

const normalizeConductSemester = (semester: string) => {
  if (!semester) return 'CN';
  const normalized = semester.toString().toUpperCase();
  if (normalized === '1' || normalized === 'HK1') return 'HK1';
  if (normalized === '2' || normalized === 'HK2') return 'HK2';
  if (normalized === 'CN' || normalized === 'CẢ NĂM') return 'CN';
  return normalized;
};

const AdminGradesPage: React.FC = () => {
  const { backendUser } = useAuth();
  const canEditGrades = useMemo(
    () =>
      !!backendUser &&
      (backendUser.role === 'admin' ||
        (backendUser.role === 'teacher' && backendUser.teacherFlags?.isLeader)),
    [backendUser]
  );
  const { schoolYears: allSchoolYears, currentYear, currentYearData } = useSchoolYears();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    schoolYear: '',
    semester: '',
    classId: '',
    subjectId: '',
    grade: '',
    keyword: '',
    academicLevel: '', // Filter theo học lực
    conduct: '', // Filter theo hạnh kiểm
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Data
  const [studentsGrades, setStudentsGrades] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);

  // Options
  const [semesters, setSemesters] = useState<any[]>([]);
  const { classes } = useClasses();
  const { subjects } = useSubjects();
  const [grades, setGrades] = useState<any[]>([]);
  const [gradeConfig, setGradeConfig] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<EditContext | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(createInitialEditForm());
  const [editSaving, setEditSaving] = useState(false);
  const [inlineEditContext, setInlineEditContext] = useState<InlineEditContext | null>(null);
  const [inlineSaving, setInlineSaving] = useState(false);
  // State để quản lý học sinh nào đang ở chế độ chỉnh sửa (theo studentId)
  const [editingStudents, setEditingStudents] = useState<Set<string>>(new Set());
  // State để quản lý view mode trong tab "Tổng quan điểm học sinh"
  const [overviewView, setOverviewView] = useState<'all' | 'hk1' | 'hk2' | 'year'>('all');
  // State để lưu hạnh kiểm từ API conduct (giống HomeroomGradesPage)
  const [conductRecords, setConductRecords] = useState<Map<string, any>>(new Map());
  const [conductLoading, setConductLoading] = useState(false);
  // State để quản lý công bố điểm
  const [publishingStudentId, setPublishingStudentId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  
  const visibleComponents = useMemo(() => {
    const weights = gradeConfig?.weights;
    if (!weights) return gradeComponents;
    const enabled = gradeComponents.filter((component) => {
      const weightValue = Number(weights[component] ?? 0);
      return weightValue > 0;
    });
    return enabled.length > 0 ? enabled : gradeComponents;
  }, [gradeConfig]);

  // ✅ Set default filters
  useEffect(() => {
    const defaultYear = currentYearData?.code || currentYear || (allSchoolYears.length > 0 ? allSchoolYears[allSchoolYears.length - 1].code : '');
    if (defaultYear && !filters.schoolYear) {
      setFilters(prev => ({ ...prev, schoolYear: defaultYear, semester: '1' }));
    }
  }, [allSchoolYears, currentYearData, currentYear]);

  // ✅ Reset dependent filters when schoolYear changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, grade: '', classId: '', subjectId: '' }));
  }, [filters.schoolYear]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.keyword, filters.academicLevel, filters.conduct, filters.classId, filters.grade, filters.subjectId]);

  useEffect(() => {
    setInlineEditContext(null);
    setInlineSaving(false);
  }, [filters.schoolYear, filters.semester]);

  // ✅ Lấy số cột từ cấu hình (không dựa vào số điểm hiện có)
  const getConfiguredColumnCount = useCallback(
    (component: GradeComponent) => {
      const configured = gradeConfig?.columnCounts?.[component];
      return typeof configured === 'number' && configured > 0
        ? configured
        : DEFAULT_COLUMN_COUNTS[component] ?? 1;
    },
    [gradeConfig]
  );

  // ✅ Load grade config (weights/column counts) theo năm học & học kỳ
  const resolveColumnCount = useCallback(
    (component: GradeComponent, existingLength = 0) => {
      const configured = gradeConfig?.columnCounts?.[component];
      const base =
        typeof configured === 'number' && configured > 0
          ? configured
          : DEFAULT_COLUMN_COUNTS[component] ?? 1;
      const safeExisting = Number.isFinite(existingLength) && existingLength > 0 ? existingLength : 0;
      return Math.max(base, safeExisting, 1);
    },
    [gradeConfig]
  );

  const initFormForCounts = useCallback(() => {
    const form = {} as EditFormState;
    gradeComponents.forEach((component) => {
      const count = resolveColumnCount(component);
      form[component] = Array.from({ length: count }, () => '');
    });
    return form;
  }, [resolveColumnCount]);

  const fetchGradeConfig = useCallback(async () => {
    if (!filters.schoolYear || !filters.semester || filters.semester === 'year') {
      setGradeConfig(null);
      return;
    }
    try {
      const res = await gradeConfigApi.getConfig({
        schoolYear: filters.schoolYear,
        semester: filters.semester,
      });
      const payload = res?.data || res || null;
      setGradeConfig(payload);
    } catch (err) {
      console.error('Load grade config failed:', err);
      setGradeConfig(null);
    }
  }, [filters.schoolYear, filters.semester]);

  useEffect(() => {
    fetchGradeConfig();
  }, [fetchGradeConfig]);

  // ✅ Load semesters, grades (classes & subjects via hooks)
  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const [semRes, gradeRes] = await Promise.all([
          schoolConfigApi.getSemesters(),
          schoolConfigApi.getGrades(),
        ]);
        setSemesters(semRes.data || []);
        setGrades(gradeRes.data || gradeRes || []);
      } catch (err) {
        console.error('Load base data failed:', err);
      }
    };
    fetchBaseData();
  }, []);

  // ✅ Load students grades
  const fetchStudentsGrades = async (opts?: { overview?: boolean }) => {
    if (!filters.schoolYear) {
      toast.error('Vui lòng chọn năm học');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...filters,
        // Overview hoặc "Cả năm": xem cả năm, bỏ lọc học kỳ
        semester: opts?.overview || filters.semester === 'year' ? undefined : filters.semester,
      };
      const res = await gradesApi.getAllStudentsGradesWithTrend(payload);
      const data = res.data || [];
      // Debug: Kiểm tra dữ liệu học lực
      // console.log('Students grades data:', data.map((s: any) => ({
      //   name: s.name,
      //   academicLevelHK1: s.academicLevelHK1,
      //   academicLevelHK2: s.academicLevelHK2,
      //   academicLevelCN: s.academicLevelCN,
      //   academicLevel: s.academicLevel
      // })));
      setStudentsGrades(data);
    } catch (err: any) {
      console.error('Load grades failed:', err);
      toast.error(err.response?.data?.message || 'Không thể tải điểm');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Load statistics
  const fetchStatistics = async () => {
    if (!filters.schoolYear || !filters.semester || filters.semester === 'year') {
      if (filters.semester === 'year') {
        toast.error('Thống kê chỉ có thể xem theo từng học kỳ');
      } else {
        toast.error('Vui lòng chọn năm học và học kỳ');
      }
      return;
    }
    setLoading(true);
    try {
      const res = await gradesApi.getStatistics({
        schoolYear: filters.schoolYear,
        semester: filters.semester,
        classId: filters.classId || undefined,
        grade: filters.grade || undefined,
      });
      setStatistics(res.data || null);
    } catch (err: any) {
      console.error('Load statistics failed:', err);
      toast.error(err.response?.data?.message || 'Không thể tải thống kê');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Lấy hạnh kiểm từ API conduct (giống HomeroomGradesPage)
  const fetchConductRecords = useCallback(async () => {
    if (!filters.schoolYear) {
      setConductRecords(new Map());
      return;
    }
    try {
      setConductLoading(true);
      // ✅ Lấy hạnh kiểm theo semester: nếu đang ở tab overview thì dùng overviewView, nếu không thì dùng filters.semester
      // Nếu không có semester nào, mặc định lấy CN
      let semesterToUse = 'CN';
      if (activeTab === 'overview') {
        if (overviewView === 'hk1') semesterToUse = '1';
        else if (overviewView === 'hk2') semesterToUse = '2';
        else if (overviewView === 'year' || overviewView === 'all') semesterToUse = 'CN';
      } else {
        semesterToUse = filters.semester || 'CN';
      }
      const conductSemester = normalizeConductSemester(semesterToUse);
      
      // Lấy hạnh kiểm cho tất cả lớp hoặc lớp được chọn
      const classIds = filters.classId 
        ? [filters.classId]
        : (filters.grade 
          ? classes.filter(c => c.grade === filters.grade).map(c => c._id)
          : classes.map(c => c._id));
      
      if (classIds.length === 0) {
        setConductRecords(new Map());
        return;
      }
      
      // Lấy hạnh kiểm cho tất cả các lớp
      const allConductRecords = new Map<string, any>();
      for (const classId of classIds) {
        try {
          const res = await conductApi.getConducts({
            year: filters.schoolYear,
            semester: conductSemester,
            classId: classId,
          });
          const records = Array.isArray(res?.data) ? res.data : res?.data?.data ?? [];
          records.forEach((record: any) => {
            const sid = normalizeId(record?.studentId?._id ?? record?.studentId);
            // ✅ Chỉ lấy hạnh kiểm đã chốt
            if (sid && record?.conductStatus === 'locked') {
              allConductRecords.set(sid, record);
            }
          });
        } catch (err) {
          console.error(`Error loading conduct for class ${classId}:`, err);
        }
      }
      setConductRecords(allConductRecords);
    } catch (error: any) {
      console.error('Error loading conduct records:', error);
      toast.error(error?.response?.data?.message || 'Không thể tải dữ liệu hạnh kiểm');
    } finally {
      setConductLoading(false);
    }
  }, [filters.schoolYear, filters.semester, filters.classId, filters.grade, activeTab, overviewView, classes]);

  useEffect(() => {
    fetchConductRecords();
  }, [fetchConductRecords]);

  // ✅ Load audit log
  const fetchAuditLog = async () => {
    setLoading(true);
    try {
      const res = await gradesApi.getAuditLog({
        schoolYear: filters.schoolYear || undefined,
        semester: filters.semester || undefined,
        classId: filters.classId || undefined,
        subjectId: filters.subjectId || undefined,
        limit: 100,
      });
      setAuditLog(res.data || []);
    } catch (err: any) {
      console.error('Load audit log failed:', err);
      toast.error(err.response?.data?.message || 'Không thể tải lịch sử');
    } finally {
      setLoading(false);
    }
  };

  const resetEditState = useCallback(() => {
    setEditingContext(null);
    setEditForm(initFormForCounts());
    setEditSaving(false);
  }, [initFormForCounts]);

  const handleEditInputChange = (component: GradeComponent, index: number, value: string) => {
    setEditForm((prev) => {
      const next = { ...prev };
      const entries = [...(next[component] || [])];
      entries[index] = value;
      next[component] = entries;
      return next;
    });
  };

  const handleInlineInputChange = (subjectId: string, component: GradeComponent, index: number, value: string) => {
    setInlineEditContext((prev) => {
      if (!prev) return prev;
      const nextSubjectsForm = new Map(prev.subjectsForm);
      const currentForm = nextSubjectsForm.get(subjectId) || createInitialEditForm();
      const nextForm = { ...currentForm };
      const entries = [...(nextForm[component] || [])];
      entries[index] = value;
      nextForm[component] = entries;
      nextSubjectsForm.set(subjectId, nextForm);
      return { ...prev, subjectsForm: nextSubjectsForm };
    });
  };

  const handleOpenEditDialog = (student: any, subject: any) => {
    if (!canEditGrades) {
      toast.error('Bạn không có quyền sửa điểm.');
      return;
    }
    const subjectId = subject?.subject?._id;
    if (!subjectId) {
      toast.error('Không xác định được môn học để sửa điểm.');
      return;
    }
    const schoolYear = filters.schoolYear || subject.schoolYear;
    const semester = filters.semester || subject.semester;
    if (!schoolYear || !semester) {
      toast.error('Vui lòng chọn năm học và học kỳ trước khi sửa điểm.');
      return;
    }
    const classId =
      filters.classId ||
      student.class?._id ||
      subject.class?._id ||
      student.classId ||
      subject.classId?._id;
    if (!classId) {
      toast.error('Không xác định được lớp học để sửa điểm.');
      return;
    }

    const gradeItems = gradeComponents.reduce((acc, comp) => {
      const rawList = subject?.gradeItems?.[comp];
      acc[comp] = Array.isArray(rawList)
        ? rawList.map((score: number) => Number(score))
        : [];
      return acc;
    }, {} as Record<GradeComponent, number[]>);

    const nextForm = initFormForCounts();
    gradeComponents.forEach((component) => {
      const existing = gradeItems[component] || [];
      const count = resolveColumnCount(component, existing.length);
      nextForm[component] = Array.from({ length: count }, (_, idx) =>
        formatScoreValue(existing[idx])
      );
    });
    setEditForm(nextForm);

    setEditingContext({
      studentId: student._id,
      studentName: student.name,
      studentCode: student.studentCode,
      subjectId,
      subjectName: subject.subject?.name || 'Môn học',
      classId,
      className: student.class?.className || subject.class?.className,
      schoolYear,
      semester,
      gradeItems,
    });
    setIsEditDialogOpen(true);
  };

  // Hàm bật/tắt chế độ chỉnh sửa cho toàn bộ học sinh
  const handleToggleStudentEdit = (student: any) => {
    if (!canEditGrades) {
      toast.error('Bạn không có quyền sửa điểm.');
      return;
    }

    const studentId = student._id;
    const isCurrentlyEditing = editingStudents.has(studentId);

    if (isCurrentlyEditing) {
      // Tắt chế độ chỉnh sửa
      setEditingStudents(prev => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
      setInlineEditContext(null);
    } else {
      // Bật chế độ chỉnh sửa - khởi tạo cho TẤT CẢ các môn
      const subjects = student.subjects || [];
      if (subjects.length === 0) {
        toast.error('Học sinh này chưa có môn học nào.');
        return;
      }

      const firstSubject = subjects[0];
      const schoolYear = filters.schoolYear || firstSubject.schoolYear;
      const semester = filters.semester || firstSubject.semester;
      if (!schoolYear || !semester || semester === 'year') {
        if (semester === 'year') {
          toast.error('Vui lòng chọn học kỳ cụ thể (HK1 hoặc HK2) để chỉnh sửa điểm.');
        } else {
          toast.error('Vui lòng chọn năm học và học kỳ trước khi sửa điểm.');
        }
        return;
      }

      const classId =
        filters.classId ||
        student.class?._id ||
        firstSubject.class?._id ||
        student.classId ||
        firstSubject.classId?._id;
      if (!classId) {
        toast.error('Không xác định được lớp học để sửa điểm.');
        return;
      }

      // Khởi tạo form data cho tất cả các môn
      const subjectsForm = new Map<string, EditFormState>();
      const subjectsGradeItems = new Map<string, Record<GradeComponent, number[]>>();

      subjects.forEach((subject: any) => {
        const subjectId = subject?.subject?._id || subject._id;
        if (!subjectId) return;

        const gradeItems = gradeComponents.reduce((acc, comp) => {
          const rawList = subject?.gradeItems?.[comp];
          acc[comp] = Array.isArray(rawList)
            ? rawList.map((score: number) => Number(score))
            : [];
          return acc;
        }, {} as Record<GradeComponent, number[]>);

        const nextForm = {} as EditFormState;
        gradeComponents.forEach((component) => {
          const existing = gradeItems[component] || [];
          const configuredCount = getConfiguredColumnCount(component);
          const limitedExisting = existing.slice(0, configuredCount);
          nextForm[component] = Array.from({ length: configuredCount }, (_, idx) =>
            formatScoreValue(limitedExisting[idx])
          );
        });

        subjectsForm.set(subjectId, nextForm);
        subjectsGradeItems.set(subjectId, gradeItems);
      });

      setEditingStudents(prev => new Set(prev).add(studentId));
      setInlineEditContext({
        studentId: student._id,
        studentName: student.name,
        studentCode: student.studentCode,
        classId,
        className: student.class?.className || firstSubject.class?.className,
        schoolYear,
        semester,
        subjectsForm,
        subjectsGradeItems,
      });
    }
  };


  const handleCancelInlineEdit = () => {
    if (inlineEditContext) {
      setEditingStudents(prev => {
        const next = new Set(prev);
        next.delete(inlineEditContext.studentId);
        return next;
      });
    }
    setInlineEditContext(null);
    setInlineSaving(false);
  };

  const handleSaveInlineEdit = async () => {
    if (!inlineEditContext) return;
    setInlineSaving(true);
    try {
      const requests: Promise<any>[] = [];
      const {
        studentId,
        classId,
        schoolYear,
        semester,
        subjectsForm,
        subjectsGradeItems,
      } = inlineEditContext;

      // Lưu điểm cho tất cả các môn
      subjectsForm.forEach((form, subjectId) => {
        const gradeItems = subjectsGradeItems.get(subjectId) || {};

        visibleComponents.forEach((component) => {
          const entries = form[component] || [];
          const parsedScores = entries
            .map((value) => parseScoreValue(value))
            .filter((value): value is number => value !== null);
          const originalScores = gradeItems[component] || [];
          const configuredCount = getConfiguredColumnCount(component);

          // ✅ Chỉ lưu đúng số điểm theo cấu hình
          const scoresToSave = parsedScores.slice(0, configuredCount);

          if (scoresToSave.length === 0) {
            // Nếu không có điểm nào, xóa tất cả điểm của component này
            if (originalScores.length > 0) {
              requests.push(
                gradesApi.deleteGradeItems({
                  studentId,
                  subjectId,
                  component,
                  classId,
                  schoolYear,
                  semester,
                })
              );
            }
            return;
          }

          // So sánh với số điểm hiện có (chỉ lấy số điểm bằng cấu hình)
          const limitedOriginal = originalScores.slice(0, configuredCount);
          if (scoresEqual(scoresToSave, limitedOriginal)) {
            // Nếu có điểm vượt quá cấu hình, vẫn cần xóa chúng
            if (originalScores.length > configuredCount) {
              // Xóa tất cả và tạo lại để đảm bảo chỉ có đúng số điểm theo cấu hình
              requests.push(
                gradesApi.deleteGradeItems({
                  studentId,
                  subjectId,
                  component,
                  classId,
                  schoolYear,
                  semester,
                })
              );
              requests.push(
                gradesApi.upsertGradeItems({
                  studentId,
                  subjectId,
                  component,
                  scores: scoresToSave,
                  classId,
                  schoolYear,
                  semester,
                })
              );
            }
            return;
          }

          // Nếu có thay đổi hoặc số điểm vượt quá cấu hình, xóa tất cả và tạo lại
          if (originalScores.length > 0) {
            requests.push(
              gradesApi.deleteGradeItems({
                studentId,
                subjectId,
                component,
                classId,
                schoolYear,
                semester,
              })
            );
          }
          requests.push(
            gradesApi.upsertGradeItems({
              studentId,
              subjectId,
              component,
              scores: scoresToSave,
              classId,
              schoolYear,
              semester,
            })
          );
        });
      });

      if (requests.length === 0) {
        toast.info('Không có thay đổi nào cần lưu.');
        setEditingStudents(prev => {
          const next = new Set(prev);
          next.delete(inlineEditContext.studentId);
          return next;
        });
        setInlineEditContext(null);
        return;
      }

      await Promise.all(requests);
      toast.success('Đã cập nhật điểm học sinh thành công.');
      setEditingStudents(prev => {
        const next = new Set(prev);
        next.delete(inlineEditContext.studentId);
        return next;
      });
      setInlineEditContext(null);
      fetchStudentsGrades();
      if (activeTab === 'audit') {
        fetchAuditLog();
      }
    } catch (err: any) {
      console.error('Error updating inline grades:', err);
      toast.error(err?.response?.data?.message || 'Không thể cập nhật điểm');
    } finally {
      setInlineSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingContext) return;
    setEditSaving(true);
    try {
      const requests: Promise<any>[] = [];
      const { studentId, subjectId, classId, schoolYear, semester, gradeItems } = editingContext;

      visibleComponents.forEach((component) => {
        const entries = editForm[component] || [];
        const parsedScores = entries
          .map((value) => parseScoreValue(value))
          .filter((value): value is number => value !== null);
        const originalScores = gradeItems[component] || [];
        const configuredCount = getConfiguredColumnCount(component);

        // ✅ Chỉ lưu đúng số điểm theo cấu hình
        const scoresToSave = parsedScores.slice(0, configuredCount);

        if (scoresToSave.length === 0) {
          // Nếu không có điểm nào, xóa tất cả điểm của component này
          if (originalScores.length > 0) {
            requests.push(
              gradesApi.deleteGradeItems({
                studentId,
                subjectId,
                component,
                classId,
                schoolYear,
                semester,
              })
            );
          }
          return;
        }

        // So sánh với số điểm hiện có (chỉ lấy số điểm bằng cấu hình)
        const limitedOriginal = originalScores.slice(0, configuredCount);
        if (scoresEqual(scoresToSave, limitedOriginal)) {
          // Nếu có điểm vượt quá cấu hình, vẫn cần xóa chúng
          if (originalScores.length > configuredCount) {
            // Xóa tất cả và tạo lại để đảm bảo chỉ có đúng số điểm theo cấu hình
            requests.push(
              gradesApi.deleteGradeItems({
                studentId,
                subjectId,
                component,
                classId,
                schoolYear,
                semester,
              })
            );
            requests.push(
              gradesApi.upsertGradeItems({
                studentId,
                subjectId,
                component,
                scores: scoresToSave,
                classId,
                schoolYear,
                semester,
              })
            );
          }
          return;
        }

        // Nếu có thay đổi hoặc số điểm vượt quá cấu hình, xóa tất cả và tạo lại
        if (originalScores.length > 0) {
          requests.push(
            gradesApi.deleteGradeItems({
              studentId,
              subjectId,
              component,
              classId,
              schoolYear,
              semester,
            })
          );
        }
        requests.push(
          gradesApi.upsertGradeItems({
            studentId,
            subjectId,
            component,
            scores: scoresToSave,
            classId,
            schoolYear,
            semester,
          })
        );
      });

      if (requests.length === 0) {
        toast.info('Không có thay đổi nào cần lưu.');
        setIsEditDialogOpen(false);
        resetEditState();
        return;
      }

      await Promise.all(requests);
      toast.success('Đã cập nhật điểm học sinh thành công.');
      setIsEditDialogOpen(false);
      resetEditState();
      fetchStudentsGrades();
      if (activeTab === 'audit') {
        fetchAuditLog();
      }
    } catch (err: any) {
      console.error('Error updating grades:', err);
      toast.error(err?.response?.data?.message || 'Không thể cập nhật điểm');
    } finally {
      setEditSaving(false);
    }
  };

  // ✅ Load data when tab changes
  useEffect(() => {
    if (activeTab === 'overview') {
      // Overview không phụ thuộc học kỳ, xem dữ liệu cả năm
      fetchStudentsGrades({ overview: true });
    } else if (activeTab === 'details') {
      fetchStudentsGrades();
    } else if (activeTab === 'statistics') {
      fetchStatistics();
    } else if (activeTab === 'audit') {
      fetchAuditLog();
    }
  }, [activeTab, filters.schoolYear, filters.semester, overviewView]);

  // ✅ Handle delete grade item
  const handleDeleteGradeItem = async (itemId: string) => {
    if (!confirm('Bạn có chắc muốn xóa điểm này?')) return;
    try {
      await gradesApi.deleteGradeItem(itemId);
      toast.success('Đã xóa điểm thành công');
      fetchStudentsGrades();
      fetchAuditLog();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xóa điểm');
    }
  };

  // ✅ Công bố điểm cho 1 học sinh (từng môn)
  const handlePublishStudent = async (studentId: string, subjectId: string) => {
    if (!filters.schoolYear || !filters.semester) {
      toast.error('Vui lòng chọn năm học và học kỳ');
      return;
    }

    const student = studentsGrades.find(s => s._id === studentId);
    const studentName = student?.name || 'học sinh';
    const studentCode = student?.studentCode || '';
    const subject = student?.subjects?.find((s: any) => (s.subject?._id || s._id) === subjectId);
    const subjectName = subject?.subject?.name || 'môn học';

    const result = await Swal.fire({
      icon: 'question',
      title: 'Xác nhận công bố điểm',
      html: `
        <div style="text-align: left;">
          <p><strong>Học sinh:</strong> ${studentName}${studentCode ? ` (${studentCode})` : ''}</p>
          <p><strong>Môn học:</strong> ${subjectName}</p>
          <p><strong>Năm học:</strong> ${filters.schoolYear}</p>
          <p><strong>Học kỳ:</strong> ${filters.semester}</p>
          <p style="margin-top: 15px; color: #666;">Sau khi công bố, học sinh và GVCN sẽ nhìn thấy điểm chính thức.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Công bố',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      width: '500px',
    });

    if (!result.isConfirmed) return;

    try {
      setPublishingStudentId(`${studentId}-${subjectId}`);
      await gradesApi.publishStudentGrade({
        studentId,
        subjectId,
        schoolYear: filters.schoolYear,
        semester: String(filters.semester),
      });
      toast.success(`✅ Đã công bố điểm ${subjectName} cho ${studentName} (HK${filters.semester})`, {
        duration: 3000,
      });
      // ✅ Chỉ cập nhật trạng thái công bố trong local state, không reload toàn bộ page
      setStudentsGrades(prev => prev.map(st => {
        if (String(st._id) === String(studentId)) {
          return {
            ...st,
            subjects: st.subjects?.map((subj: any) => {
              const subjId = subj.subject?._id || subj._id;
              if (String(subjId) === String(subjectId)) {
                return {
                  ...subj,
                  isOfficial: true,
                  officialAt: new Date().toISOString(),
                };
              }
              return subj;
            }) || [],
          };
        }
        return st;
      }));
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Công bố điểm thất bại';
      toast.error(`❌ ${msg}`, {
        duration: 3000,
      });
    } finally {
      setPublishingStudentId(null);
    }
  };

  // ✅ Get color for average score
  const getAverageColor = (avg: number | null | undefined): string => {
    if (avg === null || avg === undefined) return 'text-gray-500';
    if (avg >= 8) return 'text-yellow-600 font-bold';
    if (avg >= 6.5) return 'text-blue-600 font-semibold';
    if (avg >= 5.0) return 'text-black font-semibold';
    return 'text-red-600 font-bold';
  };

  // ✅ Get academic level badge
  const getAcademicLevelBadge = (level: string | null | undefined) => {
    if (!level) {
      return <span className="text-muted-foreground text-sm">Chưa có</span>;
    }
    const colorMap: Record<string, string> = {
      'Giỏi': 'bg-green-100 text-green-800',
      'Khá': 'bg-blue-100 text-blue-800',
      'Trung bình': 'bg-yellow-100 text-yellow-800',
      'Yếu': 'bg-red-100 text-red-800',
    };
    return (
      <Badge className={colorMap[level] || 'bg-gray-100 text-gray-800'}>
        {level}
      </Badge>
    );
  };

  // ✅ Export to Excel - Overview tab
  const exportToExcelOverview = () => {
    const filteredData = studentsGrades
      .filter(student => {
        if (filters.keyword) {
          const keyword = filters.keyword.toLowerCase();
          if (!student.name?.toLowerCase().includes(keyword) &&
              !student.studentCode?.toLowerCase().includes(keyword)) {
            return false;
          }
        }
        if (filters.academicLevel && student.academicLevel !== filters.academicLevel) {
          return false;
        }
        if (filters.conduct && student.conduct !== filters.conduct) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const classNameA = a.class?.className || '';
        const classNameB = b.class?.className || '';
        return classNameA.localeCompare(classNameB, 'vi', { numeric: true, sensitivity: 'base' });
      });

    const headers = ['STT', 'Họ tên', 'Mã HS', 'Lớp', 'ĐTB HK1', 'ĐTB HK2', 'ĐTB Cả năm', 'Học lực', 'Hạnh kiểm', 'Xếp hạng lớp', 'Xếp hạng khối'];
    const rows = filteredData.map((student, idx) => [
      idx + 1,
      student.name || '',
      student.studentCode || '',
      student.class?.className || '',
      student.hk1Average ?? student.semester1Average ?? '',
      student.hk2Average ?? student.semester2Average ?? '',
      student.yearAverage ?? student.gpa ?? '',
      student.academicLevel || '',
      student.conduct || '',
      student.rank || '',
      student.rankGrade || '',
    ]);

    // Create HTML table for Excel
    let html = '<html><head><meta charset="utf-8"></head><body><table border="1">';
    
    // Headers
    html += '<tr>';
    headers.forEach(header => {
      html += `<th style="background-color: #4472C4; color: white; font-weight: bold; padding: 8px;">${header}</th>`;
    });
    html += '</tr>';
    
    // Rows
    rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td style="padding: 5px;">${cell}</td>`;
      });
      html += '</tr>';
    });
    
    html += '</table></body></html>';

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Bang_diem_tong_quan_${filters.schoolYear || 'all'}_${new Date().getTime()}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã xuất file Excel thành công');
  };

  // ✅ Export to Excel - Details tab
  const exportToExcelDetails = () => {
    const filteredData = studentsGrades
      .filter(student => {
        if (filters.keyword) {
          const keyword = filters.keyword.toLowerCase();
          if (!student.name?.toLowerCase().includes(keyword) &&
              !student.studentCode?.toLowerCase().includes(keyword)) {
            return false;
          }
        }
        if (filters.academicLevel && student.academicLevel !== filters.academicLevel) {
          return false;
        }
        if (filters.conduct && student.conduct !== filters.conduct) {
          return false;
        }
        if (filters.subjectId && !student.subjects?.some((s: any) => s.subject?._id === filters.subjectId)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const classNameA = a.class?.className || '';
        const classNameB = b.class?.className || '';
        return classNameA.localeCompare(classNameB, 'vi', { numeric: true, sensitivity: 'base' });
      });

    // Create HTML table for Excel with detailed grades
    let html = '<html><head><meta charset="utf-8"></head><body>';
    
    filteredData.forEach((student, studentIdx) => {
      html += `<h3 style="margin-top: 20px; margin-bottom: 10px;">${student.name} (${student.studentCode}) - ${student.class?.className || ''}</h3>`;
      
      // Thông tin tổng quan học sinh
      html += '<div style="margin-bottom: 10px; padding: 8px; background-color: #f0f0f0;">';
      html += `<strong>ĐTB HK1:</strong> ${student.hk1Average ?? student.semester1Average ?? '-'} | `;
      html += `<strong>ĐTB HK2:</strong> ${student.hk2Average ?? student.semester2Average ?? '-'} | `;
      html += `<strong>ĐTB Cả năm:</strong> ${student.yearAverage ?? student.gpa ?? '-'} | `;
      html += `<strong>Học lực:</strong> ${student.academicLevel || '-'} | `;
      html += `<strong>Hạnh kiểm:</strong> ${student.conduct || '-'}`;
      html += '</div>';
      
      html += '<table border="1" style="width: 100%; margin-bottom: 30px;">';
      
      // Headers
      const detailHeaders = ['Môn học', ...visibleComponents.map(comp => gradeComponentHeaderLabels[comp] || comp), 'ĐTB môn'];
      html += '<tr>';
      detailHeaders.forEach(header => {
        html += `<th style="background-color: #4472C4; color: white; font-weight: bold; padding: 8px;">${header}</th>`;
      });
      html += '</tr>';
      
      // Subject rows
      student.subjects?.forEach((subject: any) => {
        html += '<tr>';
        html += `<td style="padding: 5px; font-weight: bold;">${subject.subject?.name || '-'}</td>`;
        
        visibleComponents.forEach(component => {
          const gradeItems = getGradeItemsList(subject, component);
          const configuredCount = getConfiguredColumnCount(component);
          const gradeItemsList = gradeItems.slice(0, configuredCount);
          
          if (gradeItemsList.length > 0) {
            html += `<td style="padding: 5px;">${gradeItemsList.map((score: number) => score.toFixed(1)).join(', ')}</td>`;
          } else {
            html += '<td style="padding: 5px;">-</td>';
          }
        });
        
        html += `<td style="padding: 5px; font-weight: bold;">${subject.average ? subject.average.toFixed(1) : '-'}</td>`;
        html += '</tr>';
      });
      
      html += '</table>';
    });
    
    html += '</body></html>';

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Bang_diem_chi_tiet_${filters.schoolYear || 'all'}_${new Date().getTime()}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã xuất file Excel thành công');
  };

  // ✅ Check if student has low grades
  const hasLowGrades = (student: any): boolean => {
    const hk1 = student.hk1Average ?? student.semester1Average;
    const hk2 = student.hk2Average ?? student.semester2Average;
    const year = student.yearAverage ?? student.gpa;
    
    return (hk1 !== null && hk1 < 5.0) || 
           (hk2 !== null && hk2 < 5.0) || 
           (year !== null && year < 5.0);
  };

  // ✅ Check if student is at risk
  const isAtRisk = (student: any): boolean => {
    const hk1 = student.hk1Average ?? student.semester1Average;
    const hk2 = student.hk2Average ?? student.semester2Average;
    const year = student.yearAverage ?? student.gpa;
    
    // Nguy cơ yếu: điểm < 5.5 hoặc học lực Yếu
    return (hk1 !== null && hk1 < 5.5) || 
           (hk2 !== null && hk2 < 5.5) || 
           (year !== null && year < 5.5) ||
           student.academicLevel === 'Yếu';
  };

  return (
    <>
      <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">📊 Quản lý điểm - Admin</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-8 gap-4 mb-6">
            <Select
              value={filters.schoolYear}
              onValueChange={(v) => setFilters(prev => ({ ...prev, schoolYear: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Năm học" />
              </SelectTrigger>
              <SelectContent>
                {allSchoolYears.map((y) => (
                  <SelectItem key={y.code} value={y.code}>
                    {y.name} {currentYearData?.code === y.code && '(Hiện tại)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.semester}
              onValueChange={(v) => setFilters(prev => ({ ...prev, semester: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Học kỳ" />
              </SelectTrigger>
              <SelectContent>
                {semesters.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
                <SelectItem value="year">Cả năm</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.grade || "all"}
              onValueChange={(v) => setFilters(prev => ({ ...prev, grade: v === "all" ? '' : v, classId: '' }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Khối" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả khối</SelectItem>
                {grades.map((g) => (
                  <SelectItem key={g.code || g} value={String(g.code || g)}>
                    Khối {g.name || g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.classId || "all"}
              onValueChange={(v) => setFilters(prev => ({ ...prev, classId: v === "all" ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Lớp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả lớp</SelectItem>
                {classes
                  .filter(c => {
                    const classYearCode = c.year;
                    return (!filters.schoolYear || String(classYearCode) === String(filters.schoolYear));
                  })
                  .filter(c => !filters.grade || String(c.grade) === String(filters.grade))
                  .map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.className}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.subjectId || "all"}
              onValueChange={(v) => setFilters(prev => ({ ...prev, subjectId: v === "all" ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Môn học" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả môn</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Tìm theo tên, mã HS..."
                value={filters.keyword}
                onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.academicLevel || "all"}
              onValueChange={(v) => setFilters(prev => ({ ...prev, academicLevel: v === "all" ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Học lực" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả học lực</SelectItem>
                <SelectItem value="Giỏi">Giỏi</SelectItem>
                <SelectItem value="Khá">Khá</SelectItem>
                <SelectItem value="Trung bình">Trung bình</SelectItem>
                <SelectItem value="Yếu">Yếu</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.conduct || "all"}
              onValueChange={(v) => setFilters(prev => ({ ...prev, conduct: v === "all" ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Hạnh kiểm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả hạnh kiểm</SelectItem>
                <SelectItem value="Tốt">Tốt</SelectItem>
                <SelectItem value="Khá">Khá</SelectItem>
                <SelectItem value="Trung bình">Trung bình</SelectItem>
                <SelectItem value="Yếu">Yếu</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              onClick={() => activeTab === 'overview' ? exportToExcelOverview() : exportToExcelDetails()} 
              variant="outline" 
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Xuất Excel
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="details">Chi tiết điểm</TabsTrigger>
              <TabsTrigger value="statistics">Thống kê</TabsTrigger>
              <TabsTrigger value="audit">Lịch sử</TabsTrigger>
            </TabsList>

            {/* Tab: Overview */}
            <TabsContent value="overview" className="mt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Tổng quan điểm học sinh</h3>
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-1 border rounded-md p-1">
                      <Button
                        size="sm"
                        variant={overviewView === 'all' ? 'default' : 'ghost'}
                        onClick={() => setOverviewView('all')}
                        className="h-8"
                      >
                        Tất cả
                      </Button>
                      <Button
                        size="sm"
                        variant={overviewView === 'hk1' ? 'default' : 'ghost'}
                        onClick={() => setOverviewView('hk1')}
                        className="h-8"
                      >
                        HK1
                      </Button>
                      <Button
                        size="sm"
                        variant={overviewView === 'hk2' ? 'default' : 'ghost'}
                        onClick={() => setOverviewView('hk2')}
                        className="h-8"
                      >
                        HK2
                      </Button>
                      <Button
                        size="sm"
                        variant={overviewView === 'year' ? 'default' : 'ghost'}
                        onClick={() => setOverviewView('year')}
                        className="h-8"
                      >
                        Cả năm
                      </Button>
                    </div>
                    <Button onClick={() => fetchStudentsGrades()} disabled={loading}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Làm mới
                    </Button>
                  </div>
                </div>
                {loading ? (
                  <div className="text-center py-8">Đang tải...</div>
                ) : studentsGrades.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Chưa có dữ liệu</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>STT</TableHead>
                          <TableHead>Họ tên</TableHead>
                          <TableHead>Mã HS</TableHead>
                          <TableHead>Lớp</TableHead>
                          <TableHead>ĐTB HK1</TableHead>
                          <TableHead>ĐTB HK2</TableHead>
                          <TableHead>ĐTB Cả năm</TableHead>
                          <TableHead>Học lực</TableHead>
                          <TableHead>Hạnh kiểm</TableHead>
                          <TableHead>Xếp hạng (Lớp/Khối)</TableHead>
                          <TableHead>Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filtered = studentsGrades
                            .filter(student => {
                              if (filters.keyword) {
                                const keyword = filters.keyword.toLowerCase();
                                if (!student.name?.toLowerCase().includes(keyword) &&
                                    !student.studentCode?.toLowerCase().includes(keyword)) {
                                  return false;
                                }
                              }
                              if (filters.academicLevel && student.academicLevel !== filters.academicLevel) {
                                return false;
                              }
                              if (filters.conduct && student.conduct !== filters.conduct) {
                                return false;
                              }
                              return true;
                            })
                            .sort((a, b) => {
                              const classNameA = a.class?.className || '';
                              const classNameB = b.class?.className || '';
                              return classNameA.localeCompare(classNameB, 'vi', { numeric: true, sensitivity: 'base' });
                            });
                          
                          const totalPages = Math.ceil(filtered.length / itemsPerPage);
                          const startIndex = (currentPage - 1) * itemsPerPage;
                          const endIndex = startIndex + itemsPerPage;
                          const paginatedData = filtered.slice(startIndex, endIndex);
                          
                          return paginatedData.map((student, idx) => {
                            const isLowGrade = hasLowGrades(student);
                            const isRisk = isAtRisk(student);
                            
                            return (
                            <TableRow 
                              key={student._id}
                              className={
                                isLowGrade 
                                  ? 'bg-red-50 hover:bg-red-100' 
                                  : isRisk 
                                    ? 'bg-yellow-50 hover:bg-yellow-100' 
                                    : ''
                              }
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span>{startIndex + idx + 1}</span>
                                  {isLowGrade && (
                                    <div title="Điểm thấp (< 5.0)">
                                      <AlertTriangle className="h-4 w-4 text-red-600" />
                                    </div>
                                  )}
                                  {isRisk && !isLowGrade && (
                                    <div title="Nguy cơ yếu">
                                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {student.name || '-'}
                                {isLowGrade && (
                                  <Badge variant="destructive" className="ml-2 text-xs">Điểm thấp</Badge>
                                )}
                                {isRisk && !isLowGrade && (
                                  <Badge variant="outline" className="ml-2 text-xs border-yellow-500 text-yellow-700">Nguy cơ</Badge>
                                )}
                              </TableCell>
                              <TableCell>{student.studentCode || '-'}</TableCell>
                              <TableCell>{student.class?.className || '-'}</TableCell>
                              {/* ĐTB HK1 */}
                              <TableCell className={getAverageColor(student.hk1Average ?? student.semester1Average ?? null)}>
                                {typeof (student.hk1Average ?? student.semester1Average) === 'number' 
                                  ? (student.hk1Average ?? student.semester1Average).toFixed(2) 
                                  : '-'}
                              </TableCell>
                              {/* ĐTB HK2 */}
                              <TableCell className={getAverageColor(student.hk2Average ?? student.semester2Average ?? null)}>
                                {typeof (student.hk2Average ?? student.semester2Average) === 'number' 
                                  ? (student.hk2Average ?? student.semester2Average).toFixed(2) 
                                  : '-'}
                              </TableCell>
                              {/* ĐTB Cả năm */}
                              <TableCell className={getAverageColor(student.yearAverage ?? student.gpa ?? null)}>
                                {typeof (student.yearAverage ?? student.gpa) === 'number' 
                                  ? (student.yearAverage ?? student.gpa).toFixed(2) 
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  // ✅ Hiển thị học lực theo học kỳ được chọn (overviewView)
                                  let academicLevelToShow = null;
                                  if (overviewView === 'hk1') {
                                    // Ưu tiên academicLevelHK1, fallback về academicLevel chung
                                    academicLevelToShow = (student as any).academicLevelHK1 || student.academicLevel || null;
                                  } else if (overviewView === 'hk2') {
                                    // Ưu tiên academicLevelHK2, fallback về academicLevel chung
                                    academicLevelToShow = (student as any).academicLevelHK2 || student.academicLevel || null;
                                  } else if (overviewView === 'year') {
                                    // Ưu tiên academicLevelCN, fallback về academicLevel chung
                                    academicLevelToShow = (student as any).academicLevelCN || student.academicLevel || null;
                                  } else if (overviewView === 'all') {
                                    // Khi xem "Tất cả", ưu tiên học lực cả năm (CN), sau đó HK1, HK2, hoặc chung
                                    academicLevelToShow = (student as any).academicLevelCN 
                                      || (student as any).academicLevelHK1 
                                      || (student as any).academicLevelHK2 
                                      || student.academicLevel 
                                      || null;
                                  } else {
                                    academicLevelToShow = student.academicLevel || null;
                                  }
                                  return getAcademicLevelBadge(academicLevelToShow);
                                })()}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  // ✅ Lấy hạnh kiểm từ conductRecords (giống HomeroomGradesPage)
                                  const studentId = normalizeId(student._id);
                                  const conductRecord = conductRecords.get(studentId);
                                  const lockedConduct = conductRecord?.conductStatus === 'locked' ? conductRecord : undefined;
                                  
                                  // ✅ Hiển thị hạnh kiểm theo học kỳ được chọn (overviewView)
                                  let conductToShow = null;
                                  if (lockedConduct?.conduct) {
                                    // Ưu tiên từ conductRecords (đã chốt)
                                    conductToShow = lockedConduct.conduct;
                                  } else {
                                    // Fallback: lấy từ student data theo học kỳ được chọn
                                    if (overviewView === 'hk1') {
                                      conductToShow = (student as any).conductHK1 || null;
                                    } else if (overviewView === 'hk2') {
                                      conductToShow = (student as any).conductHK2 || null;
                                    } else if (overviewView === 'year' || overviewView === 'all') {
                                      // Ưu tiên hạnh kiểm cả năm (CN), sau đó HK1, HK2, hoặc chung
                                      conductToShow = (student as any).conductCN 
                                        || (student as any).conductHK1 
                                        || (student as any).conductHK2 
                                        || student.conduct 
                                        || null;
                                    } else {
                                      conductToShow = student.conduct || null;
                                    }
                                  }
                                  
                                  return (
                                    conductLoading ? (
                                      <span className="text-xs text-muted-foreground">Đang tải...</span>
                                    ) : (
                                      <Badge variant="outline">{conductToShow || '-'}</Badge>
                                    )
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  // ✅ Hiển thị xếp hạng theo học kỳ được chọn (overviewView)
                                  let rankToShow = null;
                                  let rankGradeToShow = null;
                                  
                                  if (overviewView === 'hk1') {
                                    rankToShow = (student as any).rankHK1 || null;
                                    rankGradeToShow = (student as any).rankGradeHK1 || null;
                                  } else if (overviewView === 'hk2') {
                                    rankToShow = (student as any).rankHK2 || null;
                                    rankGradeToShow = (student as any).rankGradeHK2 || null;
                                  } else if (overviewView === 'year' || overviewView === 'all') {
                                    // Ưu tiên xếp hạng cả năm (CN), sau đó fallback về chung
                                    rankToShow = (student as any).rankCN || student.rank || null;
                                    rankGradeToShow = (student as any).rankGradeCN || student.rankGrade || null;
                                  } else {
                                    rankToShow = student.rank || null;
                                    rankGradeToShow = student.rankGrade || null;
                                  }
                                  
                                  return rankToShow || rankGradeToShow
                                    ? `Lớp: ${rankToShow || '-'} / Khối: ${rankGradeToShow || '-'}`
                                    : '-';
                                })()}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    if (!filters.schoolYear) {
                                      toast.error('Vui lòng chọn năm học');
                                      return;
                                    }
                                    // Xác định semester để xét: ưu tiên từ overviewView, fallback về filters.semester hoặc 'CN'
                                    let semesterToUse = 'CN';
                                    if (overviewView === 'hk1') {
                                      semesterToUse = '1';
                                    } else if (overviewView === 'hk2') {
                                      semesterToUse = '2';
                                    } else if (overviewView === 'year' || overviewView === 'all') {
                                      semesterToUse = 'CN';
                                    } else if (filters.semester) {
                                      semesterToUse = filters.semester === '1' || filters.semester === 'HK1' ? '1' :
                                                      filters.semester === '2' || filters.semester === 'HK2' ? '2' :
                                                      filters.semester === 'CN' || filters.semester === 'Cả năm' ? 'CN' : 'CN';
                                    }
                                    
                                    try {
                                      const res = await gradesApi.evaluateStudentAcademic({
                                        studentId: student._id,
                                        schoolYear: filters.schoolYear,
                                        semester: semesterToUse,
                                      });
                                      
                                      if (res.success) {
                                        // ✅ Hiển thị SweetAlert2 với thông tin chi tiết
                                        const details = res.academicDetails || {};
                                        const reasons = details.reasons || [];
                                        const reasonsHtml = reasons.length > 0 
                                          ? `<ul style="text-align: left; margin-top: 10px;">${reasons.map((r: string) => `<li>${r}</li>`).join('')}</ul>`
                                          : '<p>Không có thông tin chi tiết</p>';
                                        
                                        await Swal.fire({
                                          title: `Xét học lực: ${student.name}`,
                                          html: `
                                            <div style="text-align: left;">
                                              <p><strong>Mã HS:</strong> ${student.studentCode}</p>
                                              <p><strong>Điểm TB:</strong> ${res.gpa?.toFixed(2) || 'N/A'}</p>
                                              <p><strong>Học lực:</strong> <span style="font-weight: bold; color: ${res.academicLevel === 'Giỏi' ? 'green' : res.academicLevel === 'Khá' ? 'blue' : res.academicLevel === 'Trung bình' ? 'orange' : 'red'}">${res.academicLevel || 'Chưa xác định'}</span></p>
                                              <hr style="margin: 15px 0;">
                                              <p><strong>Cách xếp học lực:</strong></p>
                                              ${reasonsHtml}
                                            </div>
                                          `,
                                          icon: 'success',
                                          confirmButtonText: 'Đóng',
                                          width: '600px'
                                        });
                                        
                                        // Reload dữ liệu sau khi đóng alert (đợi một chút để backend cập nhật)
                                        setTimeout(async () => {
                                          try {
                                            // Force reload bằng cách gọi lại với cùng filters
                                            await fetchStudentsGrades({ overview: true });
                                          } catch (err: any) {
                                            console.error('Error reloading students grades:', err);
                                            toast.error('Không thể tải lại dữ liệu');
                                          }
                                        }, 300);
                                      } else {
                                        toast.error(res.message || 'Không thể xét học lực');
                                      }
                                    } catch (err: any) {
                                      console.error('Error evaluating academic level:', err);
                                      toast.error(err.response?.data?.message || 'Không thể xét học lực');
                                    }
                                  }}
                                  className="text-xs"
                                >
                                  Xét học lực
                                </Button>
                              </TableCell>
                            </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                {/* Pagination */}
                {(() => {
                  const filtered = studentsGrades.filter(student => {
                    if (filters.keyword) {
                      const keyword = filters.keyword.toLowerCase();
                      if (!student.name?.toLowerCase().includes(keyword) &&
                          !student.studentCode?.toLowerCase().includes(keyword)) {
                        return false;
                      }
                    }
                    if (filters.academicLevel && student.academicLevel !== filters.academicLevel) {
                      return false;
                    }
                    if (filters.conduct && student.conduct !== filters.conduct) {
                      return false;
                    }
                    return true;
                  });
                  const totalPages = Math.ceil(filtered.length / itemsPerPage);
                  
                  if (totalPages <= 1) return null;
                  
                  return (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-600">
                        Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filtered.length)} trong tổng số {filtered.length} học sinh
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          Trước
                        </Button>
                        <div className="flex gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            return (
                              <Button
                                key={pageNum}
                                size="sm"
                                variant={currentPage === pageNum ? "default" : "outline"}
                                onClick={() => setCurrentPage(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Sau
                        </Button>
                        <Select
                          value={String(itemsPerPage)}
                          onValueChange={(v) => {
                            setItemsPerPage(Number(v));
                            setCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </TabsContent>

            {/* Tab: Details */}
            <TabsContent value="details" className="mt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Chi tiết điểm từng môn</h3>
                  <div className="flex gap-2">
                    <Button onClick={exportToExcelDetails} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Xuất Excel
                    </Button>
                    <Button onClick={() => fetchStudentsGrades()} disabled={loading}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Làm mới
                    </Button>
                  </div>
                </div>
                {loading ? (
                  <div className="text-center py-8">Đang tải...</div>
                ) : studentsGrades.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Chưa có dữ liệu</div>
                ) : (
                  <div className="space-y-6">
                    {studentsGrades
                      .filter(student => 
                        !filters.keyword || 
                        student.name?.toLowerCase().includes(filters.keyword.toLowerCase()) ||
                        student.studentCode?.toLowerCase().includes(filters.keyword.toLowerCase())
                      )
                      .filter(student => 
                        !filters.subjectId || 
                        student.subjects?.some((s: any) => s.subject?._id === filters.subjectId)
                      )
                      .sort((a, b) => {
                        const classNameA = a.class?.className || '';
                        const classNameB = b.class?.className || '';
                        // So sánh theo tên lớp (ví dụ: "10A1", "10A2", "11B1")
                        return classNameA.localeCompare(classNameB, 'vi', { numeric: true, sensitivity: 'base' });
                      })
                      .map((student) => (
                        <Card key={student._id}>
                          <CardHeader>
                            <div className="flex justify-between items-center">
                              <CardTitle className="text-lg">
                                {student.name} ({student.studentCode}) - {student.class?.className}
                              </CardTitle>
                              <div className="flex gap-2">
                                {editingStudents.has(student._id) ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={handleSaveInlineEdit}
                                      disabled={inlineSaving || !inlineEditContext}
                                    >
                                      {inlineSaving ? 'Đang lưu...' : 'Lưu'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={handleCancelInlineEdit}
                                      disabled={inlineSaving}
                                    >
                                      Bỏ
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={!canEditGrades}
                                    onClick={() => handleToggleStudentEdit(student)}
                                    title={
                                      canEditGrades
                                        ? 'Bật chế độ chỉnh sửa điểm cho học sinh này'
                                        : 'Bạn không có quyền sửa điểm'
                                    }
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Chỉnh sửa
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Môn học</TableHead>
                                  {visibleComponents.map((component) => (
                                    <TableHead key={component} className="text-center">
                                      {gradeComponentHeaderLabels[component] || component}
                                    </TableHead>
                                  ))}
                                  <TableHead className="text-center">ĐTB môn</TableHead>
                                  <TableHead className="text-center">Kết quả</TableHead>
                                  <TableHead className="text-center">Công bố</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {student.subjects?.map((subject: any) => {
                                  const subjectKey = subject.subject?._id || subject._id;
                                  const isStudentEditing = editingStudents.has(student._id);
                                  const isInlineEditing = isStudentEditing && 
                                    inlineEditContext &&
                                    inlineEditContext.studentId === student._id;
                                  
                                  return (
                                    <TableRow key={subject._id}>
                                      <TableCell className="font-medium">
                                        {subject.subject?.name || '-'}
                                      </TableCell>
                                      {visibleComponents.map((component) => {
                                        const allGradeItems = getGradeItemsList(subject, component);
                                        const configuredCount = getConfiguredColumnCount(component);
                                        // ✅ Chỉ hiển thị số điểm theo cấu hình
                                        const gradeItemsList = allGradeItems.slice(0, configuredCount);

                                        if (isInlineEditing) {
                                          const subjectForm = inlineEditContext?.subjectsForm?.get(subjectKey);
                                          const inlineValues = subjectForm?.[component] || [];
                                          return (
                                            <TableCell key={`${subject._id}-${component}`} className="text-center">
                                              <div className="flex flex-wrap justify-center gap-1">
                                                {inlineValues.map((value, index) => (
                                                  <Input
                                                    key={`${component}-inline-${index}`}
                                                    type="number"
                                                    min="0"
                                                    max="10"
                                                    step="0.1"
                                                    value={value}
                                                    className="w-16 text-center"
                                                    onChange={(event) =>
                                                      handleInlineInputChange(
                                                        subjectKey,
                                                        component,
                                                        index,
                                                        event.target.value
                                                      )
                                                    }
                                                  />
                                                ))}
                                              </div>
                                            </TableCell>
                                          );
                                        }

                                        // Khi không editing: chỉ hiển thị điểm trong ô readonly, ẩn nếu không có điểm
                                        return (
                                          <TableCell 
                                            key={`${subject._id}-${component}`} 
                                            className="text-center"
                                          >
                                            {gradeItemsList.length > 0 ? (
                                              <div className="flex flex-wrap justify-center gap-1">
                                                {gradeItemsList.map((score, idx) => (
                                                  <Input
                                                    key={`${component}-${idx}`}
                                                    value={formatDisplayScore(score)}
                                                    readOnly
                                                    className="w-16 text-center"
                                                  />
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="text-muted-foreground">-</span>
                                            )}
                                          </TableCell>
                                        );
                                      })}
                                    <TableCell className="text-center">
                                      <div className="flex flex-col items-center gap-1">
                                        {subject.subject?.includeInAverage !== false ? (
                                          <span className={getAverageColor(subject.average)}>
                                            {subject.average?.toFixed(1) || '-'}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">-</span>
                                        )}
                                        {/* Hiển thị xu hướng */}
                                        {(() => {
                                          if (!student.trends) return null;
                                          const getSubjectTrend = () => {
                                            if (filters.semester === '2' && student.trends?.previousSemester) {
                                              return student.trends.previousSemester.comparison.find(
                                                (c: any) => c.subjectId === subject.subject?._id
                                              );
                                            }
                                            if (student.trends?.previousYear) {
                                              return student.trends.previousYear.comparison.find(
                                                (c: any) => c.subjectId === subject.subject?._id
                                              );
                                            }
                                            return null;
                                          };
                                          const trend = getSubjectTrend();
                                          if (!trend || trend.trend === null || trend.trend === undefined) return null;
                                          
                                          const getTrendIcon = (t: number) => {
                                            if (t > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
                                            if (t < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
                                            return <Minus className="h-3 w-3 text-gray-400" />;
                                          };
                                          const getTrendColor = (t: number) => {
                                            if (t > 0) return 'text-green-600';
                                            if (t < 0) return 'text-red-600';
                                            return 'text-gray-500';
                                          };

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
                                        })()}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {(() => {
                                        // Kiểm tra môn không tính điểm TB
                                        const includeInAverage = subject.subject?.includeInAverage;
                                        if (includeInAverage === false) {
                                          // Hiển thị kết quả Đạt/Không đạt
                                          if (subject.result === 'D') {
                                            return (
                                              <Badge variant="default" className="font-semibold">
                                                Đạt
                                              </Badge>
                                            );
                                          } else if (subject.result === 'K') {
                                            return (
                                              <Badge variant="destructive" className="font-semibold">
                                                Không đạt
                                              </Badge>
                                            );
                                          } else {
                                            return (
                                              <Badge variant="outline" className="font-semibold">
                                                -
                                              </Badge>
                                            );
                                          }
                                        } else {
                                          // Môn tính điểm TB: hiển thị "-"
                                          return <span className="text-muted-foreground">-</span>;
                                        }
                                      })()}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {subject.isOfficial ? (
                                        <div className="flex flex-col items-center gap-1">
                                          <Badge variant="default" className="bg-green-600 text-white">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            Đã công bố
                                          </Badge>
                                          {subject.officialAt && (
                                            <span className="text-xs text-muted-foreground">
                                              {new Date(subject.officialAt).toLocaleDateString('vi-VN')}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handlePublishStudent(student._id, subject.subject?._id || subject._id)}
                                          disabled={(() => {
                                            // Disable nếu đang công bố
                                            if (publishingStudentId === `${student._id}-${subject.subject?._id || subject._id}` || publishing) {
                                              return true;
                                            }
                                            // Kiểm tra điều kiện công bố:
                                            // - Môn tính điểm TB: cần có average
                                            // - Môn không tính điểm TB: cần có result (D hoặc K)
                                            const includeInAverage = subject.subject?.includeInAverage;
                                            if (includeInAverage !== false) {
                                              // Môn tính điểm TB
                                              return !subject.average;
                                            } else {
                                              // Môn không tính điểm TB
                                              return !subject.result || (subject.result !== 'D' && subject.result !== 'K');
                                            }
                                          })()}
                                          className="text-xs"
                                        >
                                          {publishingStudentId === `${student._id}-${subject.subject?._id || subject._id}` ? 'Đang công bố...' : '📢 Công bố'}
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                                })}
                                {/* ✅ Hàng tổng hợp: Điểm trung bình học kỳ */}
                                <TableRow className="bg-muted/50 font-semibold">
                                  <TableCell className="font-medium">
                                    Điểm trung bình học kỳ
                                  </TableCell>
                                  {/* Các cột điểm để trống */}
                                  {visibleComponents.map((component) => (
                                    <TableCell key={`gpa-${component}`} className="text-center">
                                      <span className="text-muted-foreground">-</span>
                                    </TableCell>
                                  ))}
                                  {/* Cột ĐTB môn - hiển thị GPA */}
                                  <TableCell className="text-center font-semibold">
                                    {(() => {
                                      // ✅ Lấy GPA theo học kỳ được chọn trong filter
                                      let gpa: number | null = null;
                                      
                                      // Normalize semester code
                                      const semesterCode = filters.semester === '1' || filters.semester === 'HK1' 
                                        ? 'HK1' 
                                        : filters.semester === '2' || filters.semester === 'HK2'
                                        ? 'HK2'
                                        : filters.semester === 'CN' || filters.semester === 'Cả năm'
                                        ? 'CN'
                                        : (filters.semester || 'CN');
                                      
                                      // Ưu tiên 1: Lấy theo học kỳ được chọn từ các trường cụ thể
                                      if (semesterCode === 'HK1') {
                                        gpa = student.hk1Average || student.semester1Average || null;
                                      } else if (semesterCode === 'HK2') {
                                        gpa = student.hk2Average || student.semester2Average || null;
                                      } else if (semesterCode === 'CN') {
                                        gpa = student.yearAverage || null;
                                      }
                                      
                                      // Ưu tiên 2: student.gpa (đã được backend set theo semester được chọn)
                                      if ((gpa === null || gpa === undefined) && student.gpa !== null && student.gpa !== undefined && typeof student.gpa === 'number') {
                                        gpa = student.gpa;
                                      }
                                      
                                      // Ưu tiên 3: Fallback về semesterAverage nếu không có
                                      if (gpa === null || gpa === undefined) {
                                        gpa = student.semesterAverage || null;
                                      }
                                      
                                      if (gpa !== null && gpa !== undefined && typeof gpa === 'number') {
                                        return (
                                          <span className={getAverageColor(gpa)}>
                                            {gpa.toFixed(2)}
                                          </span>
                                        );
                                      }
                                      return <span className="text-muted-foreground">-</span>;
                                    })()}
                                  </TableCell>
                                  {/* Cột Kết quả */}
                                  <TableCell className="text-center">
                                    <span className="text-muted-foreground">-</span>
                                  </TableCell>
                                  {/* Cột Công bố */}
                                  <TableCell className="text-center">
                                    <span className="text-muted-foreground">-</span>
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab: Statistics */}
            <TabsContent value="statistics" className="mt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Thống kê xếp loại</h3>
                  <Button onClick={fetchStatistics} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Làm mới
                  </Button>
                </div>
                {loading ? (
                  <div className="text-center py-8">Đang tải...</div>
                ) : !statistics ? (
                  <div className="text-center py-8 text-gray-500">Chưa có dữ liệu</div>
                ) : (
                  <div className="space-y-6">
                    {/* Overall Statistics */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Tổng quan</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-5 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {statistics.overall?.excellent || 0}
                            </div>
                            <div className="text-sm text-gray-600">Giỏi</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {statistics.overall?.good || 0}
                            </div>
                            <div className="text-sm text-gray-600">Khá</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-600">
                              {statistics.overall?.average || 0}
                            </div>
                            <div className="text-sm text-gray-600">Trung bình</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {statistics.overall?.weak || 0}
                            </div>
                            <div className="text-sm text-gray-600">Yếu</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">
                              {statistics.overall?.total || 0}
                            </div>
                            <div className="text-sm text-gray-600">Tổng số</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* By Grade */}
                    {statistics.byGrade && Object.keys(statistics.byGrade).length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Theo khối</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Khối</TableHead>
                                <TableHead>Tổng số</TableHead>
                                <TableHead>Giỏi</TableHead>
                                <TableHead>Khá</TableHead>
                                <TableHead>Trung bình</TableHead>
                                <TableHead>Yếu</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Object.values(statistics.byGrade).map((grade: any) => (
                                <TableRow key={grade.grade}>
                                  <TableCell className="font-medium">Khối {grade.grade}</TableCell>
                                  <TableCell>{grade.total || 0}</TableCell>
                                  <TableCell className="text-green-600">{grade.excellent || 0}</TableCell>
                                  <TableCell className="text-blue-600">{grade.good || 0}</TableCell>
                                  <TableCell className="text-yellow-600">{grade.average || 0}</TableCell>
                                  <TableCell className="text-red-600">{grade.weak || 0}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* By Class */}
                    {statistics.byClass && Object.keys(statistics.byClass).length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Theo lớp</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Lớp</TableHead>
                                  <TableHead>Tổng số</TableHead>
                                  <TableHead>Giỏi</TableHead>
                                  <TableHead>Khá</TableHead>
                                  <TableHead>Trung bình</TableHead>
                                  <TableHead>Yếu</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Object.values(statistics.byClass).map((cls: any) => (
                                  <TableRow key={cls.className}>
                                    <TableCell className="font-medium">{cls.className}</TableCell>
                                    <TableCell>{cls.total || 0}</TableCell>
                                    <TableCell className="text-green-600">{cls.excellent || 0}</TableCell>
                                    <TableCell className="text-blue-600">{cls.good || 0}</TableCell>
                                    <TableCell className="text-yellow-600">{cls.average || 0}</TableCell>
                                    <TableCell className="text-red-600">{cls.weak || 0}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab: Audit Log */}
            <TabsContent value="audit" className="mt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Lịch sử nhập/sửa điểm</h3>
                  <Button onClick={fetchAuditLog} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Làm mới
                  </Button>
                </div>
                {loading ? (
                  <div className="text-center py-8">Đang tải...</div>
                ) : auditLog.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Chưa có dữ liệu</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Thời gian</TableHead>
                          <TableHead>Học sinh</TableHead>
                          <TableHead>Môn học</TableHead>
                          <TableHead>Loại điểm</TableHead>
                          <TableHead>Điểm</TableHead>
                          <TableHead>Người nhập/sửa</TableHead>
                          <TableHead>Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLog.map((log) => (
                          <TableRow key={log._id}>
                            <TableCell>
                              {dayjs(log.updatedAt || log.createdAt).format('DD/MM/YYYY HH:mm')}
                            </TableCell>
                            <TableCell>
                              {log.student?.name} ({log.student?.studentCode})
                            </TableCell>
                            <TableCell>{log.subject?.name || '-'}</TableCell>
                            <TableCell>
                              {log.component === 'oral' ? 'Miệng' :
                               log.component === 'quiz15' ? '15\'' :
                               log.component === 'quiz45' ? '45\'' :
                               log.component === 'midterm' ? 'Giữa kỳ' :
                               log.component === 'final' ? 'Cuối kỳ' : log.component}
                            </TableCell>
                            <TableCell className="font-semibold">{log.score}</TableCell>
                            <TableCell>
                              {(() => {
                                const actor = log.performedBy || log.user || log.teacher || null;
                                const name = actor?.name || actor?.fullName || actor?.email || '-';
                                const role = actor?.role ? ` (${actor.role})` : '';
                                const code = actor?.teacherCode ? ` - ${actor.teacherCode}` : '';
                                return `${name}${role}${code}`;
                              })()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteGradeItem(log._id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        </Card>
      </div>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            resetEditState();
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sửa điểm học sinh</DialogTitle>
            <DialogDescription>
              Mỗi cột điểm tương ứng với một lần kiểm tra theo cấu hình hiện tại. Để trống ô nếu muốn xoá
              điểm tại cột đó.
            </DialogDescription>
          </DialogHeader>

          {editingContext ? (
            <div className="max-h-[70vh] overflow-y-auto pr-2">
              <div className="space-y-4">
                <div className="rounded-md bg-muted/40 p-3 text-sm">
                  <p>
                    <span className="font-semibold">Học sinh:</span>{' '}
                    {editingContext.studentName} ({editingContext.studentCode || '---'})
                  </p>
                  <p>
                    <span className="font-semibold">Môn:</span> {editingContext.subjectName}
                  </p>
                  <p>
                    <span className="font-semibold">Lớp:</span>{' '}
                    {editingContext.className || '---'}
                  </p>
                  <p>
                    <span className="font-semibold">Năm học - Học kỳ:</span>{' '}
                    {editingContext.schoolYear} - {editingContext.semester === 'CN' ? 'Cả năm' : `HK${editingContext.semester}`}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {visibleComponents.map((component) => {
                    const currentValues =
                      (editingContext?.gradeItems?.[component] as number[] | undefined) || [];
                    const columnCount =
                      editForm[component]?.length ??
                      resolveColumnCount(component, currentValues.length);
                    return (
                      <div key={component} className="space-y-2 rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">{gradeComponentLabels[component]}</Label>
                          <span className="text-xs text-muted-foreground">{columnCount} cột</span>
                        </div>
                        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                          {currentValues.length > 0 ? (
                            currentValues.map((score, idx) => (
                              <Badge key={`${component}-current-${idx}`} variant="secondary">
                                C{idx + 1}: {typeof score === 'number' ? score.toFixed(1) : score || '-'}
                              </Badge>
                            ))
                          ) : (
                            <span>Chưa có điểm được lưu cho loại này.</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {(editForm[component] || []).map((value, index) => (
                            <div key={`${component}-${index}`} className="space-y-1">
                              <Label
                                htmlFor={`edit-${component}-${index}`}
                                className="text-xs text-muted-foreground"
                              >
                                Cột {index + 1}
                              </Label>
                              <Input
                                id={`edit-${component}-${index}`}
                                placeholder="Ví dụ: 8.0"
                                value={value}
                                onChange={(event) =>
                                  handleEditInputChange(component, index, event.target.value)
                                }
                              />
                            </div>
                          ))}
                        </div>
                        {currentValues.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Chưa có điểm cho loại này, thêm điểm mới bằng cách nhập vào các ô phía trên.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Chưa chọn học sinh để chỉnh sửa.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={editSaving}>
              Hủy
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSaving || !editingContext}>
              {editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminGradesPage;

