import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SubjectDetailDialog } from "@/components/dialogs/SubjectDetailDialog";
import { useAuth } from "@/contexts/AuthContext";
import { SubjectForm } from "@/components/forms/SubjectForm";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { Subject } from "@/types/class";
import { useToast } from "@/hooks/use-toast";
import { subjectApi } from "@/services/subjectApi";
import { Search, Plus, Edit, Trash2, Eye, BookOpen, Code, Settings2,Clock  } from "lucide-react";

const SubjectsPage = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState<Subject | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailSubjectId, setDetailSubjectId] = useState<string | undefined>();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState<Subject | undefined>();
const [editingValues, setEditingValues] = useState<Record<string, number>>({});

  // Fetch subjects
  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const data = await subjectApi.getSubjects();
      setSubjects(data);
    } catch (error) {
      toast({
        title: "Lỗi tải môn học",
        description: "Không thể tải danh sách môn học",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // Filter subjects
  const filteredSubjects = subjects.filter(
    (subject) =>
      subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // CRUD Handlers
  const handleCreateSubject = async (data: any) => {
    try {
      const newSubject = await subjectApi.create(data);
      setSubjects([...subjects, newSubject]);
      toast({ title: "Thành công", description: "Đã thêm môn học mới" });
    } catch {
      toast({
        title: "Lỗi",
        description: "Không thể tạo môn học",
        variant: "destructive",
      });
    }
  };

  const handleEditSubject = async (data: any) => {
    if (!selectedSubject) return;
    try {
      const updatedSubject = await subjectApi.update(selectedSubject._id, data);
      setSubjects(
        subjects.map((s) =>
          s._id === selectedSubject._id ? updatedSubject : s
        )
      );
      setSelectedSubject(undefined);
      toast({ title: "Cập nhật thành công" });
    } catch {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật môn học",
        variant: "destructive",
      });
    }
  };
  

  const handleDeleteSubject = async () => {
    if (!deletingSubject) return;
    try {
      await subjectApi.delete(deletingSubject._id);
      setSubjects(subjects.filter((s) => s._id !== deletingSubject._id));
      toast({
        title: "Xóa thành công",
        description: `Môn học ${deletingSubject.name} đã được xóa.`,
      });
    } catch {
      toast({
        title: "Lỗi",
        description: "Không thể xóa môn học",
        variant: "destructive",
      });
    } finally {
      setDeletingSubject(undefined);
      setIsDeleteDialogOpen(false);
    }
  };
  // Lưu thời lượng thi khi người dùng nhấn Enter hoặc blur
  const handleSaveExamDuration = async (
  subject: Subject,
  newValue: number,
  oldValue: number
) => {
  if (isNaN(newValue) || newValue < 15 || newValue > 300 || newValue === oldValue) {
    console.log("⚠️ Không cần lưu (giá trị không thay đổi hoặc không hợp lệ)");
    return;
  }

  console.log("🟦 Gọi API updateDefaultExamDuration:", subject._id, newValue);

  try {
    const updated = await subjectApi.updateDefaultExamDuration(subject._id, newValue);
    console.log("✅ API trả về:", updated);

    setSubjects((prev) =>
      prev.map((s) => (s._id === subject._id ? updated : s))
    );

    toast({
      title: "✅ Cập nhật thành công",
      description: `Thời lượng thi được đặt thành ${newValue} phút.`,
    });
  } catch (err) {
    console.error("❌ Lỗi khi lưu:", err);
    toast({
      title: "❌ Lỗi",
      description: "Không thể cập nhật thời lượng thi",
      variant: "destructive",
    });
  }
};


  // Toggle includeInAverage (Cấu hình tính điểm)
  const handleToggleIncludeInAverage = async (
    subjectId: string,
    currentValue: boolean
  ) => {
    try {
      await subjectApi.updateIncludeInAverage(subjectId, !currentValue);
      setSubjects(
        subjects.map((s) =>
          s._id === subjectId ? { ...s, includeInAverage: !currentValue } : s
        )
      );
      toast({
        title: "Cập nhật cấu hình",
        description: `Đã ${
          !currentValue ? "bật" : "tắt"
        } tính vào điểm trung bình.`,
      });
    } catch {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật cấu hình môn học",
        variant: "destructive",
      });
    }
  };

  // Open dialogs
  const openEditForm = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsFormOpen(true);
  };

  const openDeleteDialog = (subject: Subject) => {
    setDeletingSubject(subject);
    setIsDeleteDialogOpen(true);
  };

  if (backendUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Không có quyền truy cập
          </h2>
          <p className="text-muted-foreground mt-2">
            Bạn không có quyền truy cập trang này.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý môn học</h1>
          <p className="text-muted-foreground">
            Quản lý thông tin và cấu hình tính điểm cho các môn học
          </p>
        </div>
        <Button
          className="bg-gradient-primary hover:bg-primary-hover"
          onClick={() => {
            setSelectedSubject(undefined);
            setIsFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Thêm môn học
        </Button>
      </div>

      {/* Search */}
      <Card className="shadow-card border-border">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm môn học theo tên hoặc mã môn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Subjects Grid */}
      {loading ? (
        <p>Đang tải...</p>
      ) : filteredSubjects.length === 0 ? (
        <Card className="shadow-card border-border">
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Không tìm thấy môn học
            </h3>
            <p className="text-muted-foreground">
              Thử thay đổi từ khóa tìm kiếm.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSubjects.map((subject) => (
            <Card
              key={subject._id}
              className="shadow-card border-border hover:shadow-soft transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-gradient-primary rounded-lg">
                      <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg leading-tight">
                        {subject.name}
                      </CardTitle>
                      <div className="flex items-center space-x-1 mt-1">
                        <Code className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-xs">
                          {subject.code}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDetailSubjectId(subject._id);
                        setIsDetailOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditForm(subject)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => openDeleteDialog(subject)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
{/* Thời lượng thi */}
<div className="flex items-center justify-between p-2 border rounded-lg bg-muted/40">
  <div className="flex items-center space-x-2">
    <Clock className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm text-foreground">Thời lượng thi (phút)</span>
  </div>

{/* Ô nhập chỉnh sửa thời lượng thi */}
<Input
  type="number"
  min={15}
  max={300}
  className="w-20 text-center h-8"
  value={subject.defaultExamDuration ?? 90}
  onFocus={() => {
    setEditingValues((prev) => ({
      ...prev,
      [subject._id]: subject.defaultExamDuration ?? 90,
    }));
  }}
  onChange={(e) => {
    const value = parseInt(e.target.value) || 0;
    setSubjects((prev) =>
      prev.map((s) =>
        s._id === subject._id ? { ...s, defaultExamDuration: value } : s
      )
    );
  }}
  onBlur={async (e) => {
    const newValue = parseInt(e.target.value);
    const oldValue = editingValues[subject._id] ?? subject.defaultExamDuration ?? 90;
    console.log("🟡 BLUR chạy, cũ:", oldValue, "mới:", newValue);
    await handleSaveExamDuration(subject, newValue, oldValue);
  }}
  onKeyDown={async (e) => {
    if (e.key === "Enter") {
      const newValue = parseInt((e.target as HTMLInputElement).value);
      const oldValue = editingValues[subject._id] ?? subject.defaultExamDuration ?? 90;
      (e.target as HTMLInputElement).blur();
      await handleSaveExamDuration(subject, newValue, oldValue);
    }
  }}
/>


</div>


  {/* Cấu hình tính điểm */}
  <div className="flex items-center justify-between p-2 border rounded-lg bg-muted/40">
    <div className="flex items-center space-x-2">
      <Settings2 className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-foreground">
        Tính vào điểm trung bình
      </span>
    </div>
    <Switch
      checked={subject.includeInAverage}
      onCheckedChange={() =>
        handleToggleIncludeInAverage(subject._id, subject.includeInAverage)
      }
    />
  </div>


                {/* Buttons */}
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setDetailSubjectId(subject._id);
                      setIsDetailOpen(true);
                    }}
                  >
                    Chi tiết
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    Lịch dạy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <SubjectForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        subjectData={selectedSubject}
        onSubmit={selectedSubject ? handleEditSubject : handleCreateSubject}
      />

      <SubjectDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        subjectId={detailSubjectId}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Xác nhận xóa môn học"
        description={`Bạn có chắc chắn muốn xóa môn học ${deletingSubject?.name}? Hành động này không thể hoàn tác.`}
        onConfirm={handleDeleteSubject}
      />
    </div>
  );
};

export default SubjectsPage;
