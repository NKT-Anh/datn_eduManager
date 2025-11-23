import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClassType } from '@/types/class';
import { Teacher } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';
import { teacherApi } from '@/services/teacherApi';
import { roomApi, Room } from '@/services/roomApi';

const classSchema = z.object({
  className: z.string().min(1, 'Tên lớp là bắt buộc'),
  grade: z.enum(['10', '11', '12']),
  teacherId: z.string().optional(),
  capacity: z.number().min(1, 'Sức chứa phải lớn hơn 0'),
  year: z.string().optional(),
  roomId: z.string().optional(),
});

type ClassFormData = z.infer<typeof classSchema>;

interface ClassFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData?: ClassType;
  onSubmit: (data: Omit<ClassFormData, '_id'>) => void;
}

const getCurrentSchoolYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

export const ClassForm = ({ open, onOpenChange, classData, onSubmit }: ClassFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const form = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      className: '',
      grade: '10',
      teacherId: '',
      capacity: 45,
      year: getCurrentSchoolYear(),
      roomId: '',
    },
  });

  // ✅ Load danh sách GV và phòng
  useEffect(() => {
    teacherApi.getAll().then(setTeachers).catch(console.error);
    // Chỉ lấy phòng học bình thường (type = 'normal')
    roomApi.getAll({ status: 'available', type: 'normal' }).then(setRooms).catch(console.error);
  }, []);

  // ✅ Reset lại form khi classData thay đổi (fix lỗi khi chỉnh sửa)
  useEffect(() => {
    if (classData && teachers.length > 0) {
      form.reset({
        className: classData.className,
        grade: classData.grade,
        teacherId: classData.teacherId?._id || '',
        capacity: classData.capacity,
        year: classData.year || getCurrentSchoolYear(),
        roomId: (classData.roomId as any)?._id || (typeof classData.roomId === 'string' ? classData.roomId : '') || '',
      });
    } else {
      form.reset({
        className: '',
        grade: '10',
        teacherId: '',
        capacity: 45,
        year: getCurrentSchoolYear(),
        roomId: '',
      });
    }
  }, [classData, teachers, form]);

  const handleSubmit = async (data: ClassFormData) => {
    setIsLoading(true);
    try {
      // Lấy danh sách lớp để kiểm tra trùng
      const allClasses = await fetch(`${import.meta.env.VITE_API_BASE_URL}/class`).then((r) => r.json());

      // ✅ Kiểm tra trùng tên lớp trong cùng năm học và khối
      const duplicateName = allClasses.find(
        (cls: ClassType) =>
          cls.className === data.className &&
          cls.year === data.year &&
          cls.grade === data.grade &&
          (!classData || cls._id !== classData._id)
      );

      if (duplicateName) {
        toast({
          title: 'Tên lớp đã tồn tại',
          description: `Tên lớp "${data.className}" đã tồn tại trong khối ${data.grade} năm học ${data.year}.`,
          variant: 'destructive',
        });
        setIsLoading(false);
        return; // ❌ Dừng submit
      }

      // ✅ Kiểm tra giáo viên đã làm GVCN lớp khác
      if (data.teacherId) {
        const conflict = allClasses.find(
          (cls: ClassType) =>
            cls.teacherId?._id === data.teacherId &&
            cls.year === data.year &&
            (!classData || cls._id !== classData._id)
        );

        if (conflict) {
          toast({
            title: 'Giáo viên đã làm GVCN lớp khác',
            description: `Giáo viên này đã là GVCN lớp ${conflict.className} (${conflict.year}).`,
            variant: 'destructive',
          });
          setIsLoading(false);
          return; // ❌ Dừng submit
        }
      }

      await onSubmit(data);
      toast({
        title: classData ? 'Cập nhật thành công' : 'Tạo lớp thành công',
        description: `Lớp ${data.className} đã được ${classData ? 'cập nhật' : 'tạo'}.`,
      });
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Có lỗi xảy ra',
        description: error?.response?.data?.message || 'Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{classData ? 'Chỉnh sửa lớp' : 'Tạo lớp mới'}</DialogTitle>
          <DialogDescription>
            {classData ? 'Cập nhật thông tin lớp học' : 'Nhập thông tin lớp học mới'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="className"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên lớp</FormLabel>
                  <FormControl>
                    <Input placeholder="Ví dụ: 10A1" {...field} />
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn khối" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="10">Khối 10</SelectItem>
                      <SelectItem value="11">Khối 11</SelectItem>
                      <SelectItem value="12">Khối 12</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="teacherId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giáo viên chủ nhiệm</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Không chọn" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {teachers.map((t) => (
                        <SelectItem key={t._id} value={t._id}>
                          {t.name}
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
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sức chứa</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Năm học</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phòng học</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)} 
                    value={field.value || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Không chọn phòng" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Không chọn phòng</SelectItem>
                      {rooms.map((room) => (
                        <SelectItem key={room._id} value={room._id || 'none'}>
                          {room.roomCode} {room.name ? `- ${room.name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {isLoading ? 'Đang xử lý...' : classData ? 'Cập nhật' : 'Tạo lớp'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
