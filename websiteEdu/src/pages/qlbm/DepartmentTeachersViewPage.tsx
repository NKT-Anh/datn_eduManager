import { useEffect, useState, useMemo } from "react";
import { Teacher } from "@/types/auth";
import { Subject } from "@/types/class";
import { useTeachers } from "@/hooks/teachers/useTeachers";
import { useSubjects } from "@/hooks/subjects/useSubjects";
import { useClasses } from "@/hooks/classes/useClasses";
import { useDepartments } from "@/hooks/departments/useDepartments";
import { useSchoolYears } from "@/hooks/schoolYear/useSchoolYears";
import { useAssignments } from "@/hooks/assignments/useAssignments";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Users, Eye, BookOpen, UserCheck, Loader2, Mail, Phone, GraduationCap } from "lucide-react";
import { TeacherDetailDialog } from "@/components/dialogs/TeacherDetailDialog";
import { getTeacherDepartmentId, getTeacherDepartmentName } from '@/utils/teacher';

export default function DepartmentTeachersViewPage() {
  const { backendUser } = useAuth();
  const { teachers, isLoading: loading } = useTeachers();
  const { subjects } = useSubjects();
  const { classes } = useClasses();
  const { departments } = useDepartments();
  const { schoolYears, currentYear, isLoading: isLoadingYears } = useSchoolYears();
  const { assignments } = useAssignments();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<"1" | "2">("1");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [viewingTeacher, setViewingTeacher] = useState<Teacher | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Lấy năm học hiện tại từ API
  useEffect(() => {
    if (currentYear && !selectedYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, selectedYear]);

  // Lọc giáo viên trong cùng tổ với GVBM
  const filteredTeachers = useMemo(() => {
    let filtered: Teacher[] = [];

    // Lấy department của GVBM
    const myDepartmentId = backendUser?.department;
    if (myDepartmentId) {
      filtered = teachers.filter((t) => {
        const deptId = getTeacherDepartmentId(t, selectedYear || currentYear);
        return deptId === myDepartmentId;
      });
    } else {
      // Nếu không có departmentId, lọc theo department từ teacher
      const myTeacher = teachers.find(
        (t) => t._id === (backendUser?.teacherId || backendUser?._id)
      );
      if (myTeacher) {
        const myDeptId = getTeacherDepartmentId(myTeacher, selectedYear || currentYear);
        if (myDeptId) {
          filtered = teachers.filter((t) => {
            const deptId = getTeacherDepartmentId(t, selectedYear || currentYear);
            return deptId === myDeptId;
          });
        }
      }
    }

    // Lọc theo tìm kiếm
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name?.toLowerCase().includes(lower) ||
          t.teacherCode?.toLowerCase().includes(lower) ||
          t.phone?.toLowerCase().includes(lower) ||
          t.accountId?.email?.toLowerCase().includes(lower)
      );
    }

    // Lọc theo môn học
    if (filterSubject !== "all") {
      filtered = filtered.filter((t) => {
        return t.subjects?.some((sub) => {
          const subjectId = typeof sub.subjectId === "string"
            ? sub.subjectId
            : (sub.subjectId && typeof sub.subjectId === "object" ? sub.subjectId._id : null) || sub.subjectId;
          return subjectId === filterSubject;
        });
      });
    }

    return filtered;
  }, [teachers, searchTerm, filterSubject, backendUser]);

  // Helper functions
  const getSubjectNames = (teacher: Teacher): string => {
    if (!teacher.subjects || teacher.subjects.length === 0) return "-";
    return teacher.subjects
      .map((sub) => {
        const subjectId = typeof sub.subjectId === "string"
          ? sub.subjectId
          : (sub.subjectId && typeof sub.subjectId === "object" ? sub.subjectId._id : null) || sub.subjectId;
        const subject = subjects.find((s) => s._id === subjectId);
        return subject?.name || "";
      })
      .filter(Boolean)
      .join(", ");
  };

  const getClassNames = (teacher: Teacher): string => {
    if (!teacher.classIds || teacher.classIds.length === 0) return "-";
    return teacher.classIds
      .map((clsId) => {
        const classId = typeof clsId === "string" ? clsId : clsId._id;
        const cls = classes.find((c) => c._id === classId);
        return cls?.className || "";
      })
      .filter(Boolean)
      .join(", ");
  };

  const getDepartmentName = (teacher: Teacher): string => {
    return getTeacherDepartmentName(teacher, departments, selectedYear || currentYear);
  };

  if (!backendUser || backendUser.role !== "teacher") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Bạn không có quyền truy cập trang này</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Danh sách Giáo viên trong Tổ</h1>
          <p className="text-muted-foreground">
            Xem thông tin giáo viên trong cùng tổ bộ môn
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm theo tên, mã giáo viên, email, SĐT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-[180px]">
              <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isLoadingYears}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingYears ? "Đang tải..." : "Chọn năm học"} />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.length > 0 ? (
                    schoolYears
                      .filter((year) => year.name && year.name.trim() !== "")
                      .map((year) => (
                        <SelectItem key={year._id} value={year.name}>
                          {year.name} {year.isActive && "(Hiện tại)"}
                        </SelectItem>
                      ))
                  ) : (
                    <SelectItem value="" disabled>Chưa có năm học</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Lọc theo môn học" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả môn</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject._id} value={subject._id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tổng số: {filteredTeachers.length} giáo viên</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã GV</TableHead>
                  <TableHead>Họ và tên</TableHead>
                  <TableHead>Tổ bộ môn</TableHead>
                  <TableHead>Môn dạy</TableHead>
                  <TableHead>Lớp phụ trách</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Không tìm thấy giáo viên nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeachers.map((teacher) => {
                    const isHead = teacher.isDepartmentHead;
                    const isHomeroom = teacher.isHomeroom;

                    return (
                      <TableRow key={teacher._id}>
                        <TableCell className="font-mono">{teacher.teacherCode || "-"}</TableCell>
                        <TableCell className="font-medium">{teacher.name || "-"}</TableCell>
                        <TableCell>{getDepartmentName(teacher)}</TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {teacher.subjects?.slice(0, 2).map((sub, idx) => {
                                const subjectId = typeof sub.subjectId === "string"
                                  ? sub.subjectId
                                  : (sub.subjectId && typeof sub.subjectId === "object" ? sub.subjectId._id : null) || sub.subjectId;
                                const subject = subjects.find((s) => s._id === subjectId);
                                return (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {subject?.name || "N/A"}
                                  </Badge>
                                );
                              })}
                              {teacher.subjects && teacher.subjects.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{teacher.subjects.length - 2}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            {teacher.classIds && teacher.classIds.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {teacher.classIds.slice(0, 2).map((clsId, idx) => {
                                  const classId = typeof clsId === "string" ? clsId : clsId._id;
                                  const cls = classes.find((c) => c._id === classId);
                                  return (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {cls?.className || "N/A"}
                                    </Badge>
                                  );
                                })}
                                {teacher.classIds.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{teacher.classIds.length - 2}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {isHead && (
                              <Badge variant="default" className="text-xs">
                                <UserCheck className="h-3 w-3 mr-1" />
                                Tổ trưởng
                              </Badge>
                            )}
                            {isHomeroom && (
                              <Badge variant="secondary" className="text-xs">
                                <GraduationCap className="h-3 w-3 mr-1" />
                                GVCN
                              </Badge>
                            )}
                            {!isHead && !isHomeroom && (
                              <Badge variant="outline" className="text-xs">
                                Giáo viên
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setViewingTeacher(teacher);
                              setIsViewDialogOpen(true);
                            }}
                            className="h-8 px-2 text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Xem chi tiết
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Teacher Detail Dialog - Sử dụng component đầy đủ như admin */}
      {viewingTeacher && (
        <TeacherDetailDialog
          teacher={viewingTeacher}
          open={isViewDialogOpen}
          onOpenChange={setIsViewDialogOpen}
          assignments={assignments}
          subjects={subjects}
          classes={classes}
          currentYear={selectedYear || currentYear || undefined}
          semester={selectedSemester}
        />
      )}
    </div>
  );
}

