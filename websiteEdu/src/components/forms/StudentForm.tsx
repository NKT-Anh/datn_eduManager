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
import { classApiNoToken } from "@/services/classApi";
import settingApi from "@/services/settingApi"; // nhớ import ở đầu file

/* =========================================================
   🧩 ZOD SCHEMA — đồng bộ với StudentCreatePayload
========================================================= */
const studentSchema = z.object({
  name: z.string().min(1, "Họ tên là bắt buộc"),
  studentCode: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  classId: z.string().optional(),
  admissionYear: z.number().min(2000, "Năm nhập học không hợp lệ").max(new Date().getFullYear()),
  grade: z.enum(["10", "11", "12"]),
  status: z.enum(["active", "inactive", "graduated", "suspended", "transferred"]).default("active"),

  // 🆕 Thông tin mở rộng
  ethnic: z.string().optional(),
  religion: z.string().optional(),
  idNumber: z.string().optional(),
  birthPlace: z.string().optional(),
  hometown: z.string().optional(),
  avatarUrl: z.string().optional(),
  note: z.string().optional(),

  // 🧒 Phụ huynh
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
  studentData?: Partial<StudentCreatePayload>;
  onSubmit: (data: StudentCreatePayload) => void;
}

/* =========================================================
   🧱 COMPONENT
========================================================= */
export const StudentForm = ({ open, onOpenChange, studentData, onSubmit }: StudentFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [classList, setClassList] = useState<{ _id: string; className: string; grade: string }[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<typeof classList>([]);

  /* =========================================================
     ⚙️ Form setup
  ========================================================== */
  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: studentData?.name || "",
      studentCode: studentData?.studentCode || "",
      classId: studentData?.classId || "",
      dob: studentData?.dob || "",
      gender: studentData?.gender || "male",
      phone: studentData?.phone || "",
      address: studentData?.address || "",
      admissionYear: studentData?.admissionYear || new Date().getFullYear(),
      grade: studentData?.grade || "10",
      status: studentData?.status || "active",
      ethnic: studentData?.ethnic || "",
      religion: studentData?.religion || "",
      idNumber: studentData?.idNumber || "",
      birthPlace: studentData?.birthPlace || "",
      hometown: studentData?.hometown || "",
      avatarUrl: studentData?.avatarUrl || "",
      note: studentData?.note || "",

    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "parents",
  });

  /* =========================================================
     🏫 Load danh sách lớp học
  ========================================================== */
useEffect(() => {
  const fetchClasses = async () => {
    try {
      // 🔹 1️⃣ Lấy năm học hiện tại từ Setting API
      const settings = await settingApi.getSettings();
      const currentYear =
        settings?.currentSchoolYear ||
        `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

      // 🔹 2️⃣ Lọc lớp theo năm học hiện tại
      const res = await classApiNoToken.getAll({ year: currentYear });
      const data = Array.isArray(res) ? res : (res as any).data;

      setClassList(data || []);
    } catch (err) {
      console.error("❌ Lỗi khi tải danh sách lớp:", err);
      toast({
        title: "Lỗi tải lớp học",
        description: "Không thể tải danh sách lớp theo năm học hiện tại.",
        variant: "destructive",
      });
    }
  };

  fetchClasses();
}, [toast]);


  /* =========================================================
     🎯 Lọc lớp theo khối
  ========================================================== */
  useEffect(() => {
    const subscription = form.watch((values) => {
      const filtered = classList.filter((cls) => cls.grade === values.grade);
      setFilteredClasses(filtered);
    });
    return () => subscription.unsubscribe();
  }, [form, classList]);

  /* =========================================================
     🔁 Reset khi chỉnh sửa học sinh
  ========================================================== */
  useEffect(() => {
    if (studentData) {
      form.reset({
        ...studentData,
        dob: studentData.dob ? studentData.dob.split("T")[0] : "",
      });
    }
  }, [studentData, form]);

  /* =========================================================
     💾 Submit
  ========================================================== */
  const handleSubmit = async (data: StudentFormData) => {
    setIsLoading(true);
    try {
      await onSubmit(data as StudentCreatePayload);
      toast({
        title: studentData ? "Cập nhật thành công" : "Thêm học sinh thành công",
        description: `Học sinh ${data.name} đã được ${
          studentData ? "cập nhật" : "thêm"
        } thành công.`,
      });
      form.reset();
      onOpenChange(false);
    } catch {
      toast({
        title: "Có lỗi xảy ra",
        description: "Vui lòng thử lại sau.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /* =========================================================
     🧩 UI
  ========================================================== */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{studentData ? "Chỉnh sửa học sinh" : "Thêm học sinh"}</DialogTitle>
          <DialogDescription>
            {studentData ? "Cập nhật thông tin học sinh" : "Nhập thông tin học sinh mới"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Họ tên + Mã HS */}
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Họ và tên *</FormLabel>
                    <FormControl><Input placeholder="Nguyễn Văn A" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>

            {/* Khối - Lớp - Trạng thái */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Khối</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Chọn khối" /></SelectTrigger>
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
  name="classId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Lớp học</FormLabel>
      <Select
        onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
        value={field.value || ""}
      >
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Chọn lớp hoặc để trống" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="none">— Chưa xếp lớp —</SelectItem>
          {filteredClasses.map((cls) => (
            <SelectItem key={cls._id} value={cls._id}>
              {cls.className}
            </SelectItem>
          ))}
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Đang học</SelectItem>
                        <SelectItem value="inactive">Nghỉ học</SelectItem>
                        <SelectItem value="transferred">Chuyển trường</SelectItem>
                        <SelectItem value="graduated">Đã tốt nghiệp</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Giới tính - Năm nhập học - Ngày sinh */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giới tính</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Chọn giới tính" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Nam</SelectItem>
                        <SelectItem value="female">Nữ</SelectItem>
                        <SelectItem value="other">Khác</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dob"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ngày sinh</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="admissionYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Năm nhập học</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* 🏠 Thông tin cá nhân mở rộng */}
<div className="space-y-4">
  <h4 className="text-sm font-semibold text-foreground">Thông tin cá nhân</h4>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField control={form.control} name="idNumber" render={({ field }) => (
      <FormItem>
        <FormLabel>Số CCCD / CMND</FormLabel>
        <FormControl><Input placeholder="VD: 123456789012" {...field} /></FormControl>
      </FormItem>
    )}/>

    <FormField control={form.control} name="ethnic" render={({ field }) => (
      <FormItem>
        <FormLabel>Dân tộc</FormLabel>
        <FormControl><Input placeholder="VD: Kinh, Hoa, Tày..." {...field} /></FormControl>
      </FormItem>
    )}/>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField control={form.control} name="religion" render={({ field }) => (
      <FormItem>
        <FormLabel>Tôn giáo</FormLabel>
        <FormControl><Input placeholder="VD: Không, Phật giáo, Thiên chúa..." {...field} /></FormControl>
      </FormItem>
    )}/>

    <FormField control={form.control} name="birthPlace" render={({ field }) => (
      <FormItem>
        <FormLabel>Nơi sinh</FormLabel>
        <FormControl><Input placeholder="VD: Bình Dương" {...field} /></FormControl>
      </FormItem>
    )}/>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField control={form.control} name="hometown" render={({ field }) => (
      <FormItem>
        <FormLabel>Quê quán</FormLabel>
        <FormControl><Input placeholder="VD: Nam Định" {...field} /></FormControl>
      </FormItem>
    )}/>

    <FormField control={form.control} name="avatarUrl" render={({ field }) => (
      <FormItem>
        <FormLabel>Ảnh đại diện (URL)</FormLabel>
        <FormControl><Input placeholder="https://..." {...field} /></FormControl>
      </FormItem>
    )}/>
  </div>

  <FormField control={form.control} name="address" render={({ field }) => (
    <FormItem>
      <FormLabel>Địa chỉ</FormLabel>
      <FormControl><Textarea placeholder="Địa chỉ thường trú" {...field} /></FormControl>
    </FormItem>
  )}/>

  <FormField control={form.control} name="note" render={({ field }) => (
    <FormItem>
      <FormLabel>Ghi chú</FormLabel>
      <FormControl><Textarea placeholder="Ghi chú thêm..." {...field} /></FormControl>
    </FormItem>
  )}/>
</div>


            {/* 🧒 Thông tin phụ huynh */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Thông tin phụ huynh</h4>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField control={form.control} name={`parents.${index}.name`} render={({ field }) => (
                    <FormItem><FormLabel>Họ tên</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )}/>
                  <FormField control={form.control} name={`parents.${index}.phone`} render={({ field }) => (
                    <FormItem><FormLabel>Điện thoại</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )}/>
                  <FormField control={form.control} name={`parents.${index}.occupation`} render={({ field }) => (
                    <FormItem><FormLabel>Nghề nghiệp</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )}/>
                  <FormField control={form.control} name={`parents.${index}.relation`} render={({ field }) => (
                    <FormItem><FormLabel>Quan hệ</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="father">Cha</SelectItem>
                          <SelectItem value="mother">Mẹ</SelectItem>
                          <SelectItem value="guardian">Người giám hộ</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}/>
                  <Button variant="ghost" type="button" className="mt-6" onClick={() => remove(index)}>❌</Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ name: "", relation: "guardian" })}
              >
                ➕ Thêm phụ huynh
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Đang lưu..." : studentData ? "Cập nhật" : "Thêm học sinh"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
