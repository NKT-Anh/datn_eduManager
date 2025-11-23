import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAssignments,
  useSubjects,
  useClasses,
  useTeachers,
  useSchoolYears,
} from "@/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { departmentApi } from "@/services/departmentApi";
import { useDepartmentManagement } from "@/hooks/departments/useDepartmentManagement";
import { teacherApi } from "@/services/teacherApi";
import { classPeriodsApi } from "@/services/classPeriodsApi";

export default function TeachingAssignmentsPage() {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"self" | "department">("self");
  
  // ✅ Sử dụng hooks để lấy data
  const { subjects: allSubjects } = useSubjects();
  const { classes } = useClasses();
  const { teachers } = useTeachers();
  const { schoolYears: allSchoolYears } = useSchoolYears();
  const { teachers: deptTeachers, fetchTeachers } = useDepartmentManagement();

  // ✅ Map school years và tìm năm học hiện tại
  const { schoolYears, currentYear } = useMemo(() => {
    const mapped = allSchoolYears.map((y: any) => ({
      code: y.code,
      name: y.name,
      isCurrent: y.isActive,
    }));
    const current = mapped.find((y) => y.isCurrent) || mapped[0];
    return {
      schoolYears: mapped,
      currentYear: current?.code || "", // Sử dụng code thay vì name
    };
  }, [allSchoolYears]);

  const [filterYear, setFilterYear] = useState<string>("");
  const [filterSemester, setFilterSemester] = useState<"1" | "2">("1");
  const [teacherLoadMap, setTeacherLoadMap] = useState<Record<string, { current: number; effective: number; remaining: number }>>({});
  const [teacherLoadLoading, setTeacherLoadLoading] = useState(false);
  const [showTeacherLoadCard, setShowTeacherLoadCard] = useState(false);
  const [classPeriodsMap, setClassPeriodsMap] = useState<Record<string, number>>({});

  // ✅ Sử dụng hooks để lấy data - filter theo năm học và học kỳ
  const { assignments: allAssignments, refetch: refetchAssignments } = useAssignments(
    filterYear ? { year: filterYear, semester: filterSemester } : undefined
  );

  // ✅ Load danh sách giáo viên trong tổ khi cần
  useEffect(() => {
    if (filterYear) {
      fetchTeachers({ year: filterYear, semester: filterSemester });
    }
  }, [filterYear, filterSemester, fetchTeachers]);

  // ✅ Lấy giáo viên trong tổ từ useDepartmentManagement
  const departmentTeachers = deptTeachers?.teachers || [];

  // ✅ Lấy môn học và giáo viên từ bảng phân công (assignments)
  // Tương tự như ProposalsPage nhưng lấy từ assignments thay vì từ department API
  const departmentSubjects = useMemo(() => {
    if (!filterYear || allAssignments.length === 0) {
      // Nếu chưa có năm học hoặc chưa có assignments, lấy từ giáo viên trong tổ
      const subjectIds = new Set<string>();
      departmentTeachers.forEach(teacher => {
        teacher.subjects?.forEach(sub => {
          const subjectId = typeof sub.subjectId === "object" && sub.subjectId !== null
            ? sub.subjectId._id
            : sub.subjectId;
          if (subjectId) subjectIds.add(String(subjectId));
        });
      });
      
      return allSubjects.filter(sub => subjectIds.has(String(sub._id)));
    }

    // Lấy môn học từ assignments (chỉ các môn học được phân công trong tổ)
    // Kiểm tra xem giáo viên trong assignment có phải là giáo viên trong tổ không
    const deptTeacherIds = new Set(departmentTeachers.map((t: any) => String(t._id)));
    const validSubjectIds = new Set<string>();
    
    allAssignments
      .filter((a) => {
        const matchesYear = a.year === filterYear;
        const matchesSemester = !filterSemester || a.semester === filterSemester;
        const teacherId = typeof a.teacherId === "object" && a.teacherId !== null
          ? a.teacherId._id
          : a.teacherId;
        return matchesYear && matchesSemester && teacherId && deptTeacherIds.has(String(teacherId));
      })
      .forEach((a) => {
        const subjectId = typeof a.subjectId === "object" && a.subjectId !== null
          ? a.subjectId._id
          : a.subjectId;
        if (subjectId) validSubjectIds.add(String(subjectId));
      });

    return allSubjects.filter(sub => validSubjectIds.has(String(sub._id)));
  }, [allSubjects, allAssignments, filterYear, filterSemester, departmentTeachers]);

  // ✅ Lọc subjects để hiển thị
  const subjects = useMemo(() => {
    return departmentSubjects;
  }, [departmentSubjects]);

  // ✅ Lọc assignments theo: năm học, học kỳ, môn học trong tổ bộ môn
  const allFilteredAssignments = useMemo(() => {
    const deptSubjectIds = new Set(departmentSubjects.map((s: any) => s._id));
    return allAssignments
      .filter((a) => {
        const subjectId = typeof a.subjectId === "object" && a.subjectId !== null
          ? a.subjectId._id
          : a.subjectId;
        // Lọc theo môn học trong tổ bộ môn
        const matchesSubject = deptSubjectIds.has(subjectId);
        // Lọc theo năm học
        const matchesYear = !filterYear || a.year === filterYear;
        // Lọc theo học kỳ
        const matchesSemester = !filterSemester || a.semester === filterSemester;
        
        return matchesSubject && matchesYear && matchesSemester;
      })
      .sort((a, b) => a.classId?.className?.localeCompare(b.classId?.className || "") || 0);
  }, [allAssignments, departmentSubjects, filterYear, filterSemester]);

  // ✅ Lọc assignments theo tab: "Bản thân" hoặc "Thành viên trong tổ"
  // Tab "Bản thân": lọc theo ID cá nhân giáo viên đăng nhập
  const assignments = useMemo(() => {
    if (activeTab === "self") {
      // Tab "Bản thân": chỉ hiển thị phân công của chính trưởng bộ môn
      // Lọc theo: năm học, học kỳ, môn học trong tổ, và ID cá nhân giáo viên đăng nhập
      const teacherIdObj = backendUser?.teacherId;
      if (!teacherIdObj) return [];
      const currentTeacherId = typeof teacherIdObj === "object"
        ? (teacherIdObj as any)?._id || teacherIdObj
        : teacherIdObj;
      if (!currentTeacherId) return [];
      
      return allFilteredAssignments.filter((a) => {
        const teacherId = typeof a.teacherId === "object" && a.teacherId !== null
          ? a.teacherId._id
          : a.teacherId;
        // Lọc theo ID cá nhân giáo viên đăng nhập
        return String(teacherId) === String(currentTeacherId);
      });
    } else {
      // Tab "Thành viên trong tổ": hiển thị phân công của tất cả thành viên trong tổ
      // Lọc theo: năm học, học kỳ, môn học trong tổ, và danh sách giáo viên trong tổ
      const departmentTeacherIds = new Set<string>();
      deptTeachers?.teachers?.forEach((teacher: any) => {
        const teacherId = teacher._id;
        if (teacherId) departmentTeacherIds.add(String(teacherId));
      });
      
      return allFilteredAssignments.filter((a) => {
        const teacherId = typeof a.teacherId === "object" && a.teacherId !== null
          ? a.teacherId._id
          : a.teacherId;
        return teacherId && departmentTeacherIds.has(String(teacherId));
      });
    }
  }, [allFilteredAssignments, activeTab, backendUser?.teacherId, deptTeachers]);

  // ✅ Set filterYear khi currentYear thay đổi
  useEffect(() => {
    if (currentYear && !filterYear) {
      setFilterYear(currentYear);
    }
  }, [currentYear, filterYear]);

  // ✅ Load teacher load status
  useEffect(() => {
    const loadTeacherStatus = async () => {
      if (!filterYear) {
        setTeacherLoadMap({});
        return;
      }
      try {
        setTeacherLoadLoading(true);
        const response = await teacherApi.checkStatus({
          year: filterYear,
          semester: filterSemester,
        });
        const map: Record<string, { current: number; effective: number; remaining: number }> = {};
        response.teacherAnalysis?.forEach((item: any) => {
          const id = item.teacherId?._id?.toString?.() || item.teacherId?.toString?.() || item.teacherId;
          if (!id) return;
          const current = item.currentWeeklyLessons || 0;
          const effective = item.effectiveWeeklyLessons || item.weeklyLessons || 17;
          const remaining = item.remainingWeeklyLessons ?? Math.max(0, effective - current);
          map[String(id)] = { current, effective, remaining };
        });
        setTeacherLoadMap(map);
      } catch (error) {
        console.error("Lỗi khi lấy tình trạng giáo viên:", error);
      } finally {
        setTeacherLoadLoading(false);
      }
    };
    loadTeacherStatus();
  }, [filterYear, filterSemester]);

  // ✅ Load class periods
  useEffect(() => {
    const loadClassPeriods = async () => {
      if (!filterYear) {
        setClassPeriodsMap({});
        return;
      }
      try {
        const allClassPeriods = await classPeriodsApi.getClassPeriods({
          year: filterYear,
          semester: filterSemester,
        });
        
        const periodsMap: Record<string, number> = {};
        allClassPeriods.forEach((cp) => {
          Object.entries(cp.subjectPeriods || {}).forEach(([subjectId, periods]) => {
            const key = `${subjectId}_${cp.classId}`;
            periodsMap[key] = periods as number;
          });
        });
        setClassPeriodsMap(periodsMap);
      } catch (error) {
        console.error("Lỗi khi load ClassPeriods:", error);
      }
    };
    loadClassPeriods();
  }, [filterYear, filterSemester]);

  // ✅ Tính toán số tiết giáo viên từ assignments
  const teacherLoadList = useMemo(() => {
    const targetTeachers = activeTab === "self" 
      ? (() => {
          const teacherIdObj = backendUser?.teacherId;
          if (!teacherIdObj) return [];
          const currentTeacherId = typeof teacherIdObj === "object"
            ? (teacherIdObj as any)?._id || teacherIdObj
            : teacherIdObj;
          if (!currentTeacherId) return [];
          return teachers.filter((t: any) => String(t._id) === String(currentTeacherId));
        })()
      : departmentTeachers;

    return targetTeachers
      .filter((teacher: any) => !teacher.teacherFlags?.isLeader) // Loại bỏ giáo viên BGH
      .map((teacher: any) => {
        const teacherIdStr = String(teacher._id);
        const effective = teacherLoadMap[teacherIdStr]?.effective || teacher.effectiveWeeklyLessons || teacher.weeklyLessons || 17;
        
        // Tính số tiết đã phân công từ assignments
        let current = 0;
        assignments
          .filter((a) => {
            const aTeacherId = typeof a.teacherId === "object" && a.teacherId !== null
              ? a.teacherId._id
              : a.teacherId;
            return String(aTeacherId) === teacherIdStr;
          })
          .forEach((a) => {
            const subjectId = typeof a.subjectId === "object" && a.subjectId !== null
              ? a.subjectId._id
              : a.subjectId;
            const classId = typeof a.classId === "object" && a.classId !== null
              ? a.classId._id
              : a.classId;
            
            // Lấy số tiết từ classPeriodsMap hoặc tính mặc định
            const periodKey = `${subjectId}_${classId}`;
            let periods = classPeriodsMap[periodKey];
            
            if (!periods) {
              const subject = allSubjects.find(s => String(s._id) === String(subjectId));
              if (subject) {
                const subjectName = subject.name.toLowerCase();
                const periodsMap: Record<string, number> = {
                  toán: 4, "ngữ văn": 4, văn: 4,
                  "tiếng anh": 3, anh: 3,
                  "vật lý": 2, "hóa học": 2, hóa: 2,
                  "sinh học": 2, sinh: 2,
                  "lịch sử": 2, "địa lý": 2, địa: 2,
                  "giáo dục công dân": 1, gdcd: 1,
                  "thể dục": 2, "công nghệ": 1,
                  "tin học": 1, tin: 1,
                };
                for (const [key, value] of Object.entries(periodsMap)) {
                  if (subjectName.includes(key)) {
                    periods = value;
                    break;
                  }
                }
                periods = periods || 2; // Default 2 tiết/tuần
              } else {
                periods = 2; // Default
              }
            }
            
            current += periods;
          });
        
        const remaining = Math.max(0, effective - current);
        
        return {
          id: teacher._id,
          name: teacher.name,
          mainSubject: teacher.mainSubject?.name || teacher.subjects?.[0]?.subjectId?.name || "Không rõ môn",
          current,
          effective,
          remaining,
          isOver: current > effective,
        };
      });
  }, [assignments, teachers, departmentTeachers, teacherLoadMap, classPeriodsMap, allSubjects, activeTab, backendUser?.teacherId]);

  // ✅ Tính toán summary
  const teacherLoadSummary = useMemo(() => {
    const total = teacherLoadList.length;
    const overloaded = teacherLoadList.filter((t) => t.isOver).length;
    const available = teacherLoadList.filter((t) => t.remaining > 0 && !t.isOver).length;
    return { total, overloaded, available };
  }, [teacherLoadList]);

  // ✅ Kiểm tra quyền truy cập: chỉ giáo viên mới được xem
  const isTeacher = backendUser?.role === "teacher";
  if (!isTeacher) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Bạn không có quyền truy cập trang này</p>
      </div>
    );
  }

  // ✅ Chỉ trưởng bộ môn mới có tab "Thành viên trong tổ"
  const isDepartmentHead = backendUser?.teacherFlags?.isDepartmentHead || false;
  
  // ✅ Nếu không phải trưởng bộ môn, chỉ hiển thị tab "Bản thân"
  useEffect(() => {
    if (!isDepartmentHead && activeTab === "department") {
      setActiveTab("self");
    }
  }, [isDepartmentHead, activeTab]);

  // ✅ Helper: Lấy giáo viên có thể dạy môn này
  const getAvailableTeachers = (subjectId?: string, classGrade?: string) => {
    if (!subjectId) return [];
    
    return teachers.filter((t) => {
      // Kiểm tra giáo viên có dạy môn này không
      const teachesSubject = t.subjects?.some((sub) => {
        const subId = typeof sub.subjectId === "object" && sub.subjectId !== null
          ? sub.subjectId._id
          : sub.subjectId;
        return subId === subjectId;
      });

      if (!teachesSubject) return false;

      // Kiểm tra giáo viên có dạy khối này không
      if (classGrade) {
        const teachesGrade = t.subjects?.some((sub) => {
          const subId = typeof sub.subjectId === "object" && sub.subjectId !== null
            ? sub.subjectId._id
            : sub.subjectId;
          return subId === subjectId && sub.grades?.includes(classGrade as any);
        });
        return teachesGrade;
      }

      return true;
    });
  };

  // ✅ Component render bảng phân công (dùng chung cho cả 2 tab)
  const renderAssignmentTables = () => {
    return (
      <div className="space-y-8">
        {(["10", "11", "12"] as const).map((grade) => {
          // Lọc classes theo khối và năm học
          // Tab "Bản thân": chỉ lấy lớp học mà bản thân được phân công
          // Tab "Thành viên trong tổ": lấy lớp học của tất cả giáo viên trong tổ
          const gradeClasses = useMemo(() => {
            if (!filterYear) return [];
            
            let assignmentClassIds = new Set<string>();
            
            if (activeTab === "self") {
              // Tab "Bản thân": chỉ lấy lớp học từ assignments của bản thân
              const teacherIdObj = backendUser?.teacherId;
              if (!teacherIdObj) return [];
              const currentTeacherId = typeof teacherIdObj === "object"
                ? (teacherIdObj as any)?._id || teacherIdObj
                : teacherIdObj;
              if (!currentTeacherId) return [];

              assignmentClassIds = new Set(
                assignments
                  .filter((a) => {
                    const teacherId = typeof a.teacherId === "object" && a.teacherId !== null
                      ? a.teacherId._id
                      : a.teacherId;
                    return String(teacherId) === String(currentTeacherId);
                  })
                  .map((a) => {
                    const classId = typeof a.classId === "object" && a.classId !== null
                      ? a.classId._id
                      : a.classId;
                    return String(classId);
                  })
              );
            } else {
              // Tab "Thành viên trong tổ": lấy lớp học từ assignments của tất cả giáo viên trong tổ
              const deptSubjectIds = new Set(departmentSubjects.map((s: any) => String(s._id)));
              const deptTeacherIds = new Set(departmentTeachers.map((t: any) => String(t._id)));
              
              assignmentClassIds = new Set(
                allAssignments
                  .filter((a) => {
                    const matchesYear = a.year === filterYear;
                    const matchesSemester = !filterSemester || a.semester === filterSemester;
                    const subjectId = typeof a.subjectId === "object" && a.subjectId !== null
                      ? a.subjectId._id
                      : a.subjectId;
                    const matchesSubject = deptSubjectIds.has(String(subjectId));
                    const teacherId = typeof a.teacherId === "object" && a.teacherId !== null
                      ? a.teacherId._id
                      : a.teacherId;
                    const matchesTeacher = teacherId && deptTeacherIds.has(String(teacherId));
                    return matchesYear && matchesSemester && matchesSubject && matchesTeacher;
                  })
                  .map((a) => {
                    const classId = typeof a.classId === "object" && a.classId !== null
                      ? a.classId._id
                      : a.classId;
                    return String(classId);
                  })
              );
            }
            
            // Lấy các lớp theo khối và năm học, chỉ giữ lại các lớp có trong assignments
            return classes
              .filter(c => c.grade === grade && c.year === filterYear && assignmentClassIds.has(String(c._id)))
              .sort((a, b) => a.className.localeCompare(b.className));
          }, [classes, grade, filterYear, allAssignments, assignments, filterSemester, departmentSubjects, departmentTeachers, activeTab, backendUser?.teacherId]);

          // Lọc subjects theo khối
          // Tab "Bản thân": chỉ lấy môn học mà bản thân được phân công
          // Tab "Thành viên trong tổ": lấy tất cả môn học trong tổ
          const gradeSubjects = useMemo(() => {
            if (activeTab === "self") {
              // Tab "Bản thân": chỉ lấy môn học từ assignments của bản thân
              const teacherIdObj = backendUser?.teacherId;
              if (!teacherIdObj) return [];
              const currentTeacherId = typeof teacherIdObj === "object"
                ? (teacherIdObj as any)?._id || teacherIdObj
                : teacherIdObj;
              if (!currentTeacherId) return [];

              const selfSubjectIds = new Set<string>();
              assignments
                .filter((a) => {
                  const teacherId = typeof a.teacherId === "object" && a.teacherId !== null
                    ? a.teacherId._id
                    : a.teacherId;
                  return String(teacherId) === String(currentTeacherId);
                })
                .forEach((a) => {
                  const subjectId = typeof a.subjectId === "object" && a.subjectId !== null
                    ? a.subjectId._id
                    : a.subjectId;
                  if (subjectId) selfSubjectIds.add(String(subjectId));
                });

              return allSubjects
                .filter(s => s.grades.includes(grade as any) && selfSubjectIds.has(String(s._id)))
                .sort((a, b) => a.name.localeCompare(b.name));
            } else {
              // Tab "Thành viên trong tổ": lấy tất cả môn học trong tổ
              return subjects
                .filter(s => s.grades.includes(grade as any))
                .sort((a, b) => a.name.localeCompare(b.name));
            }
          }, [subjects, grade, activeTab, assignments, backendUser?.teacherId, allSubjects]);

          // Helper: Lấy assignment cho môn + lớp
          const getAssignment = (subjectId: string, classId: string) => {
            if (!filterYear) return undefined;
            return assignments.find(
              (a) => {
                const aSubjectId = typeof a.subjectId === "object" && a.subjectId !== null
                  ? a.subjectId._id
                  : a.subjectId;
                const aClassId = typeof a.classId === "object" && a.classId !== null
                  ? a.classId._id
                  : a.classId;
                return (
                  aSubjectId === subjectId &&
                  aClassId === classId &&
                  a.year === filterYear &&
                  (!filterSemester || a.semester === filterSemester)
                );
              }
            );
          };

          if (gradeClasses.length === 0) return null;

          return (
            <div key={grade} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-primary">Khối {grade}</h3>
                <Badge variant="secondary" className="text-xs">
                  {gradeClasses.length} lớp
                </Badge>
              </div>
              <div className="rounded-lg border shadow-sm overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-0">
                        <TableHead className="bg-gradient-to-b from-primary/20 to-primary/30 dark:from-primary/30 dark:to-primary/40 min-w-[70px] text-center font-bold text-primary shadow-sm">
                          <div className="py-1">STT</div>
                        </TableHead>
                        <TableHead className="bg-gradient-to-b from-primary/20 to-primary/30 dark:from-primary/30 dark:to-primary/40 min-w-[180px] font-bold text-primary shadow-sm">
                          <div className="py-1">Môn học</div>
                        </TableHead>
                        {gradeClasses.map(cls => (
                          <TableHead 
                            key={cls._id} 
                            className="min-w-[160px] font-bold text-center bg-gradient-to-b from-primary/20 to-primary/30 dark:from-primary/30 dark:to-primary/40 text-primary dark:text-primary shadow-sm"
                          >
                            <div className="py-1">
                              {cls.className}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gradeSubjects.length > 0 ? (
                        gradeSubjects.map((subject, index) => {
                          return (
                            <TableRow 
                              key={subject._id}
                              className="hover:bg-muted/30 transition-colors border-0"
                            >
                              <TableCell className="bg-primary/10 dark:bg-primary/20 text-center font-semibold text-primary">
                                <span className="text-base">{index + 1}</span>
                              </TableCell>
                              <TableCell className="bg-primary/10 dark:bg-primary/20">
                                <span className="font-semibold text-sm">{subject.name}</span>
                              </TableCell>
                              {gradeClasses.map(cls => {
                                const cellAssignment = getAssignment(subject._id!, cls._id);
                                const hasTeacher = !!cellAssignment?.teacherId?._id;
                                
                                return (
                                  <TableCell 
                                    key={cls._id}
                                    className={`${hasTeacher ? "bg-primary/5" : "bg-orange-50/50 dark:bg-orange-900/10"} transition-colors`}
                                  >
                                    {cellAssignment?.teacherId ? (
                                      <div className="text-sm">
                                        {typeof cellAssignment.teacherId === "object" && cellAssignment.teacherId !== null
                                          ? cellAssignment.teacherId.name
                                          : "N/A"}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">Chưa phân công</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={gradeClasses.length + 2} className="text-center text-muted-foreground py-8">
                            Không có môn học nào trong tổ bộ môn cho khối {grade}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Xem Phân công Giảng dạy</h1>
          <p className="text-muted-foreground">
            Xem phân công giảng dạy cho các môn học trong tổ bộ môn
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Chọn năm học" />
            </SelectTrigger>
            <SelectContent>
              {schoolYears
                .filter((year) => year.code && year.code.trim() !== "")
                .map((year) => (
                  <SelectItem key={year.code} value={year.code}>
                    {year.name} {year.isCurrent && "(Hiện tại)"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={filterSemester} onValueChange={(v) => setFilterSemester(v as "1" | "2")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Học kỳ 1</SelectItem>
              <SelectItem value="2">Học kỳ 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ✅ Card tình trạng số tiết giáo viên */}
      {filterYear && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Tình trạng số tiết giáo viên</CardTitle>
              <p className="text-sm text-muted-foreground">
                Năm {filterYear} • Học kỳ {filterSemester}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={teacherLoadSummary.overloaded > 0 ? "destructive" : "secondary"}>
                Quá tải: {teacherLoadSummary.overloaded}/{teacherLoadSummary.total}
              </Badge>
              <Badge variant="outline">
                Còn tiết: {teacherLoadSummary.available}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowTeacherLoadCard((prev) => !prev)}
              >
                {showTeacherLoadCard ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          {showTeacherLoadCard && (
            <CardContent>
              {teacherLoadLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : teacherLoadList.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Chưa có dữ liệu số tiết giáo viên
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                    {teacherLoadList
                      .sort((a, b) => b.current - a.current)
                      .map((teacher) => (
                        <div
                          key={teacher.id}
                          className={`p-3 rounded-lg border ${
                            teacher.isOver
                              ? "border-destructive/50 bg-destructive/5"
                              : teacher.remaining <= 3
                              ? "border-orange-300 bg-orange-50"
                              : "border-muted-foreground/20 bg-card"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm">{teacher.name}</p>
                            <Badge
                              variant={teacher.isOver ? "destructive" : "secondary"}
                              className="text-[11px]"
                            >
                              {teacher.current}/{teacher.effective} tiết
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{teacher.mainSubject}</p>
                          <p
                            className={`text-xs font-medium mt-1 ${
                              teacher.isOver
                                ? "text-destructive"
                                : teacher.remaining <= 3
                                ? "text-orange-600"
                                : "text-green-600"
                            }`}
                          >
                            {teacher.isOver
                              ? `Vượt ${teacher.current - teacher.effective} tiết`
                              : `Còn ${teacher.remaining} tiết`}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <Card>
          <CardHeader>
            <CardTitle>Danh sách phân công ({assignments.length})</CardTitle>
            <p className="text-sm text-muted-foreground">
              Năm học: {filterYear || "Chưa chọn"} (Năm học hiện tại: {currentYear || "N/A"}) | Học kỳ: {filterSemester === "1" ? "Học kỳ 1" : "Học kỳ 2"}
            </p>
          </CardHeader>
          <CardContent>
            {isDepartmentHead ? (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "self" | "department")} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="self">Bản thân</TabsTrigger>
                  <TabsTrigger value="department">Thành viên trong tổ</TabsTrigger>
                </TabsList>
                
                <TabsContent value="self" className="mt-0">
                  {renderAssignmentTables()}
                </TabsContent>
                
                <TabsContent value="department" className="mt-0">
                  {renderAssignmentTables()}
                </TabsContent>
              </Tabs>
            ) : (
              // Giáo viên chủ nhiệm và giáo viên bộ môn chỉ xem tab "Bản thân"
              <div>
                {renderAssignmentTables()}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
