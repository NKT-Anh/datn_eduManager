import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDepartmentManagement } from "@/hooks/departments/useDepartmentManagement";
import { useAuth } from "@/contexts/AuthContext";
import { useTeachers } from "@/hooks/teachers/useTeachers";
import { 
  Users, 
  Plus, 
  Trash2,
  BookOpen,
  Loader2,
  UserCheck,
  UserX
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSchoolYears } from "@/hooks/schoolYear/useSchoolYears";

export default function DepartmentTeachersManagementPage() {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const { teachers, loading, fetchTeachers, addTeacher, removeTeacher } = useDepartmentManagement();
  const { teachers: allTeachers = [], isLoading: isLoadingTeachers } = useTeachers();
  const { schoolYears, currentYear } = useSchoolYears();
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<"1" | "2">("1");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [removingTeacherId, setRemovingTeacherId] = useState<string | null>(null);

  // Lấy năm học hiện tại từ SchoolYear có isActive: true
  useEffect(() => {
    if (currentYear && !selectedYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, selectedYear]);

  useEffect(() => {
    if (selectedYear) {
      fetchTeachers({ year: selectedYear, semester: selectedSemester });
    }
  }, [selectedYear, selectedSemester, fetchTeachers]);

  const handleAddTeacher = async () => {
    if (!selectedTeacherId) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn giáo viên",
        variant: "destructive",
      });
      return;
    }

    try {
      await addTeacher(selectedTeacherId);
      setIsAddDialogOpen(false);
      setSelectedTeacherId("");
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleRemoveTeacher = async (teacherId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa giáo viên này khỏi tổ?")) {
      return;
    }

    setRemovingTeacherId(teacherId);
    try {
      await removeTeacher(teacherId);
    } catch (error) {
      // Error handled in hook
    } finally {
      setRemovingTeacherId(null);
    }
  };

  // Lọc giáo viên chưa có trong tổ và không phải chính người đang đăng nhập
  const availableTeachers = (allTeachers || []).filter(
    (teacher) => {
      // Loại bỏ giáo viên đã có trong tổ
      if (teachers?.teachers?.some((t) => t._id === teacher._id)) {
        return false;
      }
      // Loại bỏ chính người đang đăng nhập
      const currentTeacherId = backendUser?.teacherId || backendUser?._id;
      if (teacher._id === currentTeacherId) {
        return false;
      }
      return true;
    }
  );

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
          <h1 className="text-3xl font-bold">Quản lý Giáo viên</h1>
          <p className="text-muted-foreground">
            Quản lý giáo viên trong tổ {teachers?.department.name || ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[180px]">
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
          <Select value={selectedSemester} onValueChange={(v) => setSelectedSemester(v as "1" | "2")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Học kỳ 1</SelectItem>
              <SelectItem value="2">Học kỳ 2</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Thêm giáo viên
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Danh sách giáo viên ({teachers?.teachers.length || 0})</CardTitle>
            <CardDescription>
              Quản lý giáo viên trong tổ bộ môn
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teachers?.teachers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Chưa có giáo viên nào trong tổ
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Giáo viên</TableHead>
                    <TableHead>Mã giáo viên</TableHead>
                    <TableHead>Môn dạy</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Phân công</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers?.teachers.map((teacher) => (
                    <TableRow key={teacher._id}>
                      <TableCell className="font-medium">{teacher.name}</TableCell>
                      <TableCell>{teacher.teacherCode || "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {teacher.subjects?.slice(0, 2).map((sub, idx) => (
                            <Badge key={idx} variant="outline">
                              {sub.subjectId?.name || "N/A"}
                            </Badge>
                          ))}
                          {teacher.subjects && teacher.subjects.length > 2 && (
                            <Badge variant="outline">+{teacher.subjects.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {teacher.isDepartmentHead && (
                            <Badge variant="default">Tổ trưởng</Badge>
                          )}
                          {teacher.isHomeroom && (
                            <Badge variant="secondary">GVCN</Badge>
                          )}
                          {!teacher.isDepartmentHead && !teacher.isHomeroom && (
                            <Badge variant="outline">GVBM</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {teacher.assignmentInfo ? (
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            <span>{teacher.assignmentInfo.totalClasses} lớp</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Chưa có</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {teacher.isDepartmentHead ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            Tổ trưởng
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveTeacher(teacher._id)}
                            disabled={removingTeacherId === teacher._id}
                          >
                            {removingTeacherId === teacher._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Teacher Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm giáo viên vào tổ</DialogTitle>
            <DialogDescription>
              Chọn giáo viên để thêm vào tổ bộ môn. Chỉ có thể thêm giáo viên dạy các môn trong tổ.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn giáo viên" />
              </SelectTrigger>
              <SelectContent>
                {availableTeachers.map((teacher) => (
                  <SelectItem key={teacher._id} value={teacher._id}>
                    {teacher.name} {teacher.teacherCode && `(${teacher.teacherCode})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleAddTeacher}>
              <UserCheck className="h-4 w-4 mr-2" />
              Thêm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

