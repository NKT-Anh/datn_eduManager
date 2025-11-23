import React, { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, BookOpen, Calendar, Download, Calculator } from "lucide-react";
import { ClassPeriodsTable } from "@/components/forms/scheduleConfig/ClassPeriodsTable";
import { getScheduleConfig } from "@/services/scheduleConfigApi";
import { classPeriodsApi } from "@/services/classPeriodsApi";
import { useSchoolYears } from "@/hooks";
import { ScheduleConfig } from "@/types/schedule";
import { toast } from "@/components/ui/sonner";

export default function ClassPeriodsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configData, setConfigData] = useState<ScheduleConfig | null>(null);
  const { schoolYears } = useSchoolYears();
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("1");
  const [calculateDialogOpen, setCalculateDialogOpen] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [teacherCalculation, setTeacherCalculation] = useState<any>(null);
  const [weeklyLessonsInput, setWeeklyLessonsInput] = useState<string>("17");
  const [homeroomReductionInput, setHomeroomReductionInput] = useState<string>("3");
  const [departmentHeadReductionInput, setDepartmentHeadReductionInput] = useState<string>("3");

  // ✅ Khởi tạo form với default values
  const form = useForm<ScheduleConfig>({
    defaultValues: {
      defaultStartTimeMorning: "07:00",
      defaultStartTimeAfternoon: "13:30",
      minutesPerPeriod: 45,
      defaultBreakMinutes: 5,
      specialBreaks: [],
      days: {},
      gradeConfigs: {
        "10": { subjects: {}, activities: [], rules: null },
        "11": { subjects: {}, activities: [], rules: null },
        "12": { subjects: {}, activities: [], rules: null },
      },
      gradeSessionRules: [],
    },
  });

  // ✅ Set năm học mặc định
  useEffect(() => {
    if (schoolYears.length > 0 && !selectedYear) {
      const activeYear = schoolYears.find((y: any) => y.isActive) || schoolYears[schoolYears.length - 1];
      setSelectedYear(activeYear?.code || "");
    } else if (schoolYears.length === 0 && !selectedYear) {
      // Tính năm học mặc định
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const defaultYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      setSelectedYear(defaultYear);
    }
  }, [schoolYears, selectedYear]);

  // ✅ Load dữ liệu từ API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // ✅ Load scheduleConfig để lấy cấu hình môn học/hoạt động
        const data = await getScheduleConfig();
        setConfigData(data);
        
        // ✅ Set form values từ API
        form.reset({
          ...data,
          // ✅ Đảm bảo gradeConfigs có đầy đủ 3 khối
          gradeConfigs: {
            "10": data.gradeConfigs?.["10"] || { subjects: {}, activities: [], rules: null },
            "11": data.gradeConfigs?.["11"] || { subjects: {}, activities: [], rules: null },
            "12": data.gradeConfigs?.["12"] || { subjects: {}, activities: [], rules: null },
          },
        });
      } catch (err: any) {
        console.error("Lỗi tải cấu hình:", err);
        toast.error("Không thể tải cấu hình thời khóa biểu");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [form]);

  // ✅ Hàm tính số giáo viên
  const handleCalculateTeachers = async () => {
    if (!selectedYear) {
      toast.error("Vui lòng chọn năm học");
      return;
    }

    try {
      setCalculating(true);
      const weeklyLessons = parseInt(weeklyLessonsInput, 10) || 17; // ✅ Mặc định 17 tiết/tuần theo quy tắc THPT
      const homeroomReduction = parseInt(homeroomReductionInput, 10) || 3;
      const departmentHeadReduction = parseInt(departmentHeadReductionInput, 10) || 3;
      const result = await classPeriodsApi.calculateRequiredTeachers({
        year: selectedYear,
        weeklyLessons,
        homeroomReduction,
        departmentHeadReduction,
      });
      setTeacherCalculation(result);
    } catch (err: any) {
      console.error("Lỗi tính số giáo viên:", err);
      toast.error(`Lỗi tính số giáo viên: ${err?.response?.data?.message || err?.message || "Unknown error"}`);
    } finally {
      setCalculating(false);
    }
  };

  // ✅ Hàm xuất Excel
  const handleExportExcel = async () => {
    if (!selectedYear || !selectedSemester) {
      toast.error("Vui lòng chọn năm học và học kỳ");
      return;
    }

    try {
      setSaving(true);
      const blob = await classPeriodsApi.exportToExcel({
        year: selectedYear,
        semester: selectedSemester,
      });

      // ✅ Tạo link download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Phan_bo_so_tiet_${selectedYear}_HK${selectedSemester}_${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Đã xuất file Excel thành công!");
    } catch (err: any) {
      console.error("Lỗi xuất Excel:", err);
      toast.error(`Lỗi xuất Excel: ${err?.response?.data?.message || err?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  // ✅ Hàm lưu - Lưu vào API ClassPeriods
  const handleSave = async () => {
    if (!selectedYear || !selectedSemester) {
      toast.error("Vui lòng chọn năm học và học kỳ");
      return;
    }

    try {
      setSaving(true);
      const values = form.getValues();
      
      // ✅ Lấy dữ liệu từ form và chuyển đổi sang format API ClassPeriods
      const { classApi } = await import("@/services/classApi");
      const classes = await classApi.getByYear(selectedYear);
      
      const results: any[] = [];
      
      // ✅ Xử lý từng khối
      for (const grade of ["10", "11", "12"] as const) {
        const gradeConfig = values.gradeConfigs?.[grade];
        if (!gradeConfig) continue;
        
        const gradeClasses = classes.filter((c: any) => c.grade === grade);
        const classPeriodsList: any[] = [];
        
        for (const cls of gradeClasses) {
          const subjectPeriods: Record<string, number> = {};
          const activityPeriods: Record<string, number> = {};
          
          // ✅ Lấy số tiết từ môn học
          if (gradeConfig.subjects) {
            Object.entries(gradeConfig.subjects).forEach(([subjectId, subData]: [string, any]) => {
              const classPeriods = subData?.classPeriods || {};
              const periods = typeof classPeriods[cls._id] === 'number' ? classPeriods[cls._id] : 0;
              if (periods > 0) {
                subjectPeriods[subjectId] = periods;
              }
            });
          }
          
          // ✅ Lấy số tiết từ hoạt động
          if (Array.isArray(gradeConfig.activities)) {
            gradeConfig.activities.forEach((act: any) => {
              if (!act?.activityId) return;
              const classPeriods = act?.classPeriods || {};
              const periods = typeof classPeriods[cls._id] === 'number' ? classPeriods[cls._id] : 0;
              if (periods > 0) {
                activityPeriods[String(act.activityId)] = periods;
              }
            });
          }
          
          classPeriodsList.push({
            classId: cls._id,
            subjectPeriods,
            activityPeriods,
          });
        }
        
        if (classPeriodsList.length > 0) {
          const result = await classPeriodsApi.bulkUpsertClassPeriods({
            year: selectedYear,
            semester: selectedSemester,
            grade,
            classPeriodsList,
          });
          results.push(result);
        }
      }
      
      toast.success(`Đã lưu phân bổ số tiết cho ${results.length} khối thành công!`);
    } catch (err: any) {
      console.error("Lỗi lưu:", err);
      toast.error(`Lỗi lưu: ${err?.response?.data?.message || err?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Phân bổ số tiết theo lớp</h1>
            <p className="text-muted-foreground mt-1">
              Điều chỉnh số tiết/tuần cho từng môn học và hoạt động theo từng lớp
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={calculateDialogOpen} onOpenChange={setCalculateDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                disabled={!selectedYear} 
                size="lg"
              >
                <Calculator className="mr-2 h-4 w-4" />
                Tính số giáo viên
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tính số giáo viên tự động</DialogTitle>
                <DialogDescription>
                  Tính số giáo viên cần thiết dựa trên phân bổ số tiết của năm học {selectedYear}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Label className="w-48">Số tiết tối đa/tuần mỗi giáo viên:</Label>
                    <Input
                      type="number"
                      value={weeklyLessonsInput}
                      onChange={(e) => setWeeklyLessonsInput(e.target.value)}
                      min="1"
                      max="30"
                      className="w-32"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <Label className="w-48">Số tiết trừ cho GV chủ nhiệm:</Label>
                    <Input
                      type="number"
                      value={homeroomReductionInput}
                      onChange={(e) => setHomeroomReductionInput(e.target.value)}
                      min="0"
                      max="10"
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">
                      (GVCN sẽ dạy {17 - (parseInt(homeroomReductionInput, 10) || 3)} tiết/tuần)
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Label className="w-48">Số tiết trừ cho Tổ trưởng:</Label>
                    <Input
                      type="number"
                      value={departmentHeadReductionInput}
                      onChange={(e) => setDepartmentHeadReductionInput(e.target.value)}
                      min="0"
                      max="10"
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">
                      (Tổ trưởng sẽ dạy {17 - (parseInt(departmentHeadReductionInput, 10) || 3)} tiết/tuần)
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleCalculateTeachers} 
                      disabled={calculating || !selectedYear}
                    >
                      {calculating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Đang tính...
                        </>
                      ) : (
                        "Tính toán"
                      )}
                    </Button>
                  </div>
                </div>

                {teacherCalculation && (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Tổng quan</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Tổng số giáo viên cần</p>
                            <p className="text-2xl font-bold text-primary">
                              {teacherCalculation.totalTeachersNeeded}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">(GV bộ môn)</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Số môn học</p>
                            <p className="text-2xl font-bold">
                              {teacherCalculation.summary.totalSubjects}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Tổng số tiết</p>
                            <p className="text-2xl font-bold">
                              {teacherCalculation.summary.totalPeriods}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">TB giáo viên/môn</p>
                            <p className="text-2xl font-bold">
                              {teacherCalculation.summary.averageTeachersPerSubject}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {teacherCalculation.roles && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Giáo viên theo chức vụ</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="border rounded-lg p-4">
                              <p className="text-sm text-muted-foreground">Giáo viên chủ nhiệm</p>
                              <p className="text-2xl font-bold text-primary">
                                {teacherCalculation.roles.homeroomTeachers.count}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {teacherCalculation.roles.homeroomTeachers.weeklyLessons} tiết/tuần
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {teacherCalculation.roles.homeroomTeachers.note}
                              </p>
                            </div>
                            <div className="border rounded-lg p-4">
                              <p className="text-sm text-muted-foreground">Tổ trưởng</p>
                              <p className="text-2xl font-bold text-primary">
                                {teacherCalculation.roles.departmentHeads.count}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {teacherCalculation.roles.departmentHeads.weeklyLessons} tiết/tuần
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {teacherCalculation.roles.departmentHeads.note}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {teacherCalculation.summary.regulations && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Quy định số tiết chuẩn</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(teacherCalculation.summary.regulations).map(([role, lessons]) => (
                              <div key={role} className="flex justify-between items-center border-b pb-2">
                                <span className="font-medium">{role}:</span>
                                <span className="text-muted-foreground">{String(lessons)}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle>Chi tiết theo môn học</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>STT</TableHead>
                                <TableHead>Môn học</TableHead>
                                <TableHead>Mã môn</TableHead>
                                <TableHead className="text-right">Tiết/lớp/tuần</TableHead>
                                <TableHead className="text-right">Số lớp</TableHead>
                                <TableHead className="text-right">Tổng số tiết</TableHead>
                                <TableHead className="text-right">Max lớp/GV</TableHead>
                                <TableHead className="text-right">GV (theo tiết)</TableHead>
                                <TableHead className="text-right">GV (theo lớp)</TableHead>
                                <TableHead className="text-right font-bold">Số GV cần</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {teacherCalculation.subjects.map((item: any, index: number) => (
                                <TableRow key={item.subjectId}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell className="font-medium">{item.subjectName}</TableCell>
                                  <TableCell>{item.subjectCode || "-"}</TableCell>
                                  <TableCell className="text-right">{item.periodsPerClassPerWeek || "-"}</TableCell>
                                  <TableCell className="text-right">{item.classCount || 0}</TableCell>
                                  <TableCell className="text-right">{item.totalPeriods}</TableCell>
                                  <TableCell className="text-right">
                                    {item.maxClassesPerTeacher > 0 ? item.maxClassesPerTeacher : "-"}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {item.teachersByWeeklyLessons || "-"}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {item.teachersByMaxClasses || "-"}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-primary">
                                    {item.teachersNeeded}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="mt-4 text-xs text-muted-foreground">
                          <p><strong>Lưu ý:</strong> Số GV cần = max(GV theo tiết, GV theo lớp)</p>
                          <p>• GV theo tiết = ceil(Tổng số tiết ÷ 17 tiết/tuần)</p>
                          <p>• GV theo lớp = ceil(Số lớp ÷ Max lớp/GV)</p>
                          <p>• Nếu không cấu hình max lớp riêng theo môn, chỉ dùng weeklyLessons cố định</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            onClick={handleExportExcel} 
            disabled={saving || !selectedYear || !selectedSemester} 
            size="lg"
          >
            <Download className="mr-2 h-4 w-4" />
            Xuất Excel
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedYear || !selectedSemester} size="lg">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              "Lưu phân bổ"
            )}
          </Button>
        </div>
      </div>

      {/* ✅ Select năm học và học kỳ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Chọn năm học và học kỳ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Năm học</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year: any) => (
                    <SelectItem key={year._id} value={year.code}>
                      {year.code} {year.isActive && "(Năm học hiện tại)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Học kỳ</Label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn học kỳ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Học kỳ 1</SelectItem>
                  <SelectItem value="2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bảng phân bổ số tiết</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedYear && selectedSemester ? (
            <FormProvider {...form}>
              <ClassPeriodsTable 
                onSave={handleSave} 
                year={selectedYear}
                semester={selectedSemester}
              />
            </FormProvider>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Vui lòng chọn năm học và học kỳ để xem phân bổ số tiết
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

