import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, Pencil } from "lucide-react";
import { gradeApi } from "@/services/gradeApi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Grade, GradeInput } from "@/types/class"; // ✅ Import type

export default function GradeScreen() {
  const { toast } = useToast();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<GradeInput>({
    name: "",
    level: "high",
    description: "",
  });
  const [editId, setEditId] = useState<string | null>(null);

  // 🔹 Lấy danh sách khối
  const fetchGrades = async () => {
    try {
      const data = await gradeApi.getAll();
      setGrades(data);
    } catch (error: any) {
      toast({
        title: "Lỗi tải dữ liệu",
        description: String(error.message || error),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchGrades();
  }, []);

  // 🔹 Tạo hoặc cập nhật
  const handleSubmit = async () => {
    if (!form.name || !form.level) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng nhập đầy đủ tên khối và cấp học.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editId) {
        await gradeApi.update(editId, form);
        toast({ title: "Đã cập nhật thành công" });
      } else {
        await gradeApi.create(form);
        toast({ title: "Đã thêm mới khối" });
      }
      setOpen(false);
      setForm({ name: "", level: "high", description: "" });
      setEditId(null);
      fetchGrades();
    } catch (error: any) {
      toast({
        title: "Lỗi thao tác",
        description: String(error.message || error),
        variant: "destructive",
      });
    }
  };

  // 🔹 Xóa khối
  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa khối này?")) return;
    try {
      await gradeApi.delete(id);
      toast({ title: "Đã xóa thành công" });
      fetchGrades();
    } catch (error: any) {
      toast({
        title: "Lỗi khi xóa",
        description: String(error.message || error),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">📘 Quản lý khối</h2>
        <Button
          onClick={() => {
            setEditId(null);
            setForm({ name: "", level: "high", description: "" });
            setOpen(true);
          }}
        >
          + Thêm khối
        </Button>
      </div>

      <table className="w-full border rounded-md text-sm">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">Tên khối</th>
            <th className="p-2 border">Cấp học</th>
            <th className="p-2 border">Mô tả</th>
            <th className="p-2 border w-[120px] text-center">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {grades.map((g) => (
            <tr key={g._id} className="border-t hover:bg-gray-50">
              <td className="p-2 border">{g.name}</td>
              <td className="p-2 border">
                {g.level === "primary"
                  ? "Tiểu học"
                  : g.level === "secondary"
                  ? "THCS"
                  : g.level === "high"
                  ? "THPT" : "chưa chọn"}
              </td>
              <td className="p-2 border">{g.description}</td>
              <td className="p-2 border flex gap-2 justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditId(g._id || null);
                    setForm({
                      name: g.name,
                      level: g.level,
                      description: g.description || "",
                    });
                    setOpen(true);
                  }}
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(g._id!)}
                >
                  <Trash2 size={16} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🔹 Dialog thêm / sửa khối */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId ? "Cập nhật khối" : "Thêm khối mới"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tên khối</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VD: Khối 10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cấp học</label>
              <Select
                value={form.level}
                onValueChange={(val) =>
                  setForm({ ...form, level: val as GradeInput["level"] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn cấp học" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Tiểu học</SelectItem>
                  <SelectItem value="secondary">THCS</SelectItem>
                  <SelectItem value="high">THPT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mô tả</label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="VD: Dành cho học sinh cấp 3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit}>
              {editId ? "Cập nhật" : "Thêm mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
