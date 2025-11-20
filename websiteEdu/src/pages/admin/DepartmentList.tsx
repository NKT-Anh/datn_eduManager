import { useEffect, useState, useMemo } from "react";
import { Department, DepartmentInput } from "@/types/department";
import { Teacher } from "@/types/auth";
import { Subject } from "@/types/class";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useTeachers, useSubjects, useDepartments, useDepartmentTeachers } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Users, Search, Eye, BookOpen, User, UserCheck, ChevronRight, UserPlus, UserMinus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DepartmentsList = () => {
  // ✅ Sử dụng hooks
  const { departments, isLoading: loading, create: createDepartment, update: updateDepartment, remove: removeDepartment, refetch: refetchDepartments } = useDepartments();
  const { teachers } = useTeachers();
  const { subjects } = useSubjects();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);
  const [viewingDepartment, setViewingDepartment] = useState<Department | null>(null);
  const [isAddTeacherDialogOpen, setIsAddTeacherDialogOpen] = useState(false);
  const [selectedTeachersToAdd, setSelectedTeachersToAdd] = useState<string[]>([]);
  
  // ✅ Hook để quản lý giáo viên trong tổ
  const { addTeacher: addTeacherToDepartment, removeTeacher: removeTeacherFromDepartment } = useDepartmentTeachers(viewingDepartment?._id);

  // Form state
  const [formData, setFormData] = useState<DepartmentInput>({
    name: "",
    code: "",
    description: "",
    headTeacherId: null,
    subjectIds: [],
    notes: "",
    status: "active",
  });

  const { toast } = useToast();

  // ✅ Không cần loadDepartments nữa vì đã dùng hooks

  const filteredDepartments = useMemo(() => {
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [departments, searchTerm]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      headTeacherId: null,
      subjectIds: [],
      notes: "",
      status: "active",
    });
    setEditingDepartment(null);
  };

  // Handle add/edit
  const handleSubmit = async () => {
    try {
      if (editingDepartment) {
        await updateDepartment({ id: editingDepartment._id, data: formData });
        toast({ title: "Thành công", description: "Đã cập nhật tổ bộ môn" });
      } else {
        await createDepartment(formData);
        toast({ title: "Thành công", description: "Đã thêm tổ bộ môn" });
      }
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Thao tác thất bại",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      code: department.code || "",
      description: department.description || "",
      headTeacherId:
        typeof department.headTeacherId === "object" && department.headTeacherId?._id
          ? department.headTeacherId._id
          : typeof department.headTeacherId === "string"
          ? department.headTeacherId
          : null,
      subjectIds:
        department.subjectIds?.map((s) =>
          typeof s === "object" ? s._id : s
        ) || [],
      notes: department.notes || "",
      status: department.status || "active",
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingDepartment) return;
    try {
      await removeDepartment(deletingDepartment._id);
      toast({ title: "Thành công", description: "Đã xóa tổ bộ môn" });
      setDeletingDepartment(null);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Xóa thất bại",
        variant: "destructive",
      });
    }
  };

  const getHeadTeacherName = (headTeacherId: any) => {
    if (!headTeacherId) return "-";
    const teacherId =
      typeof headTeacherId === "object" ? headTeacherId._id : headTeacherId;
    const teacher = teachers.find((t) => t._id === teacherId);
    return teacher?.name || "-";
  };

  const getSubjectNames = (subjectIds: any[]) => {
    if (!subjectIds || subjectIds.length === 0) return "Chưa có môn học";
    return subjectIds
      .map((id) => {
        const subjectId = typeof id === "object" ? id._id : id;
        const subject = subjects.find((s) => s._id === subjectId);
        return subject?.name;
      })
      .filter(Boolean)
      .join(", ");
  };

  // Lấy danh sách giáo viên trong tổ
  const getDepartmentTeachers = (departmentId: string) => {
    return teachers.filter((teacher) => {
      const teacherDeptId = typeof teacher.departmentId === 'object' && teacher.departmentId !== null
        ? teacher.departmentId._id
        : teacher.departmentId;
      return teacherDeptId === departmentId;
    });
  };

  // Lấy số lượng thành viên trong tổ
  const getMemberCount = (departmentId: string) => {
    return getDepartmentTeachers(departmentId).length;
  };

  // Lấy danh sách giáo viên chưa thuộc tổ nào và dạy ít nhất một môn trong tổ
  const getAvailableTeachers = (departmentId: string) => {
    const department = departments.find(d => d._id === departmentId);
    if (!department || !department.subjectIds || department.subjectIds.length === 0) {
      return []; // Nếu tổ chưa có môn học, không có giáo viên nào phù hợp
    }

    // Lấy danh sách môn học của tổ
    const departmentSubjectIds = department.subjectIds.map((s: any) => 
      typeof s === 'object' ? s._id : s
    );

    return teachers.filter((teacher) => {
      // 1. Giáo viên chưa thuộc tổ nào
      const teacherDeptId = typeof teacher.departmentId === 'object' && teacher.departmentId !== null
        ? teacher.departmentId._id
        : teacher.departmentId;
      if (teacherDeptId) return false;

      // 2. Giáo viên phải dạy ít nhất một môn trong danh sách môn của tổ
      if (!teacher.subjects || teacher.subjects.length === 0) return false;

      return teacher.subjects.some((sub) => {
        const subjectId = typeof sub.subjectId === 'object' && sub.subjectId !== null
          ? sub.subjectId._id
          : sub.subjectId;
        return departmentSubjectIds.includes(subjectId);
      });
    });
  };

  // Thêm giáo viên vào tổ (hỗ trợ nhiều giáo viên)
  const handleAddTeachers = async () => {
    if (!viewingDepartment || selectedTeachersToAdd.length === 0) return;

    try {
      // ✅ Thêm từng giáo viên
      const results = await Promise.allSettled(
        selectedTeachersToAdd.map(teacherId => addTeacherToDepartment(teacherId))
      );
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;
      
      if (successCount > 0) {
        toast({
          title: "Thành công",
          description: `Đã thêm ${successCount} giáo viên vào tổ bộ môn${failCount > 0 ? ` (${failCount} giáo viên thất bại)` : ''}`,
        });
      } else {
        toast({
          title: "Lỗi",
          description: "Không thể thêm giáo viên vào tổ",
          variant: "destructive",
        });
      }
      
      setSelectedTeachersToAdd([]);
      setIsAddTeacherDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Không thể thêm giáo viên vào tổ",
        variant: "destructive",
      });
    }
  };

  // Xóa giáo viên khỏi tổ
  const handleRemoveTeacher = async (teacherId: string) => {
    if (!viewingDepartment) return;

    if (!window.confirm("Bạn có chắc chắn muốn xóa giáo viên này khỏi tổ bộ môn?")) {
      return;
    }

    try {
      await removeTeacherFromDepartment(teacherId);
      toast({
        title: "Thành công",
        description: "Đã xóa giáo viên khỏi tổ bộ môn",
      });
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Không thể xóa giáo viên khỏi tổ",
        variant: "destructive",
      });
    }
  };

  // Lọc giáo viên theo môn học đã chọn
  const getFilteredTeachers = () => {
    if (!formData.subjectIds || formData.subjectIds.length === 0) {
      return teachers; // Nếu chưa chọn môn nào, hiển thị tất cả
    }

    return teachers.filter((teacher) => {
      // Kiểm tra xem giáo viên có dạy ít nhất một môn trong danh sách đã chọn không
      if (!teacher.subjects || teacher.subjects.length === 0) {
        return false;
      }

      return teacher.subjects.some((sub) => {
        const subjectId = typeof sub.subjectId === 'object' 
          ? sub.subjectId?._id 
          : sub.subjectId;
        return formData.subjectIds?.includes(subjectId);
      });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Quản lý tổ bộ môn</h1>
          <p className="text-muted-foreground">
            Quản lý các tổ chuyên môn trong trường
          </p>
        </div>

        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="mr-2 h-4 w-4" /> Thêm tổ bộ môn
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingDepartment ? "Chỉnh sửa tổ bộ môn" : "Thêm tổ bộ môn mới"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {editingDepartment ? "Cập nhật thông tin tổ bộ môn" : "Tạo tổ bộ môn mới trong hệ thống"}
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Tên tổ bộ môn *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ví dụ: Tổ Toán, Tổ Văn"
                />
              </div>
              <div>
                <Label htmlFor="code">Mã tổ bộ môn</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="Ví dụ: TOAN, VAN (để trống sẽ tự động tạo)"
                />
              </div>
              <div>
                <Label htmlFor="description">Mô tả</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Mô tả về tổ bộ môn"
                />
              </div>
              <div>
                <Label htmlFor="headTeacherId">Trưởng bộ môn</Label>
                <Select
                  value={formData.headTeacherId || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      headTeacherId: value === "none" ? null : value,
                    })
                  }
                  disabled={!formData.subjectIds || formData.subjectIds.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      formData.subjectIds && formData.subjectIds.length > 0
                        ? "Chọn trưởng bộ môn"
                        : "Vui lòng chọn môn học trước"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không có</SelectItem>
                    {getFilteredTeachers().map((teacher) => (
                      <SelectItem key={teacher._id} value={teacher._id}>
                        {teacher.name} ({teacher.teacherCode})
                        {teacher.subjects && teacher.subjects.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-2">
                            - {teacher.subjects
                              .map((sub) => {
                                const subjectId = typeof sub.subjectId === 'object' 
                                  ? sub.subjectId?._id 
                                  : sub.subjectId;
                                const subject = subjects.find(s => s._id === subjectId);
                                return subject?.name;
                              })
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!formData.subjectIds || formData.subjectIds.length === 0) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Vui lòng chọn môn học trước để hiển thị danh sách giáo viên phù hợp
                  </p>
                )}
                {formData.subjectIds && formData.subjectIds.length > 0 && getFilteredTeachers().length === 0 && (
                  <p className="text-xs text-warning mt-1">
                    Không có giáo viên nào dạy các môn đã chọn
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="subjectIds">Môn học thuộc tổ</Label>
                <Select
                  value="select-subject"
                  onValueChange={(value) => {
                    if (value && value !== "select-subject" && !formData.subjectIds?.includes(value)) {
                      const newSubjectIds = [...(formData.subjectIds || []), value];
                      
                      // Kiểm tra xem trưởng bộ môn hiện tại có còn phù hợp không
                      let newHeadTeacherId = formData.headTeacherId;
                      if (formData.headTeacherId && formData.headTeacherId !== "none") {
                        const currentTeacher = teachers.find(t => t._id === formData.headTeacherId);
                        if (currentTeacher) {
                          const teacherTeachesSelectedSubjects = currentTeacher.subjects?.some((sub) => {
                            const subjectId = typeof sub.subjectId === 'object' 
                              ? sub.subjectId?._id 
                              : sub.subjectId;
                            return newSubjectIds.includes(subjectId);
                          });
                          
                          // Nếu giáo viên hiện tại không dạy môn nào trong danh sách mới, reset về null
                          if (!teacherTeachesSelectedSubjects) {
                            newHeadTeacherId = null;
                          }
                        }
                      }
                      
                      setFormData({
                        ...formData,
                        subjectIds: newSubjectIds,
                        headTeacherId: newHeadTeacherId,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn môn học để thêm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select-subject" disabled>Chọn môn học để thêm</SelectItem>
                    {subjects
                      .filter(
                        (s) => !formData.subjectIds?.includes(s._id)
                      )
                      .map((subject) => (
                        <SelectItem key={subject._id} value={subject._id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {formData.subjectIds && formData.subjectIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.subjectIds.map((subjectId) => {
                      const subject = subjects.find((s) => s._id === subjectId);
                      return subject ? (
                        <Badge
                          key={subjectId}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => {
                            const newSubjectIds = formData.subjectIds?.filter(
                              (id) => id !== subjectId
                            ) || [];
                            
                            // Kiểm tra xem trưởng bộ môn hiện tại có còn phù hợp không
                            let newHeadTeacherId = formData.headTeacherId;
                            if (formData.headTeacherId && formData.headTeacherId !== "none" && newSubjectIds.length > 0) {
                              const currentTeacher = teachers.find(t => t._id === formData.headTeacherId);
                              if (currentTeacher) {
                                const teacherTeachesRemainingSubjects = currentTeacher.subjects?.some((sub) => {
                                  const subId = typeof sub.subjectId === 'object' 
                                    ? sub.subjectId?._id 
                                    : sub.subjectId;
                                  return newSubjectIds.includes(subId);
                                });
                                
                                // Nếu giáo viên hiện tại không dạy môn nào còn lại, reset về null
                                if (!teacherTeachesRemainingSubjects) {
                                  newHeadTeacherId = null;
                                }
                              }
                            } else if (newSubjectIds.length === 0) {
                              // Nếu xóa hết môn học, reset trưởng bộ môn
                              newHeadTeacherId = null;
                            }
                            
                            setFormData({
                              ...formData,
                              subjectIds: newSubjectIds,
                              headTeacherId: newHeadTeacherId,
                            });
                          }}
                        >
                          {subject.name} ×
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="notes">Ghi chú</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Ghi chú bổ sung"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    resetForm();
                  }}
                >
                  Hủy
                </Button>
                <Button onClick={handleSubmit}>
                  {editingDepartment ? "Cập nhật" : "Thêm"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-col items-start gap-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Danh sách tổ bộ môn
          </CardTitle>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm tổ bộ môn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Đang tải danh sách tổ bộ môn...</p>
              </div>
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
                  <TableHead>Trạng thái</TableHead>
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
                    const headTeacherId = typeof department.headTeacherId === 'object' && department.headTeacherId !== null
                      ? department.headTeacherId._id
                      : department.headTeacherId;
                    const headTeacher = headTeacherId ? teachers.find(t => t._id === headTeacherId) : null;
                    
                    return (
                      <TableRow key={department._id}>
                        <TableCell className="font-mono">{department.code || "-"}</TableCell>
                        <TableCell className="font-medium">{department.name}</TableCell>
                        <TableCell>
                          {headTeacher ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="text-xs">
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
                              {memberCount} thành viên
                            </Badge>
                            {memberCount > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingDepartment(department)}
                                className="h-6 px-2 text-xs"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Xem
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate" title={getSubjectNames(department.subjectIds || [])}>
                            {getSubjectNames(department.subjectIds || [])}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              department.status === "active" ? "default" : "secondary"
                            }
                          >
                            {department.status === "active" ? "Hoạt động" : "Tạm dừng"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(department)}
                              title="Chỉnh sửa"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingDepartment(department)}
                              title="Xóa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      <DeleteConfirmDialog
        open={!!deletingDepartment}
        onOpenChange={() => setDeletingDepartment(null)}
        onConfirm={handleDelete}
        title="Xóa tổ bộ môn"
        description={`Bạn có chắc chắn muốn xóa tổ bộ môn "${deletingDepartment?.name}"?`}
      />

      {/* Dialog xem chi tiết thành viên */}
      <Dialog
        open={!!viewingDepartment}
        onOpenChange={(open) => !open && setViewingDepartment(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Thành viên tổ bộ môn: {viewingDepartment?.name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Danh sách giáo viên thuộc tổ bộ môn này
            </p>
          </DialogHeader>
          {viewingDepartment && (
            <div className="space-y-4">
              {/* Trưởng bộ môn */}
              {(() => {
                const headTeacherId = typeof viewingDepartment.headTeacherId === 'object' && viewingDepartment.headTeacherId !== null
                  ? viewingDepartment.headTeacherId._id
                  : viewingDepartment.headTeacherId;
                const headTeacher = headTeacherId ? teachers.find(t => t._id === headTeacherId) : null;
                return headTeacher ? (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="default">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Trưởng bộ môn
                          </Badge>
                          <span className="font-medium">{headTeacher.name}</span>
                          {headTeacher.teacherCode && (
                            <span className="text-sm text-muted-foreground">
                              ({headTeacher.teacherCode})
                            </span>
                          )}
                        </div>
                        {headTeacher.phone && (
                          <p className="text-sm text-muted-foreground">
                            SĐT: {headTeacher.phone}
                          </p>
                        )}
                        {headTeacher.accountId?.email && (
                          <p className="text-sm text-muted-foreground">
                            Email: {headTeacher.accountId.email}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {headTeacher.isHomeroom && (
                          <Badge variant="outline" className="text-xs">GVCN</Badge>
                        )}
                        {headTeacher.isDepartmentHead && (
                          <Badge variant="outline" className="text-xs">TBM</Badge>
                        )}
                        {headTeacher.isLeader && (
                          <Badge variant="outline" className="text-xs">BGH</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Danh sách thành viên */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">
                    Thành viên ({getMemberCount(viewingDepartment._id)})
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddTeacherDialogOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Thêm giáo viên
                  </Button>
                </div>
                {getDepartmentTeachers(viewingDepartment._id).length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    Chưa có thành viên nào trong tổ
                  </p>
                ) : (
                  <div className="space-y-2">
                    {getDepartmentTeachers(viewingDepartment._id).map((teacher) => {
                      const isHead = (typeof viewingDepartment.headTeacherId === 'object' && viewingDepartment.headTeacherId !== null
                        ? viewingDepartment.headTeacherId._id
                        : viewingDepartment.headTeacherId) === teacher._id;
                      
                      if (isHead) return null; // Đã hiển thị ở trên
                      
                      return (
                        <div
                          key={teacher._id}
                          className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{teacher.name}</span>
                                {teacher.teacherCode && (
                                  <span className="text-sm text-muted-foreground">
                                    ({teacher.teacherCode})
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                {teacher.phone && <span>SĐT: {teacher.phone}</span>}
                                {teacher.accountId?.email && (
                                  <span>Email: {teacher.accountId.email}</span>
                                )}
                              </div>
                              {teacher.subjects && teacher.subjects.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {teacher.subjects.map((sub, idx) => {
                                    const subjectId = typeof sub.subjectId === 'object' && sub.subjectId !== null
                                      ? sub.subjectId._id
                                      : sub.subjectId;
                                    const subject = subjects.find(s => s._id === subjectId);
                                    return subject ? (
                                      <Badge key={idx} variant="secondary" className="text-xs">
                                        {subject.name}
                                      </Badge>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                {teacher.isHomeroom && (
                                  <Badge variant="outline" className="text-xs">GVCN</Badge>
                                )}
                                {teacher.isDepartmentHead && (
                                  <Badge variant="outline" className="text-xs">TBM</Badge>
                                )}
                                {teacher.isLeader && (
                                  <Badge variant="outline" className="text-xs">BGH</Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveTeacher(teacher._id)}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                title="Xóa khỏi tổ"
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewingDepartment(null)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog thêm giáo viên vào tổ */}
      <Dialog
        open={isAddTeacherDialogOpen}
        onOpenChange={(open) => {
          setIsAddTeacherDialogOpen(open);
          if (!open) setSelectedTeachersToAdd([]);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thêm giáo viên vào tổ bộ môn</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Chọn nhiều giáo viên để thêm vào tổ: {viewingDepartment?.name}
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {viewingDepartment && getAvailableTeachers(viewingDepartment._id).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Không có giáo viên nào có thể thêm vào tổ này
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Chọn giáo viên ({selectedTeachersToAdd.length} đã chọn)</Label>
                <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
                  <div className="space-y-2">
                    {viewingDepartment && getAvailableTeachers(viewingDepartment._id).map((teacher) => {
                      const isSelected = selectedTeachersToAdd.includes(teacher._id!);
                      return (
                        <div
                          key={teacher._id}
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-accent'
                          }`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTeachersToAdd(prev => prev.filter(id => id !== teacher._id));
                            } else {
                              setSelectedTeachersToAdd(prev => [...prev, teacher._id!]);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1">
                              <div className="font-medium">
                                {teacher.name} {teacher.teacherCode && `(${teacher.teacherCode})`}
                              </div>
                              {teacher.subjects && teacher.subjects.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {teacher.subjects.map((sub, idx) => {
                                    const subjectId = typeof sub.subjectId === 'object' && sub.subjectId !== null
                                      ? sub.subjectId._id
                                      : sub.subjectId;
                                    const subject = subjects.find(s => s._id === subjectId);
                                    return subject ? subject.name : null;
                                  }).filter(Boolean).join(", ")}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddTeacherDialogOpen(false);
                setSelectedTeachersToAdd([]);
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={handleAddTeachers}
              disabled={selectedTeachersToAdd.length === 0}
            >
              Thêm {selectedTeachersToAdd.length > 0 && `(${selectedTeachersToAdd.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepartmentsList;

