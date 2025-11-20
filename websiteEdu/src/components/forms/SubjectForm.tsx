import { useEffect, useState } from 'react';
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
import { Subject } from '@/types/class';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';

const subjectSchema = z.object({
  name: z.string().min(1, 'Tên môn học là bắt buộc'),
  code: z.string().min(1, 'Mã môn học là bắt buộc').max(10, 'Mã môn học tối đa 10 ký tự'),
  grades: z.array(z.enum(['10', '11', '12'])).nonempty('Chọn ít nhất 1 khối'),
  isActive: z.boolean().default(true),
});

type SubjectFormData = z.infer<typeof subjectSchema>;

interface SubjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectData?: Subject;
  onSubmit: (data: SubjectFormData) => void;
}

export const SubjectForm = ({ open, onOpenChange, subjectData, onSubmit }: SubjectFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SubjectFormData>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      name: subjectData?.name || '',
      code: subjectData?.code || '',
      grades: subjectData?.grades || [],
      isActive: subjectData?.isActive !== undefined ? subjectData.isActive : true,
    },
  });
   useEffect(() => {
    if (subjectData) {
      form.reset({
        name: subjectData.name,
        code: subjectData.code,
        grades: subjectData.grades || [],
        isActive: subjectData.isActive !== undefined ? subjectData.isActive : true,
      });
    } else {
      form.reset({
        name: '',
        code: '',
        grades: [],
        isActive: true,
      });
    }
  }, [subjectData, form]);
  

  const handleSubmit = async (data: SubjectFormData) => {
    setIsLoading(true);
    try {
      onSubmit(data);
      toast({
        title: subjectData ? 'Cập nhật thành công' : 'Tạo môn học thành công',
        description: `Môn ${data.name} đã được ${subjectData ? 'cập nhật' : 'tạo'}.`,
      });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Có lỗi xảy ra',
        description: 'Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {subjectData ? 'Chỉnh sửa môn học' : 'Tạo môn học mới'}
          </DialogTitle>
          <DialogDescription>
            {subjectData ? 'Cập nhật thông tin môn học' : 'Nhập thông tin để tạo môn học mới'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Tên môn học */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên môn học</FormLabel>
                  <FormControl>
                    <Input placeholder="Ví dụ: Toán học, Ngữ văn..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Mã môn học */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã môn học</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ví dụ: TOAN, NGUVAN..."
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value
                          .toUpperCase()
                           .normalize("NFD")   
                           .replace(/[\u0300-\u036f]/g, "") 
                          .replace(/[^A-Z]/g, "")
                          .substring(0, 10);
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Khối học */}
              <FormField
              control={form.control}
              name="grades"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Khối</FormLabel>
                  <div className="flex gap-4">
                    {['10', '11', '12'].map((grade) => (
                      <FormItem key={grade} className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value.includes(grade as any)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, grade]);
                              } else {
                                field.onChange(field.value.filter((v) => v !== grade));
                              }
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">Khối {grade}</FormLabel>
                      </FormItem>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Trạng thái hoạt động */}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Trạng thái hoạt động</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Môn học {field.value ? 'đang được dạy' : 'đã ngừng dạy'}
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Footer */}
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
                {isLoading ? 'Đang xử lý...' : subjectData ? 'Cập nhật' : 'Tạo môn học'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
