import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { StudentCreatePayload } from "@/services/studentApi";
import { classApiNoToken } from "@/services/classApi"; // ✅ API thật

// ✅ Xác thực dữ liệu học sinh bằng zod
const studentSchema = z.object({
  name: z.string().min(1, "Họ tên là bắt buộc"),
  classId: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(["male", "female", "other"]),
  admissionYear: z.number().min(2000).max(new Date().getFullYear()),
  grade: z.enum(["10", "11", "12"]),
  status: z.enum(["active", "inactive"]).default("active"),
  parents: z
    .array(
      z.object({
        name: z.string().min(1, "Tên phụ huynh bắt buộc"),
        phone: z.string().optional(),
        occupation: z.string().optional(),
        relation: z.enum(["father", "mother", "guardian"]),
      })
    )
    .optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;

interface StudentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentData?: StudentCreatePayload;
  onSubmit: (data: StudentFormData) => void;
}

export const StudentForm = ({
  open,
  onOpenChange,
  studentData,
  onSubmit,
}: StudentFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [classList, setClassList] = useState<
    { _id: string; className: string; grade: string }[]
  >([]);
  const [filteredClasses, setFilteredClasses] = useState<typeof classList>([]);

  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: studentData?.name || "",
      classId: studentData?.classId || "",
      phone: studentData?.phone || "",
      address: studentData?.address || "",
      dob: studentData?.dob || "",
      gender: (studentData?.gender as any) || "male",
      admissionYear: studentData?.admissionYear || new Date().getFullYear(),
      grade: (studentData?.grade as any) || "10",
      status: (studentData?.status as any) || "active",
      parents: studentData?.parents || [
        { name: "", phone: "", occupation: "", relation: "father" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "parents",
  });

  // ✅ Load danh sách lớp từ API thật
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await classApiNoToken.getAll();
        // 👉 Nếu API trả về mảng trực tiếp
        const data = Array.isArray(res) ? res : (res as any).data;
        setClassList(data || []);
      } catch (error) {
        toast({
          title: "Lỗi tải lớp",
          description: "Không thể tải danh sách lớp từ server.",
          variant: "destructive",
        });
      }
    };
    fetchClasses();
  }, []);

  // ✅ Lọc lớp theo khối khi chọn grade
  useEffect(() => {
    const selectedGrade = form.watch("grade");
    const filtered = classList.filter((cls) => cls.grade === selectedGrade);
    setFilteredClasses(filtered);
  }, [form.watch("grade"), classList]);

  // ✅ Reset lại form nếu đang chỉnh sửa học sinh
  useEffect(() => {
    if (studentData) {
      form.reset({
        name: studentData.name || "",
        dob: studentData.dob ? studentData.dob.split("T")[0] : "",
        gender: studentData.gender || "male",
        phone: studentData.phone || "",
        address: studentData.address || "",
        classId: studentData.classId || "",
        admissionYear: studentData.admissionYear || new Date().getFullYear(),
        grade: studentData.grade || "10",
        status: studentData.status || "active",
        parents: studentData.parents?.length
          ? studentData.parents
          : [{ name: "", phone: "", occupation: "", relation: "father" }],
      });
    }
  }, [studentData, form]);

  const handleSubmit = async (data: StudentFormData) => {
    setIsLoading(true);
    try {
      onSubmit(data);
      toast({
        title: studentData ? "Cập nhật thành công" : "Thêm học sinh thành công",
        description: `Học sinh ${data.name} đã được ${
          studentData ? "cập nhật" : "thêm"
        }.`,
      });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Có lỗi xảy ra",
        description: "Vui lòng thử lại sau.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {studentData ? "Chỉnh sửa thông tin học sinh" : "Thêm học sinh mới"}
          </DialogTitle>
          <DialogDescription>
            {studentData
              ? "Cập nhật thông tin học sinh"
              : "Nhập thông tin để thêm học sinh mới"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* 🔹 Họ tên & Lớp */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Họ và tên *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập họ và tên" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lớp (lọc theo khối)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn lớp" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredClasses.length > 0 ? (
                          filteredClasses.map((cls) => (
                            <SelectItem key={cls._id} value={cls._id}>
                              {cls.className} - Khối {cls.grade}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            Không có lớp nào
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 🔹 Khối & Giới tính */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Khối</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn khối" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="11">11</SelectItem>
                        <SelectItem value="12">12</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giới tính</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn giới tính" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Nam</SelectItem>
                        <SelectItem value="female">Nữ</SelectItem>
                        <SelectItem value="other">Khác</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Địa chỉ</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Nhập địa chỉ" className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="admissionYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Năm nhập học</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Khối</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn khối" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                            
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="11">11</SelectItem>
                            <SelectItem value="12">12</SelectItem>
                            <SelectItem value="none">Chưa chọn</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trạng thái</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn trạng thái" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Đang học</SelectItem>
                        <SelectItem value="inactive">Ngừng học</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Thông tin phụ huynh */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Thông tin phụ huynh</h4>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name={`parents.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Họ tên</FormLabel>
                        <FormControl>
                          <Input placeholder="Tên phụ huynh" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`parents.${index}.phone`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SĐT</FormLabel>
                        <FormControl>
                          <Input placeholder="0987654321" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`parents.${index}.occupation`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nghề nghiệp</FormLabel>
                        <FormControl>
                          <Input placeholder="Nghề nghiệp" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`parents.${index}.relation`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quan hệ</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="father">Cha</SelectItem>
                            <SelectItem value="mother">Mẹ</SelectItem>
                            <SelectItem value="guardian">Người giám hộ</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-6"
                    onClick={() => remove(index)}
                  >
                    ❌
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({ name: "", phone: "", occupation: "", relation: "guardian" })
                }
              >
                ➕ Thêm phụ huynh
              </Button>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Đang xử lý..." : studentData ? "Cập nhật" : "Thêm học sinh"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
