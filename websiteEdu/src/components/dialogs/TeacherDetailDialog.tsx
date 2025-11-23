import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Teacher } from "@/types/auth";
import { TeachingAssignment, Subject, ClassType } from "@/types/class";
import {
  User,
  Phone,
  Calendar,
  BookOpen,
  GraduationCap,
  Briefcase,
  Award,
  FileText,
  Users,
  Home,
  Clock,
  CheckCircle2,
  XCircle,
  Shield,
} from "lucide-react";
import { useMemo } from "react";

interface TeacherDetailDialogProps {
  teacher: Teacher | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments?: TeachingAssignment[];
  subjects?: Subject[];
  classes?: ClassType[];
  currentYear?: string;
  semester?: string;
}

export function TeacherDetailDialog({
  teacher,
  open,
  onOpenChange,
  assignments = [],
  subjects = [],
  classes = [],
  currentYear,
  semester = "1",
}: TeacherDetailDialogProps) {
  if (!teacher) return null;

  // ✅ Tính số tiết đã phân công từ TeachingAssignment
  const assignedPeriodsInfo = useMemo(() => {
    if (!teacher._id || !assignments.length) {
      return { totalPeriods: 0, assignmentsByGrade: {}, classesByGrade: {} };
    }

    // Lọc assignments của giáo viên này cho năm học và học kỳ hiện tại
    const teacherAssignments = assignments.filter(
      (a) =>
        a.teacherId?._id === teacher._id &&
        (!currentYear || a.year === currentYear) &&
        a.semester === semester
    );

    let totalPeriods = 0;
    const assignmentsByGrade: Record<string, number> = { "10": 0, "11": 0, "12": 0 };
    const classesByGrade: Record<string, Set<string>> = {
      "10": new Set(),
      "11": new Set(),
      "12": new Set(),
    };

    // Helper để lấy số tiết/tuần của môn học
    const getSubjectPeriods = (subjectId: string, grade: string): number => {
      const subject = subjects.find((s) => s._id === subjectId);
      if (!subject) return 2; // Default

      const subjectName = subject.name.toLowerCase();
      const periodsMap: Record<string, number> = {
        toán: 4,
        "ngữ văn": 4,
        văn: 4,
        "tiếng anh": 3,
        anh: 3,
        "vật lý": 2,
        "hóa học": 2,
        hóa: 2,
        "sinh học": 2,
        sinh: 2,
        "lịch sử": 2,
        "địa lý": 2,
        địa: 2,
        "giáo dục công dân": 1,
        gdcd: 1,
        "thể dục": 2,
        "công nghệ": 1,
        "tin học": 1,
        tin: 1,
      };

      for (const [key, periods] of Object.entries(periodsMap)) {
        if (subjectName.includes(key)) return periods;
      }
      return 2; // Default
    };

    teacherAssignments.forEach((assignment) => {
      const classGrade = assignment.classId?.grade || "10";
      const subjectId = assignment.subjectId?._id || "";
      const periods = getSubjectPeriods(subjectId, classGrade);
      
      totalPeriods += periods;
      assignmentsByGrade[classGrade] = (assignmentsByGrade[classGrade] || 0) + periods;
      classesByGrade[classGrade].add(assignment.classId?._id || "");
    });

    return {
      totalPeriods,
      assignmentsByGrade,
      classesByGrade: {
        "10": Array.from(classesByGrade["10"]),
        "11": Array.from(classesByGrade["11"]),
        "12": Array.from(classesByGrade["12"]),
      },
      assignmentCount: teacherAssignments.length,
    };
  }, [teacher._id, assignments, subjects, currentYear, semester]);

  const InfoItem = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: any;
    label: string;
    value?: string | number;
  }) => (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-1 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value || "Chưa cập nhật"}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Thông tin giáo viên</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Thông tin cơ bản */}
          <div className="flex gap-6">
            {teacher.avatarUrl && (
              <img
                src={teacher.avatarUrl}
                alt={teacher.name}
                className="w-32 h-32 object-cover rounded-lg border"
              />
            )}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <InfoItem icon={User} label="Họ và tên" value={teacher.name} />
              <InfoItem
                icon={FileText}
                label="Mã giáo viên"
                value={teacher.teacherCode}
              />
              <InfoItem icon={Phone} label="Số điện thoại" value={teacher.phone} />
              <InfoItem icon={Calendar} label="Ngày sinh" value={teacher.dob} />
              <InfoItem
                icon={User}
                label="Giới tính"
                value={
                  teacher.gender === "male"
                    ? "Nam"
                    : teacher.gender === "female"
                    ? "Nữ"
                    : "Khác"
                }
              />
              <InfoItem
                icon={FileText}
                label="Trạng thái"
                value={teacher.status === "active" ? "Đang làm việc" : "Nghỉ việc"}
              />
              {teacher.departmentId && (
                <InfoItem
                  icon={Users}
                  label="Tổ bộ môn"
                  value={
                    typeof teacher.departmentId === "object" && teacher.departmentId !== null
                      ? teacher.departmentId.name
                      : "Chưa có"
                  }
                />
              )}
            </div>
          </div>

          {/* Quyền / Chức vụ */}
          {(teacher.isHomeroom || teacher.isDepartmentHead || teacher.isLeader) && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Quyền / Chức vụ
                </h3>
                <div className="flex flex-wrap gap-2">
                  {teacher.isLeader && (
                    <Badge variant="default" className="text-base px-3 py-1">
                      <Shield className="h-3 w-3 mr-1" />
                      Ban giám hiệu
                    </Badge>
                  )}
                  {teacher.isDepartmentHead && (
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      <Award className="h-3 w-3 mr-1" />
                      Trưởng bộ môn
                    </Badge>
                  )}
                  {teacher.isHomeroom && (
                    <Badge variant="outline" className="text-base px-3 py-1">
                      <Home className="h-3 w-3 mr-1" />
                      Giáo viên chủ nhiệm
                    </Badge>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Môn giảng dạy */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Môn giảng dạy
            </h3>
            <div className="space-y-3">
              {teacher.mainSubject && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Môn chính</p>
                  <Badge variant="default" className="text-base px-3 py-1">
                    {typeof teacher.mainSubject === "object" && teacher.mainSubject !== null
                      ? `${teacher.mainSubject.name}${teacher.mainSubject.code ? ` (${teacher.mainSubject.code})` : ""}`
                      : (() => {
                          const mainSubjectId = typeof teacher.mainSubject === "string" ? teacher.mainSubject : null;
                          if (!mainSubjectId) return "Chưa có";
                          const mainSubj = subjects.find(s => s._id === mainSubjectId);
                          return mainSubj ? `${mainSubj.name}${mainSubj.code ? ` (${mainSubj.code})` : ""}` : "Chưa có";
                        })()}
                  </Badge>
                </div>
              )}
              {teacher.subjects && teacher.subjects.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Các môn giảng dạy
                  </p>
                  <div className="space-y-2">
                    {teacher.subjects.map((subject, index) => {
                      const subjectId = typeof subject.subjectId === "object" && subject.subjectId !== null
                        ? subject.subjectId._id
                        : subject.subjectId;
                      const subjectName = typeof subject.subjectId === "object" && subject.subjectId !== null
                        ? subject.subjectId.name
                        : (() => {
                            const subj = subjects.find(s => s._id === subjectId);
                            return subj?.name || "Chưa có tên";
                          })();
                      const subjectCode = typeof subject.subjectId === "object" && subject.subjectId !== null
                        ? subject.subjectId.code
                        : (() => {
                            const subj = subjects.find(s => s._id === subjectId);
                            return subj?.code || "";
                          })();
                      
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 flex-wrap"
                        >
                          <Badge variant="secondary">
                            {subjectName}{subjectCode ? ` (${subjectCode})` : ""}
                          </Badge>
                          <span className="text-sm text-muted-foreground">-</span>
                          <div className="flex gap-1">
                            {subject.grades && subject.grades.length > 0 ? (
                              subject.grades.map((grade) => (
                                <Badge key={grade} variant="outline" className="text-xs">
                                  Khối {grade}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">Chưa có khối</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Lớp phụ trách */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lớp phụ trách
            </h3>
            <div className="space-y-3">
              {/* Lớp chủ nhiệm - chỉ hiển thị lớp của năm học hiện tại */}
              {(() => {
                const currentHomeroomClass = teacher.currentHomeroomClassId
                  ? (typeof teacher.currentHomeroomClassId === "object"
                      ? teacher.currentHomeroomClassId
                      : classes.find((c) => c._id === teacher.currentHomeroomClassId))
                  : null;
                
                // ✅ Chỉ hiển thị nếu lớp thuộc năm học hiện tại
                if (!currentHomeroomClass) return null;
                
                const classYear = typeof currentHomeroomClass === "object"
                  ? currentHomeroomClass.year
                  : (() => {
                      const cls = classes.find((c) => c._id === currentHomeroomClass);
                      return cls?.year;
                    })();
                
                // Chỉ hiển thị nếu thuộc năm học hiện tại
                if (currentYear && classYear && classYear !== currentYear) return null;
                
                const className = typeof currentHomeroomClass === "object"
                  ? currentHomeroomClass.className
                  : (() => {
                      const cls = classes.find((c) => c._id === currentHomeroomClass);
                      return cls?.className || "-";
                    })();
                const grade = typeof currentHomeroomClass === "object"
                  ? currentHomeroomClass.grade
                  : (() => {
                      const cls = classes.find((c) => c._id === currentHomeroomClass);
                      return cls?.grade || "-";
                    })();
                const year = classYear || currentYear;
                
                return (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Lớp chủ nhiệm {currentYear ? `(${currentYear})` : ""}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default" className="flex items-center gap-1">
                        <Home className="h-3 w-3" />
                        {year ? `${year} - ` : ""}{className} (Khối {grade})
                      </Badge>
                    </div>
                  </div>
                );
              })()}
              
              {/* Khối/lớp đang dạy từ TeachingAssignment */}
              {assignedPeriodsInfo.assignmentCount > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Khối/lớp đang dạy ({currentYear || "Năm học hiện tại"}, Học kỳ {semester})</p>
                  <div className="space-y-2">
                    {(["10", "11", "12"] as const).map((grade) => {
                      const classIds = assignedPeriodsInfo.classesByGrade[grade] || [];
                      if (classIds.length === 0) return null;
                      
                      const classNames = classIds
                        .map((id) => {
                          const cls = classes.find((c) => c._id === id);
                          return cls?.className;
                        })
                        .filter(Boolean);
                      
                      return (
                        <div key={grade} className="flex items-center gap-2">
                          <Badge variant="outline">Khối {grade}</Badge>
                          <span className="text-sm text-muted-foreground">
                            ({classNames.length} lớp: {classNames.join(", ")})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Thông tin công tác */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Thông tin công tác
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon={Award} label="Chức vụ" value={teacher.position} />
              <InfoItem icon={Calendar} label="Năm về trường" value={teacher.hireYear} />
              <InfoItem
                icon={Calendar}
                label="Năm vào ngành"
                value={teacher.hireYearInField}
              />
              <InfoItem icon={BookOpen} label="Giới hạn tối đa số tiết/tuần (Cap Limit)" value={teacher.weeklyLessons || 17} />
              {teacher.optionalWeeklyLessons !== undefined && teacher.optionalWeeklyLessons > 0 && (
                <InfoItem 
                  icon={BookOpen} 
                  label="Số tiết tự chọn bổ sung" 
                  value={`+${teacher.optionalWeeklyLessons} tiết`} 
                />
              )}
              {teacher.effectiveWeeklyLessons !== undefined && (
                <InfoItem 
                  icon={BookOpen} 
                  label="Tổng số tiết thực tế/tuần" 
                  value={`${teacher.effectiveWeeklyLessons} tiết`} 
                />
              )}
              <InfoItem icon={Users} label="Số lớp tối đa" value={teacher.maxClasses} />
            </div>
            
            {/* Số lớp tối đa theo khối */}
            {teacher.maxClassPerGrade && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">Số lớp tối đa theo khối</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["10", "11", "12"] as const).map((grade) => {
                    const maxClasses = typeof teacher.maxClassPerGrade === "object" && teacher.maxClassPerGrade !== null
                      ? (teacher.maxClassPerGrade instanceof Map
                          ? teacher.maxClassPerGrade.get(grade)
                          : teacher.maxClassPerGrade[grade])
                      : undefined;
                    return (
                      <div key={grade} className="flex items-center gap-2">
                        <Badge variant="outline">Khối {grade}</Badge>
                        <span className="font-medium">{maxClasses ?? 2} lớp</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Thông tin chuyên môn */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Thông tin chuyên môn
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem
                icon={Award}
                label="Bằng cấp/Trình độ"
                value={teacher.qualification}
              />
              <InfoItem
                icon={BookOpen}
                label="Chuyên ngành"
                value={teacher.specialization}
              />
              <InfoItem
                icon={Calendar}
                label="Thâm niên công tác"
                value={teacher.teachingExperience ? `${teacher.teachingExperience} năm` : undefined}
              />
            </div>
            {teacher.certifications && teacher.certifications.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Chứng chỉ/Khóa đào tạo
                </p>
                <div className="flex flex-wrap gap-2">
                  {teacher.certifications && typeof teacher.certifications === "string" && (
                  <div className="flex flex-wrap gap-2">
                    {teacher.certifications.split(",").map((cert, index) => (
                      <Badge key={index} variant="secondary">
                        {cert.trim()}
                      </Badge>
                    ))}
                  </div>
                )}

                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Lịch dạy / Khả năng phân công */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Lịch dạy / Khả năng phân công
            </h3>
            <div className="space-y-4">
              {/* Số tiết đã phân công */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Số tiết đã phân công ({currentYear || "Năm học hiện tại"}, Học kỳ {semester})
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-primary">
                        {assignedPeriodsInfo.totalPeriods}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        / {teacher.effectiveWeeklyLessons || 17} tiết
                      </span>
                    </div>
                    {assignedPeriodsInfo.totalPeriods > (teacher.effectiveWeeklyLessons || 17) ? (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Vượt quá giới hạn
                      </Badge>
                    ) : (
                      <Badge variant="default">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Trong giới hạn
                      </Badge>
                    )}
                  </div>
                  
                  {/* Phân bổ theo khối */}
                  {assignedPeriodsInfo.totalPeriods > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {(["10", "11", "12"] as const).map((grade) => {
                        const periods = assignedPeriodsInfo.assignmentsByGrade[grade] || 0;
                        if (periods === 0) return null;
                        return (
                          <div key={grade} className="text-sm">
                            <span className="text-muted-foreground">Khối {grade}:</span>{" "}
                            <span className="font-medium">{periods} tiết</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Ma trận lịch trống */}
              {teacher.availableMatrix && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Ma trận lịch trống</p>
                  <div className="border rounded-lg p-2 overflow-x-auto">
                    <table className="text-xs">
                      <thead>
                        <tr>
                          <th className="px-2 py-1 text-left">Thứ</th>
                          {Array.from({ length: 10 }, (_, i) => (
                            <th key={i} className="px-1 py-1 text-center w-8">
                              T{i + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"].map(
                          (day, dayIndex) => (
                            <tr key={dayIndex}>
                              <td className="px-2 py-1 font-medium">{day}</td>
                              {Array.from({ length: 10 }, (_, periodIndex) => {
                                const isAvailable =
                                  teacher.availableMatrix?.[dayIndex]?.[periodIndex] ?? true;
                                return (
                                  <td
                                    key={periodIndex}
                                    className={`px-1 py-1 text-center border ${
                                      isAvailable
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {isAvailable ? "✓" : "✗"}
                                  </td>
                                );
                              })}
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ✓ = Trống, ✗ = Bận
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Ghi chú */}
          {teacher.notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Ghi chú
                </h3>
                <p className="text-sm text-muted-foreground">{teacher.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
