import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSchoolYears } from "@/hooks";
import { classApi } from "@/services/classApi";
import { classPeriodsApi } from "@/services/classPeriodsApi";
import { useSubjects, useActivities } from "@/hooks";
import { BookOpen, Save, Activity as ActivityIcon, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import type { ClassType } from "@/types/class";

const GRADES = ["10", "11", "12"] as const;
type Grade = typeof GRADES[number];

interface ClassPeriodsTableProps {
  onSave?: () => void;
  year?: string;
  semester?: string;
}

export const ClassPeriodsTable: React.FC<ClassPeriodsTableProps> = ({ onSave, year, semester }) => {
  const { control, setValue, watch } = useFormContext<any>();
  const { schoolYears } = useSchoolYears();
  const { subjects } = useSubjects();
  const { activities } = useActivities();
  
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [loading, setLoading] = useState(false);
  const currentYear = year || "";
  
  // ✅ Lấy các lớp theo năm học
  useEffect(() => {
    const fetchClasses = async () => {
      if (!currentYear) return;
      try {
        setLoading(true);
        const classesData = await classApi.getByYear(currentYear);
        setClasses(classesData || []);
      } catch (err: any) {
        console.error("Lỗi tải danh sách lớp:", err);
        toast.error("Không thể tải danh sách lớp");
        setClasses([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchClasses();
  }, [currentYear]);

  // ✅ Load dữ liệu phân bổ số tiết từ API ClassPeriods
  useEffect(() => {
    const loadClassPeriods = async () => {
      if (!year || !semester) return;
      
      try {
        setLoading(true);
        // ✅ Lấy tất cả phân bổ số tiết cho năm học và học kỳ này
        const classPeriodsData = await classPeriodsApi.getClassPeriods({
          year,
          semester,
        });
        
        // ✅ Merge dữ liệu vào form
        for (const cp of classPeriodsData) {
          const grade = cp.grade as Grade;
          if (!cp.classId) continue;
          const classId = typeof cp.classId === 'object' && cp.classId !== null 
            ? (cp.classId as any)._id 
            : String(cp.classId);
          
          // ✅ Merge subjectPeriods
          if (cp.subjectPeriods) {
            Object.entries(cp.subjectPeriods).forEach(([subjectId, periods]) => {
              const path = `gradeConfigs.${grade}.subjects.${subjectId}.classPeriods.${classId}`;
              setValue(path, periods, { shouldDirty: false });
            });
          }
          
          // ✅ Merge activityPeriods
          if (cp.activityPeriods) {
            Object.entries(cp.activityPeriods).forEach(([activityId, periods]) => {
              // Tìm activity trong gradeConfigs
              const activitiesPath = `gradeConfigs.${grade}.activities`;
              const activities = watch(activitiesPath) || [];
              const activityIndex = activities.findIndex(
                (act: any) => act?.activityId && String(act.activityId) === String(activityId)
              );
              
              if (activityIndex !== -1) {
                const path = `gradeConfigs.${grade}.activities.${activityIndex}.classPeriods.${classId}`;
                setValue(path, periods, { shouldDirty: false });
              }
            });
          }
        }
      } catch (err: any) {
        console.error("Lỗi tải phân bổ số tiết:", err);
        // Không hiển thị toast vì có thể chưa có dữ liệu
      } finally {
        setLoading(false);
      }
    };
    
    loadClassPeriods();
  }, [year, semester, setValue, watch]);
  
  // ✅ Nhóm lớp theo khối
  const classesByGrade = useMemo(() => {
    const grouped: Record<Grade, ClassType[]> = {
      "10": [],
      "11": [],
      "12": [],
    };
    
    classes.forEach((cls) => {
      const grade = cls.grade as Grade;
      if (GRADES.includes(grade)) {
        grouped[grade].push(cls);
      }
    });
    
    // Sắp xếp lớp theo tên
    GRADES.forEach((grade) => {
      grouped[grade].sort((a, b) => a.className.localeCompare(b.className));
    });
    
    return grouped;
  }, [classes]);
  
  // ✅ Lấy số tiết cho môn học ở lớp cụ thể
  const getPeriodsForClass = (grade: Grade, subjectId: string, classId: string): number => {
    const path = `gradeConfigs.${grade}.subjects.${subjectId}.classPeriods.${classId}`;
    const value = watch(path);
    return typeof value === 'number' ? value : 0;
  };
  
  // ✅ Lấy số tiết cho hoạt động ở lớp cụ thể
  const getPeriodsForActivityClass = (grade: Grade, activityId: string, classId: string): number => {
    const path = `gradeConfigs.${grade}.activities`;
    const activities = watch(path) || [];
    const activity = activities.find((act: any) => String(act.activityId) === String(activityId));
    if (!activity) return 0;
    const classPeriodsPath = `gradeConfigs.${grade}.activities.${activities.indexOf(activity)}.classPeriods.${classId}`;
    const value = watch(classPeriodsPath);
    return typeof value === 'number' ? value : 0;
  };
  
  // ✅ Cập nhật số tiết cho môn học ở lớp cụ thể
  const updatePeriodsForClass = (grade: Grade, subjectId: string, classId: string, periods: number) => {
    const path = `gradeConfigs.${grade}.subjects.${subjectId}.classPeriods.${classId}`;
    setValue(path, Math.max(0, periods), { shouldDirty: true });
  };
  
  // ✅ Cập nhật số tiết cho hoạt động ở lớp cụ thể
  const updatePeriodsForActivityClass = (grade: Grade, activityId: string, classId: string, periods: number) => {
    const path = `gradeConfigs.${grade}.activities`;
    const activities = watch(path) || [];
    const activityIndex = activities.findIndex((act: any) => String(act.activityId) === String(activityId));
    if (activityIndex === -1) return;
    const classPeriodsPath = `gradeConfigs.${grade}.activities.${activityIndex}.classPeriods.${classId}`;
    setValue(classPeriodsPath, Math.max(0, periods), { shouldDirty: true });
  };
  
  // ✅ Lấy số tiết mặc định cho khối (từ gradeConfigs) - Môn học
  const getDefaultPeriodsForGrade = (grade: Grade, subjectId: string): number => {
    const path = `gradeConfigs.${grade}.subjects.${subjectId}.periodsPerWeek`;
    const value = watch(path);
    return typeof value === 'number' ? value : 0;
  };
  
  // ✅ Lấy số tiết mặc định cho khối (từ gradeConfigs) - Hoạt động
  const getDefaultPeriodsForActivityGrade = (grade: Grade, activityId: string): number => {
    const path = `gradeConfigs.${grade}.activities`;
    const activities = watch(path) || [];
    const activity = activities.find((act: any) => String(act.activityId) === String(activityId));
    if (!activity) return 0;
    return typeof activity.periodsPerWeek === 'number' ? activity.periodsPerWeek : 0;
  };
  
  // ✅ Áp dụng số tiết mặc định cho tất cả lớp trong khối - Môn học
  const applyDefaultToAllClasses = (grade: Grade, subjectId: string) => {
    const defaultPeriods = getDefaultPeriodsForGrade(grade, subjectId);
    classesByGrade[grade].forEach((cls) => {
      updatePeriodsForClass(grade, subjectId, cls._id, defaultPeriods);
    });
    toast.success(`Đã áp dụng ${defaultPeriods} tiết/tuần cho tất cả lớp khối ${grade} - Môn học`);
  };
  
  // ✅ Áp dụng số tiết mặc định cho tất cả lớp trong khối - Hoạt động
  const applyDefaultToAllClassesForActivity = (grade: Grade, activityId: string) => {
    const defaultPeriods = getDefaultPeriodsForActivityGrade(grade, activityId);
    classesByGrade[grade].forEach((cls) => {
      updatePeriodsForActivityClass(grade, activityId, cls._id, defaultPeriods);
    });
    toast.success(`Đã áp dụng ${defaultPeriods} tiết/tuần cho tất cả lớp khối ${grade} - Hoạt động`);
  };
  
  // ✅ Áp dụng mặc định cho TẤT CẢ môn học và hoạt động trong khối
  const applyDefaultToAllItems = (grade: Grade) => {
    const gradeSubjects = getSubjectsForGrade(grade);
    const gradeActivities = getActivitiesForGrade(grade);
    let count = 0;
    
    // Áp dụng cho môn học
    gradeSubjects.forEach((subject) => {
      const defaultPeriods = getDefaultPeriodsForGrade(grade, subject._id);
      classesByGrade[grade].forEach((cls) => {
        updatePeriodsForClass(grade, subject._id, cls._id, defaultPeriods);
        count++;
      });
    });
    
    // Áp dụng cho hoạt động
    gradeActivities.forEach((activity) => {
      const defaultPeriods = getDefaultPeriodsForActivityGrade(grade, activity._id);
      classesByGrade[grade].forEach((cls) => {
        updatePeriodsForActivityClass(grade, activity._id, cls._id, defaultPeriods);
        count++;
      });
    });
    
    toast.success(`Đã áp dụng mặc định cho tất cả ${gradeSubjects.length} môn học và ${gradeActivities.length} hoạt động (${count} cấu hình) trong khối ${grade}`);
  };
  
  // ✅ Lấy môn học theo khối
  const getSubjectsForGrade = (grade: Grade) => {
    return subjects.filter((s) => {
      // ✅ Chỉ lấy môn học thuộc khối này (kiểm tra subject.grades)
      if (!s.grades || !Array.isArray(s.grades) || !s.grades.includes(grade)) {
        return false;
      }
      // ✅ Lấy từ gradeConfigs để biết môn nào được cấu hình cho khối này
      const subjectData = watch(`gradeConfigs.${grade}.subjects.${s._id}`);
      return subjectData && typeof subjectData.periodsPerWeek === 'number' && subjectData.periodsPerWeek > 0;
    });
  };
  
  // ✅ Lấy hoạt động theo khối
  const getActivitiesForGrade = (grade: Grade) => {
    const gradeActivities = watch(`gradeConfigs.${grade}.activities`) || [];
    return activities.filter((a) => {
      // Kiểm tra xem hoạt động có trong gradeConfigs không
      const activityInConfig = gradeActivities.find(
        (act: any) => act?.activityId && String(act.activityId) === String(a._id)
      );
      return activityInConfig && typeof activityInConfig.periodsPerWeek === 'number' && activityInConfig.periodsPerWeek > 0;
    });
  };

  // ✅ Tính số buổi học chính/phụ tối đa cho khối
  const getMaxSessionsForGrade = useCallback((grade: Grade) => {
    const days = watch("days") || {};
    let totalMorning = 0;
    let totalAfternoon = 0;
    
    // ✅ Xử lý days như object (Record<string, DailyScheduleSchema>)
    if (typeof days === 'object' && !Array.isArray(days)) {
      Object.values(days).forEach((d: any) => {
        totalMorning += d?.morningPeriods || 0;
        totalAfternoon += d?.afternoonPeriods || 0;
      });
    } else if (Array.isArray(days)) {
      // ✅ Fallback: nếu là array (từ ScheduleConfigForm cũ)
      days.forEach((d: any) => {
        totalMorning += d?.morningPeriods || 0;
        totalAfternoon += d?.afternoonPeriods || 0;
      });
    }

    const gradeSessionRules = watch("gradeSessionRules") || [];
    const gradeRule = gradeSessionRules.find((r: any) => r?.grade === grade);
    
    let maxMainSessions = totalMorning + totalAfternoon;
    let maxExtraSessions = 0;

    if (gradeRule?.session) {
      if (gradeRule.session === "morning") {
        maxMainSessions = totalMorning;
        maxExtraSessions = totalAfternoon;
      } else if (gradeRule.session === "afternoon") {
        maxMainSessions = totalAfternoon;
        maxExtraSessions = totalMorning;
      } else if (gradeRule.session === "both") {
        maxMainSessions = totalMorning + totalAfternoon;
        maxExtraSessions = 0;
      }
    }

    return { maxMainSessions, maxExtraSessions };
  }, []);

  // ✅ Tính số tiết chính/phụ cho một lớp cụ thể
  const getClassPeriodStats = useCallback((grade: Grade, classId: string) => {
    const gradeConfig = watch(`gradeConfigs.${grade}`) || {};
    let mainPeriods = 0;
    let extraPeriods = 0;

    // Tính từ môn học
    if (gradeConfig.subjects) {
      Object.entries(gradeConfig.subjects).forEach(([subjectId, subData]: [string, any]) => {
        const classPeriods = subData?.classPeriods || {};
        const periods = typeof classPeriods[classId] === 'number' ? classPeriods[classId] : 0;
        const session = subData?.session || "main";
        if (session === "main") {
          mainPeriods += periods;
        } else if (session === "extra") {
          extraPeriods += periods;
        }
      });
    }

    // Tính từ hoạt động
    if (gradeConfig.activities && Array.isArray(gradeConfig.activities)) {
      gradeConfig.activities.forEach((act: any) => {
        const classPeriods = act?.classPeriods || {};
        const periods = typeof classPeriods[classId] === 'number' ? classPeriods[classId] : 0;
        const session = act?.session || "main";
        if (session === "main") {
          mainPeriods += periods;
        } else if (session === "extra") {
          extraPeriods += periods;
        }
      });
    }

    return { mainPeriods, extraPeriods };
  }, []);
  
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Đang tải danh sách lớp...</div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Phân bổ số tiết theo lớp - Năm học: {year || "..."} {semester && `(Học kỳ ${semester})`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="10" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {GRADES.map((grade) => (
              <TabsTrigger key={grade} value={grade}>
                Khối {grade} ({classesByGrade[grade].length} lớp)
              </TabsTrigger>
            ))}
          </TabsList>
          
          {GRADES.map((grade) => {
            const gradeClasses = classesByGrade[grade];
            const gradeSubjects = getSubjectsForGrade(grade);
            const { maxMainSessions, maxExtraSessions } = getMaxSessionsForGrade(grade);
            
            if (gradeClasses.length === 0) {
              return (
                <TabsContent key={grade} value={grade}>
                  <div className="text-center text-muted-foreground py-8">
                    Không có lớp nào cho khối {grade} trong năm học {year || "..."}
                  </div>
                </TabsContent>
              );
            }
            
            const gradeActivities = getActivitiesForGrade(grade);
            
            if (gradeSubjects.length === 0 && gradeActivities.length === 0) {
              return (
                <TabsContent key={grade} value={grade}>
                  <div className="text-center text-muted-foreground py-8">
                    Chưa có môn học hoặc hoạt động nào được cấu hình cho khối {grade}. Vui lòng cấu hình số tiết/tuần trước.
                  </div>
                </TabsContent>
              );
            }
            
            return (
              <TabsContent key={grade} value={grade} className="mt-4">
                {/* ✅ Nút áp dụng mặc định tất cả */}
                <div className="flex justify-end mb-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => applyDefaultToAllItems(grade)}
                    disabled={gradeSubjects.length === 0 && gradeActivities.length === 0}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Áp dụng mặc định tất cả
                  </Button>
                </div>

                {/* ✅ Cảnh báo cho từng lớp */}
                <div className="mb-4 space-y-2">
                  {gradeClasses.map((cls) => {
                    const { mainPeriods, extraPeriods } = getClassPeriodStats(grade, cls._id);
                    const hasMainWarning = mainPeriods > maxMainSessions;
                    const hasExtraWarning = maxExtraSessions > 0 && extraPeriods > maxExtraSessions;
                    
                    if (!hasMainWarning && !hasExtraWarning) return null;
                    
                    return (
                      <div
                        key={`warning-${cls._id}`}
                        className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 text-sm">
                            <p className="font-medium text-orange-800 dark:text-orange-300">
                              ⚠️ Cảnh báo lớp {cls.className}:
                            </p>
                            {hasMainWarning && (
                              <p className="text-orange-700 dark:text-orange-400 mt-1">
                                • Tiết chính ({mainPeriods}) vượt quá số tiết buổi chính ({maxMainSessions})
                              </p>
                            )}
                            {hasExtraWarning && (
                              <p className="text-orange-700 dark:text-orange-400 mt-1">
                                • Tiết phụ ({extraPeriods}) vượt quá số tiết buổi phụ ({maxExtraSessions})
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px] sticky left-0 bg-background z-10">
                          Môn học / Hoạt động
                        </TableHead>
                        {gradeClasses.map((cls) => (
                          <TableHead key={cls._id} className="min-w-[120px] text-center">
                            {cls.className}
                          </TableHead>
                        ))}
                        <TableHead className="min-w-[150px] text-center">
                          Thao tác
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* ✅ Môn học */}
                      {gradeSubjects.map((subject) => {
                        const defaultPeriods = getDefaultPeriodsForGrade(grade, subject._id);
                        
                        return (
                          <TableRow key={`subject-${subject._id}`}>
                            <TableCell className="font-medium sticky left-0 bg-background z-10">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-blue-600" />
                                {subject.name}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Mặc định: {defaultPeriods} tiết/tuần
                              </div>
                            </TableCell>
                            {gradeClasses.map((cls) => {
                              const periods = getPeriodsForClass(grade, subject._id, cls._id);
                              const isDifferent = periods !== defaultPeriods;
                              const subjectSession = watch(`gradeConfigs.${grade}.subjects.${subject._id}.session`) || "main";
                              const { mainPeriods, extraPeriods } = getClassPeriodStats(grade, cls._id);
                              const { maxMainSessions, maxExtraSessions } = getMaxSessionsForGrade(grade);
                              
                              // Kiểm tra cảnh báo cho lớp này
                              const hasMainWarning = subjectSession === "main" && mainPeriods > maxMainSessions;
                              const hasExtraWarning = subjectSession === "extra" && maxExtraSessions > 0 && extraPeriods > maxExtraSessions;
                              const hasWarning = hasMainWarning || hasExtraWarning;
                              
                              return (
                                <TableCell key={cls._id} className="text-center">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={periods}
                                    onChange={(e) => {
                                      const newValue = parseInt(e.target.value) || 0;
                                      updatePeriodsForClass(grade, subject._id, cls._id, newValue);
                                    }}
                                    className={`w-20 mx-auto text-center ${
                                      hasWarning 
                                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950" 
                                        : isDifferent 
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                                        : ""
                                    }`}
                                  />
                                  {isDifferent && !hasWarning && (
                                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                      Khác mặc định
                                    </div>
                                  )}
                                  {hasWarning && (
                                    <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                      ⚠️ Vượt quá
                                    </div>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyDefaultToAllClasses(grade, subject._id)}
                                disabled={defaultPeriods === 0}
                              >
                                Áp dụng mặc định
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      
                      {/* ✅ Hoạt động */}
                      {gradeActivities.map((activity) => {
                        const defaultPeriods = getDefaultPeriodsForActivityGrade(grade, activity._id);
                        
                        return (
                          <TableRow key={`activity-${activity._id}`}>
                            <TableCell className="font-medium sticky left-0 bg-background z-10">
                              <div className="flex items-center gap-2">
                                <ActivityIcon className="h-4 w-4 text-green-600" />
                                {activity.name}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Mặc định: {defaultPeriods} tiết/tuần
                              </div>
                            </TableCell>
                            {gradeClasses.map((cls) => {
                              const periods = getPeriodsForActivityClass(grade, activity._id, cls._id);
                              const isDifferent = periods !== defaultPeriods;
                              const gradeActivities = watch(`gradeConfigs.${grade}.activities`) || [];
                              const activityInConfig = gradeActivities.find(
                                (act: any) => act?.activityId && String(act.activityId) === String(activity._id)
                              );
                              const activitySession = activityInConfig?.session || "main";
                              const { mainPeriods, extraPeriods } = getClassPeriodStats(grade, cls._id);
                              const { maxMainSessions, maxExtraSessions } = getMaxSessionsForGrade(grade);
                              
                              // Kiểm tra cảnh báo cho lớp này
                              const hasMainWarning = activitySession === "main" && mainPeriods > maxMainSessions;
                              const hasExtraWarning = activitySession === "extra" && maxExtraSessions > 0 && extraPeriods > maxExtraSessions;
                              const hasWarning = hasMainWarning || hasExtraWarning;
                              
                              return (
                                <TableCell key={cls._id} className="text-center">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={periods}
                                    onChange={(e) => {
                                      const newValue = parseInt(e.target.value) || 0;
                                      updatePeriodsForActivityClass(grade, activity._id, cls._id, newValue);
                                    }}
                                    className={`w-20 mx-auto text-center ${
                                      hasWarning 
                                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950" 
                                        : isDifferent 
                                        ? "border-green-500 bg-green-50 dark:bg-green-950" 
                                        : ""
                                    }`}
                                  />
                                  {isDifferent && !hasWarning && (
                                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                      Khác mặc định
                                    </div>
                                  )}
                                  {hasWarning && (
                                    <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                      ⚠️ Vượt quá
                                    </div>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyDefaultToAllClassesForActivity(grade, activity._id)}
                                disabled={defaultPeriods === 0}
                              >
                                Áp dụng mặc định
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    💡 <strong>Hướng dẫn:</strong> Bạn có thể điều chỉnh số tiết/tuần cho từng lớp riêng lẻ. 
                    Số tiết khác với mặc định sẽ được đánh dấu màu xanh (môn học) hoặc màu xanh lá (hoạt động). 
                    Nhấn "Áp dụng mặc định" để đặt lại tất cả lớp về số tiết mặc định của khối cho từng môn/hoạt động.
                    Nhấn "Áp dụng mặc định tất cả" để đặt lại tất cả môn học và hoạt động trong khối.
                  </p>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
};

