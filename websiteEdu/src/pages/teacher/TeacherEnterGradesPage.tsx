import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import gradesApi from "@/services/gradesApi";
import schoolConfigApi from "@/services/schoolConfigApi";
import gradeConfigApi from "@/services/gradeConfigApi";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSchoolYears } from "@/hooks";
import { useCurrentAcademicYear } from "@/hooks/useCurrentAcademicYear";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { assignmentApi } from "@/services/assignmentApi";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import settingApi from "@/services/settingApi";
import { Clock, Lock, CheckCircle2 } from "lucide-react";
// @ts-ignore - sweetalert2 types are included in the package
import Swal from 'sweetalert2';

const TeacherEnterGradesPage: React.FC = () => {
  const { backendUser, loading: authLoading } = useAuth();
  const [schoolYears, setSchoolYears] = useState<{ code: string; name: string }[]>([]);
  const [semesters, setSemesters] = useState<{ code: string; name: string }[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");

  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  const [students, setStudents] = useState<any[]>([]);
  // scores: studentId -> components
  const [scores, setScores] = useState<Record<string, {
    oral?: number | string;
    quiz15?: number | string;
    quiz45?: number | string;
    midterm?: number | string;
    final?: number | string;
  }>>({});
  // Keep a copy of initial scores to detect changes and allow reset
  const [initialScores, setInitialScores] = useState<typeof scores>({});
  // validation errors: studentId -> component -> boolean
  const [errors, setErrors] = useState<Record<string, Record<string, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishingStudentId, setPublishingStudentId] = useState<string | null>(null);
  // Bỏ ĐTB HK khỏi trang giáo viên bộ môn

  // ✅ Cấu hình điểm từ admin
  const [gradeConfig, setGradeConfig] = useState<{
    weights: Record<string, number>;
    columnCounts?: Record<string, number>; // ✅ Số cột điểm cho mỗi component
    rounding: 'half-up' | 'none';
    completionPolicy?: 'at-least-one' | 'require-counts';
    classification?: {
      excellent?: { minAverage: number; minSubjectScore: number };
      good?: { minAverage: number; minSubjectScore: number };
      average?: { minAverage: number; minSubjectScore: number };
      weak?: { maxAverage: number; maxSubjectScore?: number };
    };
  } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  const [timeInfo, setTimeInfo] = useState<{
    allowed: boolean;
    startDate: string | null;
    endDate: string | null;
    message: string;
  } | null>(null);

  const formatDate = useCallback((dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }, []);

  const refreshGradeEntryWindow = useCallback(async () => {
    if (!selectedSemester) {
      setTimeInfo(null);
      return;
    }

    try {
      const res = await settingApi.getSettings();
      const settings = res?.data || res;

      const semValue = String(selectedSemester || '').toUpperCase();
      const isSecondSemester = semValue === '2' || semValue === 'HK2' || semValue === 'SEMESTER_2';
      const startDate = isSecondSemester ? settings?.gradeEntryStartHK2 : settings?.gradeEntryStartHK1;
      const endDate = isSecondSemester ? settings?.gradeEntryEndHK2 : settings?.gradeEntryEndHK1;

      if (!startDate || !endDate) {
        setTimeInfo({
          allowed: false,
          startDate: startDate || null,
          endDate: endDate || null,
          message: 'Chưa cấu hình thời gian nhập điểm cho học kỳ này',
        });
        return;
      }

      const now = new Date();
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        setTimeInfo({
          allowed: false,
          startDate,
          endDate,
          message: 'Không thể đọc dữ liệu thời gian nhập điểm',
        });
        return;
      }

      if (now < start) {
        setTimeInfo({
          allowed: false,
          startDate,
          endDate,
          message: `Chưa đến thời gian nhập điểm. Thời gian cho phép: ${formatDate(startDate)} - ${formatDate(endDate)}`,
        });
      } else if (now > end) {
        setTimeInfo({
          allowed: false,
          startDate,
          endDate,
          message: `Đã hết thời gian nhập điểm. Thời gian cho phép: ${formatDate(startDate)} - ${formatDate(endDate)}`,
        });
      } else {
        setTimeInfo({
          allowed: true,
          startDate,
          endDate,
          message: `Đang trong thời gian nhập điểm: ${formatDate(startDate)} - ${formatDate(endDate)}`,
        });
      }
    } catch (error) {
      console.error('Không thể kiểm tra thời gian nhập điểm:', error);
      setTimeInfo({
        allowed: false,
        startDate: null,
        endDate: null,
        message: 'Không thể kiểm tra thời gian nhập điểm',
      });
    }
  }, [formatDate, selectedSemester]);

  

  // ✅ Lấy danh sách năm học từ hooks
  const { schoolYears: allSchoolYears } = useSchoolYears();
  const { currentYearCode, currentYearData } = useCurrentAcademicYear();
  
  useEffect(() => {
  
    setSchoolYears(allSchoolYears.map((y) => ({ code: y.code, name: y.name })));

    // Prefer the active school year's code as default when not selected yet
    const defaultCode = currentYearCode || (allSchoolYears.length ? allSchoolYears[allSchoolYears.length - 1].code : '');
    if (defaultCode && !selectedYear) setSelectedYear(defaultCode);
  }, [allSchoolYears, currentYearCode, selectedYear]);

  useEffect(() => {
    if (!selectedSemester) {
      setTimeInfo(null);
      return;
    }
    refreshGradeEntryWindow();
  }, [selectedYear, selectedSemester, refreshGradeEntryWindow]);

  const isGradeWindowLoaded = timeInfo !== null;
  const isGradeEntryAllowed = timeInfo?.allowed ?? false;
  const gradeWindowMessage = timeInfo?.message || 'Đang kiểm tra thời gian nhập điểm';

  // 🔹 Lấy danh sách học kỳ và set học kỳ hiện tại
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const semestersRes = await schoolConfigApi.getSemesters();
        setSemesters(semestersRes.data);
        
        // ✅ Ưu tiên set học kỳ hiện tại (học kỳ 1 mặc định)
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // 1-12
        // Học kỳ 1: tháng 9-12, Học kỳ 2: tháng 1-5
        const currentSemesterCode = (currentMonth >= 9 || currentMonth <= 1) ? "1" : "2";
        
        if (!selectedSemester && semestersRes.data.length > 0) {
          // Tìm học kỳ hiện tại trong danh sách
          const foundSemester = semestersRes.data.find(s => s.code === currentSemesterCode);
          if (foundSemester) {
            setSelectedSemester(foundSemester.code);
          } else if (semestersRes.data.length > 0) {
            // Fallback về học kỳ đầu tiên
            setSelectedSemester(semestersRes.data[0].code);
          }
        }
      } catch (err) {
        console.error("Load semesters failed", err);
      }
    };
    fetchSemesters();
  }, [selectedSemester]);

  // ✅ Lưu tất cả assignments để filter theo môn học
  const [allAssignments, setAllAssignments] = useState<any[]>([]);

  // ✅ Load cấu hình điểm theo năm học và học kỳ
  useEffect(() => {
    const fetchGradeConfig = async () => {
      if (!selectedYear || !selectedSemester) {
        setGradeConfig(null);
        return;
      }
      try {
        setLoadingConfig(true);
        const config = await gradeConfigApi.getConfig({
          schoolYear: selectedYear,
          semester: selectedSemester,
        });
        // Xử lý response có thể là config trực tiếp hoặc config.data
        const configData = config.data || config;
        const defaultColumnCounts = {
          oral: 3,
          quiz15: 3,
          quiz45: 1,
          midterm: 1,
          final: 1,
        };
        
        if (configData && configData.weights) {
          setGradeConfig({
            weights: configData.weights || {},
            columnCounts: configData.columnCounts || defaultColumnCounts,
            rounding: configData.rounding || 'half-up',
            completionPolicy: configData.completionPolicy || 'at-least-one',
            classification: configData.classification,
          });
        } else {
          // Fallback về cấu hình mặc định
          setGradeConfig({
            weights: { oral: 1, quiz15: 1, quiz45: 2, midterm: 2, final: 3 },
            columnCounts: defaultColumnCounts,
            rounding: 'half-up',
            completionPolicy: 'at-least-one',
          });
        }
      } catch (err: any) {
        console.error("Failed to load grade config", err);
        // Fallback về cấu hình mặc định nếu không load được
        const defaultColumnCounts = {
          oral: 3,
          quiz15: 3,
          quiz45: 1,
          midterm: 1,
          final: 1,
        };
        setGradeConfig({
          weights: { oral: 1, quiz15: 1, quiz45: 2, midterm: 2, final: 3 },
          columnCounts: defaultColumnCounts,
          rounding: 'half-up',
          completionPolicy: 'at-least-one',
        });
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchGradeConfig();
  }, [selectedYear, selectedSemester]);

  // 🔹 Lấy danh sách lớp & môn theo teacher + năm học + học kỳ (CHỈ các lớp được phân công)
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!backendUser || backendUser.role !== "teacher" || !selectedYear || !selectedSemester) {
        setClasses([]);
        setSubjects([]);
        setAllAssignments([]);
        return;
      }
      try {
        const teacherId = typeof backendUser.teacherId === 'object' && backendUser.teacherId !== null
          ? (backendUser.teacherId as any)._id
          : backendUser.teacherId;
        
        if (!teacherId) {
          setClasses([]);
          setSubjects([]);
          setAllAssignments([]);
          return;
        }

        // ✅ Đảm bảo semester là string
        const semesterParam = String(selectedSemester || '').trim();
        
        console.log("Fetching assignments with params:", {
          teacherId,
          year: selectedYear,
          semester: semesterParam,
          selectedSemester
        });
        
        if (!semesterParam) {
          console.warn("⚠️ Semester is empty, skipping fetch");
          return;
        }
        
        const assignments = await assignmentApi.getByTeacher(teacherId, {
          year: selectedYear,
          semester: semesterParam
        });
        
        console.log("Received assignments:", assignments?.length || 0, assignments);

        if (!assignments || assignments.length === 0) {
          toast.error("Không tìm thấy lớp hoặc môn học nào được phân công!");
          setClasses([]);
          setSubjects([]);
          setAllAssignments([]);
          return;
        }

        // ✅ Lưu tất cả assignments để filter
        setAllAssignments(assignments);

        // ✅ Lấy danh sách môn học (unique) - hiển thị luôn
        const uniqueSubjects = Array.from(
          new Map(
            assignments.filter(a => a.subjectId?._id)
                       .map(a => [a.subjectId._id, a.subjectId])
          ).values()
        );

        setSubjects(uniqueSubjects);

        // ✅ Tự động chọn môn học đầu tiên nếu:
        // 1. Chưa có môn học nào được chọn, HOẶC
        // 2. Môn học hiện tại không còn trong danh sách
        if (uniqueSubjects.length > 0) {
          const currentSubjectExists = selectedSubject && uniqueSubjects.find(s => s._id === selectedSubject);
          if (!currentSubjectExists) {
            // Tự động chọn môn học đầu tiên
            setSelectedSubject(uniqueSubjects[0]._id);
            setSelectedClass(""); // Reset lớp khi môn học thay đổi
          }
        } else {
          // Nếu không có môn học nào, reset
          setSelectedSubject("");
          setSelectedClass("");
        }

      } catch (err) {
        console.error("Failed to load assignments", err);
        toast.error("Không thể tải danh sách lớp và môn học");
        setClasses([]);
        setSubjects([]);
        setAllAssignments([]);
      }
    };
    console.log("Fetching assignments for teacher", backendUser?.teacherId, selectedYear, selectedSemester);
    fetchAssignments();
  }, [backendUser, selectedYear, selectedSemester]);

  // ✅ Filter lớp theo môn học đã chọn (chỉ hiển thị lớp được phân công dạy môn đó)
  useEffect(() => {
    if (!selectedSubject || allAssignments.length === 0) {
      setClasses([]);
      setSelectedClass(""); // Reset lớp khi không có môn học
      return;
    }

    // ✅ Lọc assignments theo môn học đã chọn
    const subjectAssignments = allAssignments.filter(a => {
      const subjectId = typeof a.subjectId === 'object' && a.subjectId !== null
        ? a.subjectId._id
        : a.subjectId;
      return String(subjectId) === String(selectedSubject);
    });

    // ✅ Lấy danh sách lớp unique từ assignments của môn học đó
    const uniqueClasses = Array.from(
      new Map(
        subjectAssignments.filter(a => a.classId?._id)
                         .map(a => [a.classId._id, a.classId])
      ).values()
    );

    setClasses(uniqueClasses);

    // ✅ Tự động chọn lớp đầu tiên nếu:
    // 1. Chưa có lớp nào được chọn, HOẶC
    // 2. Lớp hiện tại không còn trong danh sách
    if (uniqueClasses.length > 0) {
      const currentClassExists = selectedClass && uniqueClasses.find(c => c._id === selectedClass);
      if (!currentClassExists) {
        // Tự động chọn lớp đầu tiên
        setSelectedClass(uniqueClasses[0]._id);
      }
    } else {
      // Nếu không có lớp nào, reset
      setSelectedClass("");
    }
  }, [selectedSubject, allAssignments, selectedClass]);

  // 🔹 Lấy danh sách học sinh trong lớp
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedClass || !selectedSubject || !selectedYear || !selectedSemester) return;
      try {
        const res = await gradesApi.getClassSubjectSummary({
          classId: selectedClass,
          subjectId: selectedSubject,
          schoolYear: selectedYear,
          semester: selectedSemester,
        });
        const data = res.data || [];
        
        // ✅ Format dữ liệu để đảm bảo có name và _id
        const formattedData = data.map((st: any) => {
          // Lấy điểm từ averages hoặc từ các trường trực tiếp
          const averages = st.averages || {};
          return {
            _id: st.studentId || st._id, // ID của học sinh (ưu tiên studentId)
            name: st.name || st.studentId?.name || 'Chưa có tên', // Tên học sinh
            studentCode: st.studentCode || st.studentId?.studentCode || '',
            // Lấy điểm từ averages hoặc từ các trường trực tiếp
            oral: averages.oral ?? st.oral ?? undefined,
            quiz15: averages.quiz15 ?? st.quiz15 ?? undefined,
            quiz45: averages.quiz45 ?? st.quiz45 ?? undefined,
            midterm: averages.midterm ?? st.midterm ?? undefined,
            // ✅ Điểm cuối kỳ: CHỈ lấy từ điểm thi cuối kỳ (final), KHÔNG fallback về điểm TB môn (average)
            final: averages.final ?? st.final ?? undefined,
            average: st.average,
            averages: st.averages || {},
            // ✅ Lấy gradeItems từ backend (mảng điểm riêng lẻ cho mỗi component)
            gradeItems: st.gradeItems || {},
            // ✅ Lấy trạng thái công bố điểm
            isOfficial: st.isOfficial === true,
            officialAt: st.officialAt || null,
          };
        });
        
        setStudents(formattedData);

        // ✅ initialize scores map from returned data (support multiple components)
        // ✅ Ưu tiên lấy từ gradeItems (mảng điểm riêng lẻ) nếu có
        const map: Record<string, any> = {};
        formattedData.forEach((st: any) => {
          const gradeItems = st.gradeItems || {};
          
          map[st._id] = {
            // ✅ Nếu có gradeItems, chuyển mảng thành string comma-separated
            oral: gradeItems.oral && gradeItems.oral.length > 0 
              ? gradeItems.oral.map((s: number) => s.toFixed(1)).join(', ')
              : (st.oral ?? undefined),
            quiz15: gradeItems.quiz15 && gradeItems.quiz15.length > 0
              ? gradeItems.quiz15.map((s: number) => s.toFixed(1)).join(', ')
              : (st.quiz15 ?? undefined),
            quiz45: gradeItems.quiz45 && gradeItems.quiz45.length > 0
              ? gradeItems.quiz45.map((s: number) => s.toFixed(1)).join(', ')
              : (st.quiz45 ?? undefined),
            midterm: gradeItems.midterm && gradeItems.midterm.length > 0
              ? gradeItems.midterm.map((s: number) => s.toFixed(1)).join(', ')
              : (st.midterm ?? undefined),
            final: gradeItems.final && gradeItems.final.length > 0
              ? gradeItems.final.map((s: number) => s.toFixed(1)).join(', ')
              : (st.final ?? undefined),
          };
        });
        setScores(map);
        setInitialScores(map);
        // reset errors
        setErrors({});

        // Không hiển thị ĐTB HK cho giáo viên bộ môn
      } catch (err) {
        console.error("Failed to load students", err);
        setStudents([]);
      }
    };
    fetchStudents();
  }, [selectedClass, selectedSubject, selectedYear, selectedSemester]);

  // 🔹 Cập nhật điểm (multi-component)
  // ✅ Hỗ trợ nhập nhiều điểm cho cùng component (ví dụ: "8, 9, 6.4")
  const handleScoreChange = (studentId: string, component: string, value: string) => {
    if (!isGradeEntryAllowed) {
      return;
    }
    // Cho phép nhập nhiều điểm cách nhau bởi dấu phẩy
    // Ví dụ: "8, 9, 6.4" hoặc "8,9,6.4"
    
    if (value === "") {
      setScores(prev => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [component]: undefined,
        }
      }));
      setErrors(prev => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [component]: false,
        }
      }));
      return;
    }

    // Tách thành mảng các điểm
    const scoreStrings = value.split(',').map(s => s.trim());
    
    // Validate từng điểm: phải là số từ 0-10
    let isValid = true;
    const validScores: number[] = [];
    
    for (const scoreStr of scoreStrings) {
      const normalized = scoreStr.replace(',', '.');
      const num = parseFloat(normalized);
      
      if (isNaN(num) || num < 0 || num > 10) {
        isValid = false;
        break;
      }
      validScores.push(num);
    }

    // Lưu giá trị dạng string để hiển thị (giữ nguyên format người dùng nhập)
    // Nhưng cũng lưu dạng array để dễ xử lý khi lưu
    setScores(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [component]: value, // Lưu dạng string để hiển thị
      }
    }));

    setErrors(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [component]: !isValid,
      }
    }));
  };

  // 🔹 Lưu điểm cho một học sinh + component cụ thể (tự động khi Enter hoặc blur)
  // ✅ Hỗ trợ nhiều điểm cho cùng component (ví dụ: "8, 9, 6.4" cho điểm miệng)
  const handleSaveSingleScore = async (studentId: string, component: string) => {
    if (!selectedClass || !selectedSubject || !selectedYear || !selectedSemester) {
      return;
    }

    if (!isGradeEntryAllowed) {
      toast.error(timeInfo?.message || 'Không trong thời gian cho phép nhập điểm');
      return;
    }

    const studentScores = scores[studentId] || {};
    const scoreValue: string | number | undefined = studentScores[component as keyof typeof studentScores] as string | number | undefined;

    // Cho phép lưu cả khi rỗng (để xóa hết điểm của component)

    // Kiểm tra lỗi validation
    if (errors[studentId]?.[component]) {
      return;
    }

    // Kiểm tra xem điểm có thay đổi so với initialScores không
    const initialScore = initialScores[studentId]?.[component as keyof typeof initialScores[string]];
    if (initialScore === scoreValue) {
      // Không có thay đổi, không cần lưu
      return;
    }

    try {
      // ✅ Xử lý nhiều điểm: nếu scoreValue là string chứa dấu phẩy, tách thành mảng
      // Ví dụ: "8, 9, 6.4" -> [8, 9, 6.4]
      let scoreArray: number[] = [];
      
      if (typeof scoreValue === 'string') {
        // Tách theo dấu phẩy và chuyển thành số
        scoreArray = scoreValue
          .split(',')
          .map(s => s.trim())
          .map(s => parseFloat(s.replace(',', '.')))
          .filter(n => !isNaN(n) && n >= 0 && n <= 10);
      } else if (typeof scoreValue === 'number' && !isNaN(scoreValue)) {
        scoreArray = [scoreValue];
      }

      if (scoreArray.length === 0) {
        // Không còn điểm nào cho component này → gọi API xóa toàn bộ điểm component
        try {
          await gradesApi.deleteGradeItems({
            studentId,
            subjectId: selectedSubject,
            component,
            classId: selectedClass,
            schoolYear: selectedYear,
            semester: selectedSemester,
          });

          // Cập nhật local state
          setScores(prev => ({
            ...prev,
            [studentId]: {
              ...(prev[studentId] || {}),
              [component]: undefined,
            }
          }));
          setInitialScores(prev => ({
            ...prev,
            [studentId]: {
              ...(prev[studentId] || {}),
              [component]: undefined,
            }
          }));

          // Reload lại điểm TB từ backend
          try {
            const res = await gradesApi.getClassSubjectSummary({
              classId: selectedClass,
              subjectId: selectedSubject,
              schoolYear: selectedYear,
              semester: selectedSemester,
            });
            const updatedStudent = res.data?.find((st: any) => st.studentId === studentId || st._id === studentId);
            if (updatedStudent) {
              setStudents(prev => prev.map(st => 
                st._id === studentId 
                  ? { ...st, average: updatedStudent.average, averages: updatedStudent.averages || {} }
                  : st
              ));
            }
          } catch (reloadErr) {
            console.warn("Failed to reload student grade after delete", reloadErr);
          }

          const studentName = students.find(s => s._id === studentId)?.name || 'học sinh';
          toast.success(`Đã xóa toàn bộ điểm ${componentLabels[component]} cho ${studentName}`);
          return;
        } catch (delErr) {
          console.error('Delete empty component failed', delErr);
          toast.error('Xóa điểm thất bại');
          return;
        }
      }

      console.log('[handleSaveSingleScore] Saving scores with params:', {
        studentId,
        subjectId: selectedSubject,
        classId: selectedClass,
        schoolYear: selectedYear,
        semester: selectedSemester,
        component,
        scores: scoreArray,
        count: scoreArray.length,
      });

      if (!selectedClass || !selectedSubject || !selectedYear || !selectedSemester) {
        console.error('[handleSaveSingleScore] Missing required params:', {
          selectedClass,
          selectedSubject,
          selectedYear,
          selectedSemester
        });
        toast.error("Thiếu thông tin lớp/môn/năm học/học kỳ");
        return;
      }

      // ✅ Lưu mảng điểm bằng endpoint bulk (tự động xóa điểm cũ và lưu điểm mới)
      await gradesApi.upsertGradeItems({
        studentId,
        subjectId: selectedSubject,
        component,
        scores: scoreArray,
        classId: selectedClass,
        schoolYear: selectedYear,
        semester: selectedSemester,
      });

      // ✅ upsertGradeItem đã tự động gọi recomputeSummary trong backend
      // Nhưng để đảm bảo UI cập nhật ngay, ta reload lại điểm của học sinh này
      // Hoặc có thể tính lại điểm TB ở frontend dựa trên scores hiện tại
      
      // Cập nhật initialScores để đánh dấu đã lưu (lưu giá trị string để giữ nguyên format)
      setInitialScores(prev => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [component]: scoreValue, // Lưu giá trị gốc (string hoặc number)
        }
      }));

      // ✅ Reload lại điểm của học sinh này để cập nhật điểm TB từ backend
      try {
        const res = await gradesApi.getClassSubjectSummary({
          classId: selectedClass,
          subjectId: selectedSubject,
          schoolYear: selectedYear,
          semester: selectedSemester,
        });
        const updatedStudent = res.data?.find((st: any) => st.studentId === studentId || st._id === studentId);
        if (updatedStudent) {
          // Cập nhật điểm TB và trạng thái công bố trong danh sách học sinh
          setStudents(prev => prev.map(st => 
            st._id === studentId 
              ? { 
                  ...st, 
                  average: updatedStudent.average, 
                  averages: updatedStudent.averages || {},
                  isOfficial: updatedStudent.isOfficial === true,
                  officialAt: updatedStudent.officialAt || null,
                }
              : st
          ));
        }
      } catch (reloadErr) {
        console.warn("Failed to reload student grade", reloadErr);
        // Không cần hiển thị lỗi, chỉ log
      }

      // Hiển thị toast nhỏ (không làm phiền quá nhiều)
      const studentName = students.find(s => s._id === studentId)?.name || 'học sinh';
      toast.success(`Đã lưu điểm ${componentLabels[component]} cho ${studentName}`, {
        duration: 2000,
      });
    } catch (err) {
      console.error("Save single score failed", err);
      toast.error("Lưu điểm thất bại");
    }
  };

  // (Đã bỏ nút "Xóa cột"; việc xóa được thực hiện bằng cách xóa hết ô và lưu.)

  // 🔹 Lưu điểm (hàm này có thể không còn cần thiết vì đã dùng auto-save từng input)
  const handleSaveScores = async () => {
    if (!selectedClass || !selectedSubject || !selectedYear || !selectedSemester) {
      toast.error("Vui lòng chọn đủ thông tin lớp, môn, năm học, học kỳ");
      return;
    }

    if (!isGradeEntryAllowed) {
      toast.error(timeInfo?.message || 'Không trong thời gian cho phép nhập điểm');
      return;
    }

    setSaving(true);
      try {
        // ✅ Convert string sang number và filter undefined
        const convertToNumber = (value: string | number | undefined): number | undefined => {
          if (value === undefined || value === null) return undefined;
          if (typeof value === 'number') return value;
          if (typeof value === 'string') {
            // Nếu là string comma-separated, lấy điểm đầu tiên hoặc trung bình
            const nums = value.split(',').map(s => parseFloat(s.trim().replace(',', '.'))).filter(n => !isNaN(n));
            return nums.length > 0 ? nums[0] : undefined;
          }
          return undefined;
        };

        // build payload for bulk save
        const payload = {
          classId: selectedClass,
          subjectId: selectedSubject,
          schoolYear: selectedYear,
          semester: selectedSemester,
          scores: Object.entries(scores).map(([studentId, comps]) => ({
            studentId,
            oral: convertToNumber(comps.oral),
            quiz15: convertToNumber(comps.quiz15),
            quiz45: convertToNumber(comps.quiz45),
            midterm: convertToNumber(comps.midterm),
            final: convertToNumber(comps.final),
          })).filter(item => 
            // Chỉ lưu học sinh có ít nhất 1 điểm
            item.oral !== undefined || item.quiz15 !== undefined || 
            item.quiz45 !== undefined || item.midterm !== undefined || item.final !== undefined
          )
        };

        await gradesApi.saveScores(payload);
        // optionally recompute summaries for each student
        await Promise.all(
          Object.keys(scores).map(studentId => gradesApi.recomputeSummary({
            studentId,
            subjectId: selectedSubject,
            classId: selectedClass,
            schoolYear: selectedYear,
            semester: selectedSemester,
          }))
        );

        toast.success("Đã lưu điểm thành công!");
        // update initialScores to current after successful save
        setInitialScores(scores as any);
      } catch (err) {
        console.error("Save scores failed", err);
        toast.error("Lưu điểm thất bại");
      } finally {
        setSaving(false);
      }
  };

  // 🔹 Công bố điểm môn học (đánh dấu isOfficial cho toàn bộ học sinh của lớp/môn/học kỳ)
  const handlePublish = async () => {
    if (!selectedClass || !selectedSubject || !selectedYear || !selectedSemester) {
      toast.error("Vui lòng chọn đủ thông tin lớp, môn, năm học, học kỳ");
      return;
    }

    if (!isGradeEntryAllowed) {
      toast.error(timeInfo?.message || 'Không trong thời gian cho phép nhập điểm');
      return;
    }
    const subjectName = subjects.find(s => s._id === selectedSubject)?.name || 'môn học';
    const className = classes.find(c => c._id === selectedClass)?.className || 'lớp';
    const result = await Swal.fire({
      title: 'Xác nhận công bố điểm',
      html: `
        <div style="text-align: left;">
          <p><strong>Môn học:</strong> ${subjectName}</p>
          <p><strong>Lớp:</strong> ${className}</p>
          <p><strong>Năm học:</strong> ${selectedYear}</p>
          <p><strong>Học kỳ:</strong> ${selectedSemester}</p>
          <p style="margin-top: 15px; color: #666;">Sau khi công bố, học sinh và GVCN sẽ nhìn thấy điểm chính thức.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Công bố',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      width: '500px'
    });
    if (!result.isConfirmed) return;
    try {
      setPublishing(true);
      await gradesApi.publishSubject({
        classId: selectedClass,
        subjectId: selectedSubject,
        schoolYear: selectedYear,
        semester: String(selectedSemester),
      });
      toast.success(`Đã công bố điểm ${subjectName} cho ${className} (HK${selectedSemester})`);
      // Reload dữ liệu điểm để phản ánh trạng thái mới (nếu backend trả isOfficial)
      try {
        const res = await gradesApi.getClassSubjectSummary({
          classId: selectedClass,
          subjectId: selectedSubject,
          schoolYear: selectedYear,
          semester: String(selectedSemester),
        });
        const data = res.data || [];
        const formattedData = data.map((st: any) => ({
          _id: st.studentId || st._id,
          name: st.name || st.studentId?.name || 'Chưa có tên',
          studentCode: st.studentCode || st.studentId?.studentCode || '',
          oral: st.averages?.oral ?? st.oral ?? undefined,
          quiz15: st.averages?.quiz15 ?? st.quiz15 ?? undefined,
          quiz45: st.averages?.quiz45 ?? st.quiz45 ?? undefined,
          midterm: st.averages?.midterm ?? st.midterm ?? undefined,
          final: st.averages?.final ?? st.final ?? undefined,
          average: st.average,
          averages: st.averages || {},
          gradeItems: st.gradeItems || {},
          isOfficial: st.isOfficial === true,
          officialAt: st.officialAt || null,
        }));
        setStudents(formattedData);
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Công bố điểm thất bại';
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  };

  // 🔹 Công bố điểm cho 1 học sinh
  const handlePublishStudent = async (studentId: string) => {
    if (!selectedClass || !selectedSubject || !selectedYear || !selectedSemester) {
      toast.error("Vui lòng chọn đủ thông tin lớp, môn, năm học, học kỳ");
      return;
    }

    if (!isGradeEntryAllowed) {
      toast.error(timeInfo?.message || 'Không trong thời gian cho phép nhập điểm');
      return;
    }

    const student = students.find(s => s._id === studentId);
    const studentName = student?.name || 'học sinh';
    const studentCode = student?.studentCode || '';
    const subjectName = subjects.find(s => s._id === selectedSubject)?.name || 'môn học';
    const result = await Swal.fire({
      title: 'Xác nhận công bố điểm',
      html: `
        <div style="text-align: left;">
          <p><strong>Học sinh:</strong> ${studentName}${studentCode ? ` (${studentCode})` : ''}</p>
          <p><strong>Môn học:</strong> ${subjectName}</p>
          <p><strong>Năm học:</strong> ${selectedYear}</p>
          <p><strong>Học kỳ:</strong> ${selectedSemester}</p>
          <p style="margin-top: 15px; color: #666;">Sau khi công bố, học sinh và GVCN sẽ nhìn thấy điểm chính thức.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Công bố',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      width: '500px'
    });
    if (!result.isConfirmed) return;

    try {
      setPublishingStudentId(studentId);
      await gradesApi.publishStudentGrade({
        studentId,
        subjectId: selectedSubject,
        schoolYear: selectedYear,
        semester: String(selectedSemester),
      });
      toast.success(`✅ Đã công bố điểm ${subjectName} cho ${studentName} (HK${selectedSemester})`, {
        duration: 3000,
      });
      // Reload dữ liệu điểm để phản ánh trạng thái mới
      try {
        const res = await gradesApi.getClassSubjectSummary({
          classId: selectedClass,
          subjectId: selectedSubject,
          schoolYear: selectedYear,
          semester: String(selectedSemester),
        });
        const data = res.data || [];
        const formattedData = data.map((st: any) => ({
          _id: st.studentId || st._id,
          name: st.name || st.studentId?.name || 'Chưa có tên',
          studentCode: st.studentCode || st.studentId?.studentCode || '',
          oral: st.averages?.oral ?? st.oral ?? undefined,
          quiz15: st.averages?.quiz15 ?? st.quiz15 ?? undefined,
          quiz45: st.averages?.quiz45 ?? st.quiz45 ?? undefined,
          midterm: st.averages?.midterm ?? st.midterm ?? undefined,
          final: st.averages?.final ?? st.final ?? undefined,
          average: st.average,
          averages: st.averages || {},
          gradeItems: st.gradeItems || {},
          isOfficial: st.isOfficial === true,
          officialAt: st.officialAt || null,
        }));
        setStudents(formattedData);
      } catch (e) {
        // Nếu reload thất bại, cập nhật trạng thái local
        setStudents(prev => prev.map(st => 
          st._id === studentId 
            ? { ...st, isOfficial: true, officialAt: new Date() }
            : st
        ));
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Công bố điểm thất bại';
      toast.error(`❌ ${msg}`, {
        duration: 3000,
      });
    } finally {
      setPublishingStudentId(null);
    }
  };

    const resetToInitial = () => {
      setScores(initialScores);
      setErrors({});
    };

    const isDirty = JSON.stringify(scores) !== JSON.stringify(initialScores);
    const hasInvalid = Object.values(errors).some(obj => Object.values(obj).some(Boolean));

  // ✅ Tính điểm trung bình theo cấu hình
  // ✅ Logic mới: Tổng điểm của component nhân hệ số, không phải trung bình nhân hệ số
  const calculateAverage = (studentScores: typeof scores[string], studentData?: any): number | null => {
    // Ưu tiên lấy điểm TB từ backend (từ studentData.average)
    if (studentData?.average !== undefined && studentData?.average !== null) {
      return studentData.average;
    }
    
    // Nếu không có từ backend, tính từ scores hiện tại
    if (!gradeConfig || !gradeConfig.weights) return null;
    
    const weights = gradeConfig.weights;
    let sum = 0;
    let weightSum = 0;
    
    Object.entries(weights).forEach(([component, weight]) => {
      if (weight > 0 && studentScores[component as keyof typeof studentScores] !== undefined) {
        const scoreValue = studentScores[component as keyof typeof studentScores];
        
        // ✅ Xử lý nhiều điểm: nếu là string (comma-separated), tách thành mảng
        let scoreArray: number[] = [];
        if (typeof scoreValue === 'string') {
          scoreArray = scoreValue
            .split(',')
            .map(s => s.trim())
            .map(s => parseFloat(s.replace(',', '.')))
            .filter(n => !isNaN(n) && n >= 0 && n <= 10);
        } else if (typeof scoreValue === 'number' && !isNaN(scoreValue)) {
          scoreArray = [scoreValue];
        }
        
        if (scoreArray.length > 0) {
          // ✅ Tổng điểm của component nhân với hệ số
          const componentSum = scoreArray.reduce((a, b) => a + b, 0);
          sum += componentSum * weight;
          // ✅ Tổng hệ số = số lượng điểm × hệ số component
          weightSum += scoreArray.length * weight;
        }
      }
    });
    
    if (weightSum === 0) return null;
    const average = sum / weightSum;
    
    // Áp dụng làm tròn theo cấu hình
    if (gradeConfig.rounding === 'half-up') {
      return Math.round(average * 10) / 10;
    }
    return average;
  };

  // ✅ Xác định xếp loại học tập theo cấu hình
  const getClassification = (average: number | null, subjectScores: number[]): string => {
    if (!gradeConfig?.classification || average === null) return '';
    
    const cls = gradeConfig.classification;
    
    // Kiểm tra điểm yếu trước
    if (cls.weak) {
      if (average < cls.weak.maxAverage) return 'Yếu';
      if (cls.weak.maxSubjectScore && subjectScores.some(s => s < cls.weak.maxSubjectScore!)) {
        return 'Yếu';
      }
    }
    
    // Kiểm tra Giỏi
    if (cls.excellent && average >= cls.excellent.minAverage) {
      if (subjectScores.every(s => s >= cls.excellent!.minSubjectScore)) {
        return 'Giỏi';
      }
    }
    
    // Kiểm tra Khá
    if (cls.good && average >= cls.good.minAverage) {
      if (subjectScores.every(s => s >= cls.good!.minSubjectScore)) {
        return 'Khá';
      }
    }
    
    // Kiểm tra Trung bình
    if (cls.average && average >= cls.average.minAverage) {
      if (subjectScores.every(s => s > cls.average!.minSubjectScore)) {
        return 'Trung bình';
      }
    }
    
    return 'Yếu';
  };

  // ✅ Kiểm tra đã đủ các thành phần có trọng số > 0 (theo cấu hình) hay chưa
  const hasAllRequiredComponents = (studentScores: typeof scores[string]) => {
    if (!gradeConfig?.weights) return false;
    const required = Object.entries(gradeConfig.weights)
      .filter(([, w]) => (w ?? 0) > 0)
      .map(([k]) => k);

    const policy = gradeConfig.completionPolicy || 'at-least-one';
    const counts = required.map((comp) => {
      const val = studentScores[comp as keyof typeof studentScores];
      let count = 0;
      if (val === undefined || val === null || val === "") {
        count = 0;
      } else if (typeof val === "number") {
        count = 1;
      } else if (typeof val === "string") {
        const arr = val
          .split(",")
          .map((s) => s.trim())
          .map((s) => parseFloat(s.replace(",", ".")))
          .filter((n) => !isNaN(n));
        count = arr.length;
      }
      return { comp, count };
    });

    if (policy === 'require-counts') {
      return counts.every(({ comp, count }) => {
        const need = gradeConfig.columnCounts?.[comp] ?? 1;
        return count >= need;
      });
    }
    // at-least-one
    return counts.every(({ count }) => count > 0);
  };

  // ✅ Lấy danh sách các loại điểm đang được sử dụng (weight > 0)
  const activeComponents = gradeConfig?.weights
    ? Object.entries(gradeConfig.weights)
        .filter(([_, weight]) => weight > 0)
        .map(([component]) => component)
    : ['oral', 'quiz15', 'quiz45', 'midterm', 'final'];

  // ✅ Label mapping cho các loại điểm
  const componentLabels: Record<string, string> = {
    oral: 'Miệng',
    quiz15: '15 phút',
    quiz45: '45 phút',
    midterm: 'Giữa kỳ',
    final: 'Cuối kỳ',
  };

  if (authLoading) return <p>Đang tải thông tin đăng nhập...</p>;
  if (!backendUser || backendUser.role !== "teacher") return <p>Bạn không có quyền truy cập trang này.</p>;
  
  // ✅ Lưu ý: GVCN vẫn có thể nhập điểm nếu được phân công dạy môn đó
  // Logic kiểm tra quyền sẽ được thực hiện ở backend dựa trên TeachingAssignment

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Nhập điểm cho học sinh</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-4 gap-4">
          <Select onValueChange={setSelectedYear} value={selectedYear}>
            <SelectTrigger><SelectValue placeholder="Chọn năm học" /></SelectTrigger>
            <SelectContent>
              {schoolYears.map(y => (
                <SelectItem key={y.code} value={y.code}>
                  {y.name} {currentYearData?.code === y.code && "(Hiện tại)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={setSelectedSemester} value={selectedSemester}>
            <SelectTrigger><SelectValue placeholder="Chọn học kỳ" /></SelectTrigger>
            <SelectContent>
              {semesters.map(s => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* ✅ Môn học hiển thị trước, không cần chọn lớp */}
          <Select onValueChange={setSelectedSubject} value={selectedSubject}>
            <SelectTrigger><SelectValue placeholder="Chọn môn học" /></SelectTrigger>
            <SelectContent>
              {subjects.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* ✅ Lớp học chỉ hiển thị sau khi chọn môn học */}
          <Select 
            onValueChange={setSelectedClass} 
            value={selectedClass}
            disabled={!selectedSubject || classes.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={!selectedSubject ? "Chọn môn học trước" : "Chọn lớp học"} />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c._id} value={c._id}>
                  {c.className} ({c.grade})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* ✅ Thông báo nếu không có phân công */}
        {selectedYear && selectedSemester && subjects.length === 0 && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Không có môn học nào được phân công cho bạn trong năm học {selectedYear} - Học kỳ {selectedSemester}
            </p>
          </div>
        )}

        {students.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            {/* ✅ Tổng quan nhanh: sĩ số, trung bình môn của lớp, tỷ lệ đạt */}
            {students.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="px-2 py-1 rounded bg-muted">Sĩ số: <b>{students.length}</b></span>
                {(() => {
                  const avgs = students
                    .map((s) => (typeof s.average === 'number' ? s.average : calculateAverage(scores[s._id] || {}, s)))
                    .filter((v) => typeof v === 'number' && !isNaN(v)) as number[];
                  const classAvg = avgs.length ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10 : null;
                  const passCount = avgs.filter((v) => v >= 5).length;
                  const passRate = avgs.length ? Math.round((passCount / avgs.length) * 100) : 0;
                  return (
                    <>
                      <span className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200">
                        TB môn (cả lớp): <b>{classAvg !== null ? classAvg.toFixed(1) : '-'}</b>
                      </span>
                      <span className="px-2 py-1 rounded bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-200">
                        Tỉ lệ đạt (≥5.0): <b>{passRate}%</b>
                      </span>
                    </>
                  );
                })()}
              </div>
            )}
            {/* ✅ Hiển thị thông tin cấu hình điểm */}
            {gradeConfig && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                  Cấu hình điểm: {activeComponents.map(comp => `${componentLabels[comp]} (×${gradeConfig.weights[comp]})`).join(' + ')}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Làm tròn: {gradeConfig.rounding === 'half-up' ? 'Làm tròn 0.5 lên' : 'Không làm tròn'}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Dấu *: {gradeConfig?.completionPolicy === 'require-counts' 
                    ? 'Điểm tạm thời (chưa đủ số cột theo cấu hình)'
                    : 'Điểm tạm thời (chưa đủ các thành phần bắt buộc)'}
                </p>
              </div>
            )}

            <Alert variant={!isGradeEntryAllowed && isGradeWindowLoaded ? "destructive" : "default"} className="mb-4">
              <div className="flex items-start gap-3">
                {!isGradeWindowLoaded ? (
                  <Clock className="h-5 w-5 mt-1" />
                ) : isGradeEntryAllowed ? (
                  <Clock className="h-5 w-5 mt-1" />
                ) : (
                  <Lock className="h-5 w-5 mt-1" />
                )}
                <div>
                  <AlertTitle>Thời gian nhập điểm</AlertTitle>
                  <AlertDescription>
                    {gradeWindowMessage}
                  </AlertDescription>
                </div>
              </div>
            </Alert>

            <table className="w-full text-sm border relative">
              <thead>
                <tr className="bg-gray-100 text-left sticky top-0 z-20">
                  <th className="p-2 border sticky left-0 z-30 bg-gray-100">STT</th>
                  <th className="p-2 border sticky left-12 z-30 bg-gray-100 min-w-[180px]">Họ và tên</th>
                  {/* ✅ Hiển thị các cột điểm động theo cấu hình - Header có colspan nếu columnCount > 1 */}
                  {activeComponents.map(component => {
                    const columnCount = gradeConfig?.columnCounts?.[component] || 1;
                    return (
                      <th 
                        key={component} 
                        className="p-2 border text-center"
                        colSpan={columnCount}
                      >
                        {componentLabels[component]}
                        {gradeConfig?.weights[component] && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (×{gradeConfig.weights[component]})
                          </span>
                        )}
                      </th>
                    );
                  })}
                  <th className="p-2 border sticky right-[120px] z-30 bg-gray-100 min-w-[110px] text-center">ĐTB môn</th>
                  <th className="p-2 border sticky right-0 z-30 bg-gray-100 min-w-[120px] text-center">Công bố</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st, i) => {
                  const studentScores = scores[st._id] || {};
                  // ✅ Truyền cả studentData để ưu tiên lấy average từ backend
                  let average = calculateAverage(studentScores, st);
                  
                  // ✅ Nếu không tính được từ frontend, thử lấy từ st.average (backend)
                  if (average === null && st.average !== undefined && st.average !== null) {
                    average = st.average;
                  }
                  
                  // ✅ Hàm để xác định màu sắc cho điểm TB môn
                  const getAverageColorClass = (avg: number | null): string => {
                    if (avg === null || isNaN(avg)) return 'text-gray-500';
                    if (avg >= 8) return 'text-yellow-600 font-bold'; // 8-10: vàng
                    if (avg >= 6.5) return 'text-blue-600 font-semibold'; // 6.5-7.9: xanh
                    if (avg >= 5.0) return 'text-black font-semibold'; // 5.0-6.4: đen
                    return 'text-red-600 font-bold'; // <5: đỏ
                  };
                  
                  return (
                    <tr key={st._id} className="border">
                      <td className="p-2 border sticky left-0 bg-background z-10 w-12 text-center">{i + 1}</td>
                      <td className="p-2 border font-medium sticky left-12 bg-background z-10 min-w-[180px]">{st.name}</td>
                      {/* ✅ Hiển thị các ô nhập điểm - Nhiều cột input riêng biệt nếu columnCount > 1 */}
                      {activeComponents.map(component => {
                        const columnCount = gradeConfig?.columnCounts?.[component] || 1;
                        const componentScore: string | number | undefined = studentScores[component as keyof typeof studentScores] as string | number | undefined;
                        
                        // Tách điểm thành mảng nếu là string (comma-separated) hoặc number
                        let scoreArray: (number | undefined)[] = [];
                        if (typeof componentScore === 'string') {
                          scoreArray = componentScore.split(',').map(s => {
                            const num = parseFloat(s.trim().replace(',', '.'));
                            return isNaN(num) ? undefined : num;
                          });
                        } else if (typeof componentScore === 'number') {
                          scoreArray = [componentScore];
                        }
                        
                        // Đảm bảo có đủ phần tử cho columnCount
                        while (scoreArray.length < columnCount) {
                          scoreArray.push(undefined);
                        }

                        // 🔹 Tính số cột còn thiếu (chỉ khi require-counts)
                        let missingCount: number | null = null;
                        if ((gradeConfig?.completionPolicy || 'at-least-one') === 'require-counts') {
                          const have = scoreArray.filter(v => typeof v === 'number').length;
                          const need = gradeConfig?.columnCounts?.[component] ?? 1;
                          missingCount = have < need ? (need - have) : 0;
                        }
                        
                        // Hiển thị nhiều input riêng biệt (mỗi input cho 1 điểm)
                        return scoreArray.slice(0, columnCount).map((score, index) => (
                          <td key={`${component}-${index}`} className="p-2 border min-w-[80px] align-top">
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              value={score ?? ""}
                              onChange={e => {
                                // Cập nhật điểm tại vị trí index
                                const newScores = [...scoreArray];
                                const value = e.target.value;
                                newScores[index] = value === "" ? undefined : parseFloat(value);
                                
                                // Lưu lại dạng string với các điểm cách nhau bởi dấu phẩy
                                const scoreString = newScores
                                  .filter(s => s !== undefined && !isNaN(s))
                                  .map(s => s!.toFixed(1))
                                  .join(', ');
                                
                                handleScoreChange(st._id, component, scoreString || "");
                              }}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  // Luôn gọi lưu (kể cả khi rỗng → xóa)
                                  await handleSaveSingleScore(st._id, component);
                                  e.currentTarget.blur();
                                }
                              }}
                              onBlur={async () => {
                                // Luôn gọi lưu (kể cả khi rỗng → xóa)
                                await handleSaveSingleScore(st._id, component);
                              }}
                              className={`w-20 ${errors[st._id]?.[component] ? 'border border-destructive' : ''}`}
                              disabled={loadingConfig || saving || !isGradeEntryAllowed}
                              placeholder=""
                            />
                            {index === 0 && missingCount !== null && missingCount > 0 && (
                              <div className="mt-1">
                                <Badge variant="destructive">Thiếu {missingCount}</Badge>
                              </div>
                            )}
                          </td>
                        ));
                      })}
                      {/* ✅ Hiển thị điểm trung bình môn với màu sắc */}
                      <td className={`p-2 border text-center font-semibold sticky right-[120px] bg-background z-10 min-w-[110px] ${getAverageColorClass(average)}`}>
                        {average !== null ? (
                          <div className="flex items-center justify-center gap-1">
                            <span>{average.toFixed(1)}</span>
                            {!hasAllRequiredComponents(studentScores) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-muted-foreground cursor-help">*</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <span>{gradeConfig?.completionPolicy === 'require-counts' 
                                      ? 'Điểm tạm thời (chưa đủ số cột theo cấu hình)'
                                      : 'Điểm tạm thời (chưa đủ các thành phần bắt buộc)'}
                                    </span>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      {/* ✅ Nút công bố điểm cho từng học sinh */}
                      <td className="p-2 border text-center sticky right-0 bg-background z-10 min-w-[120px]">
                        {st.isOfficial ? (
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="default" className="bg-green-600 text-white">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Đã công bố
                            </Badge>
                            {st.officialAt && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(st.officialAt).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePublishStudent(st._id)}
                            disabled={publishingStudentId === st._id || publishing || !average || !isGradeEntryAllowed}
                            className="text-xs"
                          >
                            {publishingStudentId === st._id ? 'Đang công bố...' : '📢 Công bố'}
                          </Button>
                        )}
                      </td>
                      {/* Bỏ cột ĐTB HK ở trang giáo viên bộ môn */}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-4 flex justify-between items-center">
              <div>
                {!isDirty ? (
                  <span className="text-sm text-muted-foreground">Không có thay đổi</span>
                ) : hasInvalid ? (
                  <span className="text-sm text-destructive">Có ô nhập không hợp lệ</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Có {Object.keys(scores).length} học sinh thay đổi</span>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={handlePublish} disabled={publishing || !selectedClass || !selectedSubject || !selectedYear || !selectedSemester || !isGradeEntryAllowed}>
                  {publishing ? 'Đang công bố...' : '📢 Công bố điểm'}
                </Button>
                <Button variant="outline" onClick={resetToInitial} disabled={!isDirty || saving}>
                  Đặt lại
                </Button>
                <Button onClick={handleSaveScores} disabled={saving || !isDirty || hasInvalid || !isGradeEntryAllowed}>
                  {saving ? "Đang lưu..." : "💾 Lưu điểm"}
                </Button>
              </div>
            </div>
          </div>
        ) : <p className="text-gray-500">Chưa có dữ liệu học sinh</p>}
      </CardContent>
    </Card>
  );
};

export default TeacherEnterGradesPage;
