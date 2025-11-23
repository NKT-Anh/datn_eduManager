import { useEffect, useState, useMemo } from "react";
import { Department } from "@/types/department";
import { Teacher } from "@/types/auth";
import { Subject } from "@/types/class";
import { useDepartments, useDepartmentTeachers } from "@/hooks";
import { useTeachers } from "@/hooks/teachers/useTeachers";
import { useSubjects } from "@/hooks/subjects/useSubjects";
import { useSchoolYears } from "@/hooks/schoolYear/useSchoolYears";
import { useAuth } from "@/contexts/AuthContext";
import { getTeacherDepartmentId } from "@/utils/teacher";
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
import { Search, Users, Eye, BookOpen, UserCheck, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DepartmentListPage() {
  const { backendUser } = useAuth();
  const { departments, isLoading: loading } = useDepartments();
  const { teachers } = useTeachers();
  const { subjects } = useSubjects();
  const { schoolYears, currentYear } = useSchoolYears();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [filterHeadTeacher, setFilterHeadTeacher] = useState<string>("all"); // "all" | "me" | "others"
  const [viewingDepartment, setViewingDepartment] = useState<Department | null>(null);
  const [viewingTeachers, setViewingTeachers] = useState<Teacher[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Lấy năm học hiện tại
  useEffect(() => {
    if (currentYear && !selectedYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, selectedYear]);

  // Lấy danh sách giáo viên trong tổ khi xem chi tiết
  useEffect(() => {
    if (viewingDepartment?._id) {
      const fetchTeachers = async () => {
        try {
          const { departmentApi } = await import("@/services/departmentApi");
          const deptTeachers = await departmentApi.getTeachers(viewingDepartment._id);
          setViewingTeachers(deptTeachers);
        } catch (error) {
          console.error("Error fetching department teachers:", error);
          setViewingTeachers([]);
        }
      };
      fetchTeachers();
    }
  }, [viewingDepartment]);

  // Lọc tổ bộ môn
  const filteredDepartments = useMemo(() => {
    let filtered = departments;

    // Chỉ hiển thị tổ mà trưởng bộ môn quản lý (hoặc đã từng quản lý)
    if (backendUser?.role === "teacher" && backendUser?.teacherFlags?.isDepartmentHead) {
      const myDepartmentId = backendUser.department;
      if (myDepartmentId) {
        filtered = filtered.filter((d) => d._id === myDepartmentId);
      } else {
        // Nếu không có departmentId, lọc theo headTeacherId
        const myTeacherId = backendUser.teacherId || backendUser._id;
        filtered = filtered.filter((d) => {
          const headTeacherId = typeof d.headTeacherId === "object" && d.headTeacherId !== null
            ? d.headTeacherId._id
            : d.headTeacherId;
          return headTeacherId === myTeacherId;
        });
      }
    }

    // Lọc theo tìm kiếm
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.name.toLowerCase().includes(lower) ||
          d.code?.toLowerCase().includes(lower) ||
          getSubjectNames(d.subjectIds || []).toLowerCase().includes(lower)
      );
    }

    // Lọc theo trưởng bộ môn
    if (filterHeadTeacher === "me") {
      const myTeacherId = backendUser?.teacherId || backendUser?._id;
      filtered = filtered.filter((d) => {
        const headTeacherId = typeof d.headTeacherId === "object" && d.headTeacherId !== null
          ? d.headTeacherId._id
          : d.headTeacherId;
        return headTeacherId === myTeacherId;
      });
    } else if (filterHeadTeacher === "others") {
      const myTeacherId = backendUser?.teacherId || backendUser?._id;
      filtered = filtered.filter((d) => {
        const headTeacherId = typeof d.headTeacherId === "object" && d.headTeacherId !== null
          ? d.headTeacherId._id
          : d.headTeacherId;
        return headTeacherId !== myTeacherId;
      });
    }

    return filtered;
  }, [departments, searchTerm, filterHeadTeacher, backendUser]);

  // Helper functions
  const getDepartmentTeachers = (departmentId: string): Teacher[] => {
    return teachers.filter((t) => {
      // ✅ Sử dụng helper function để lấy departmentId từ yearRoles hoặc top-level
      const deptId = getTeacherDepartmentId(t, selectedYear || undefined);
      return deptId === departmentId || String(deptId) === String(departmentId);
    });
  };

  const getSubjectNames = (subjectIds: (Subject | string)[]): string => {
    if (!subjectIds || subjectIds.length === 0) return "-";
    return subjectIds
      .map((s) => {
        if (typeof s === "string") {
          const subject = subjects.find((sub) => sub._id === s);
          return subject?.name || "";
        }
        return s.name || "";
      })
      .filter(Boolean)
      .join(", ");
  };

  const getHeadTeacherName = (headTeacherId: any): string => {
    if (!headTeacherId) return "-";
    const teacherId =
      typeof headTeacherId === "object" ? headTeacherId._id : headTeacherId;
    const teacher = teachers.find((t) => t._id === teacherId);
    return teacher?.name || "-";
  };

  if (!backendUser?.teacherFlags?.isDepartmentHead) {
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
          <h1 className="text-3xl font-bold">Danh sách Tổ Bộ Môn</h1>
          <p className="text-muted-foreground">
            Xem thông tin tổ bộ môn bạn đang quản lý
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
                  placeholder="Tìm kiếm theo tên, mã tổ, môn học..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-[180px]">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears
                    .filter((year) => year.name && year.name.trim() !== "")
                    .map((year) => (
                      <SelectItem key={year._id} value={year.name}>
                        {year.name} {year.isActive && "(Hiện tại)"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Select value={filterHeadTeacher} onValueChange={setFilterHeadTeacher}>
                <SelectTrigger>
                  <SelectValue placeholder="Lọc trưởng bộ môn" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="me">Tôi quản lý</SelectItem>
                  <SelectItem value="others">Người khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tổng số: {filteredDepartments.length} tổ bộ môn</CardTitle>
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
                  <TableHead>Mã tổ</TableHead>
                  <TableHead>Tên tổ bộ môn</TableHead>
                  <TableHead>Trưởng bộ môn</TableHead>
                  <TableHead>Thành viên</TableHead>
                  <TableHead>Môn học</TableHead>
                  <TableHead>Năm học</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Không tìm thấy tổ bộ môn nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDepartments.map((department) => {
                    const members = getDepartmentTeachers(department._id);
                    const memberCount = members.length;
                    const headTeacherId = typeof department.headTeacherId === "object" && department.headTeacherId !== null
                      ? department.headTeacherId._id
                      : department.headTeacherId;
                    const headTeacher = headTeacherId ? teachers.find((t) => t._id === headTeacherId) : null;
                    const isMyDepartment = headTeacherId === (backendUser?.teacherId || backendUser?._id);

                    return (
                      <TableRow key={department._id}>
                        <TableCell className="font-mono">{department.code || "-"}</TableCell>
                        <TableCell className="font-medium">{department.name}</TableCell>
                        <TableCell>
                          {headTeacher ? (
                            <div className="flex items-center gap-2">
                              <Badge variant={isMyDepartment ? "default" : "secondary"} className="text-xs">
                                <UserCheck className="h-3 w-3 mr-1" />
                                {headTeacher.name}
                              </Badge>
                              {headTeacher.teacherCode && (
                                <span className="text-xs text-muted-foreground">
                                  ({headTeacher.teacherCode})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Chưa có</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              <Users className="h-3 w-3 mr-1" />
                              {memberCount} thành viên
                            </Badge>
                            {memberCount > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setViewingDepartment(department);
                                  setIsViewDialogOpen(true);
                                }}
                                className="h-6 px-2 text-xs"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Xem
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {department.subjectIds?.slice(0, 3).map((sub, idx) => {
                                const subject = typeof sub === "string"
                                  ? subjects.find((s) => s._id === sub)
                                  : sub;
                                return (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {subject?.name || "N/A"}
                                  </Badge>
                                );
                              })}
                              {department.subjectIds && department.subjectIds.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{department.subjectIds.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {selectedYear ? (
                            <Badge variant="outline">{selectedYear}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isMyDepartment && (
                            <Badge variant="default" className="text-xs">
                              Đang quản lý
                            </Badge>
                          )}
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

      {/* View Teachers Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Thành viên tổ {viewingDepartment?.name}
            </DialogTitle>
            <DialogDescription>
              Danh sách giáo viên trong tổ bộ môn
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {viewingTeachers.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Chưa có giáo viên nào trong tổ
              </p>
            ) : (
              <div className="space-y-2">
                {viewingTeachers.map((teacher) => (
                  <div
                    key={teacher._id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{teacher.name}</p>
                        <div className="flex gap-2 mt-1">
                          {teacher.teacherCode && (
                            <Badge variant="outline" className="text-xs">
                              {teacher.teacherCode}
                            </Badge>
                          )}
                          {teacher.isDepartmentHead && (
                            <Badge variant="default" className="text-xs">
                              Tổ trưởng
                            </Badge>
                          )}
                          {teacher.isHomeroom && (
                            <Badge variant="secondary" className="text-xs">
                              GVCN
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {teacher.subjects && teacher.subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 max-w-xs justify-end">
                          {teacher.subjects?.slice(0, 2).map((sub, idx) => {
                            const subjectId = typeof sub.subjectId === "object"
                              ? sub.subjectId._id
                              : sub.subjectId;
                            const subject = subjects.find((s) => s._id === subjectId);
                            return (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {subject?.name || (typeof sub.subjectId === "object" ? sub.subjectId.name : "N/A")}
                              </Badge>
                            );
                          })}
                          {teacher.subjects.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{teacher.subjects.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

