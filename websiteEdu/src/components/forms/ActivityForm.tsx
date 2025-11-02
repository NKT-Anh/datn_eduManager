import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
const days = [
  { label: "Thứ 2", value: "mon" },
  { label: "Thứ 3", value: "tue" },
  { label: "Thứ 4", value: "wed" },
  { label: "Thứ 5", value: "thu" },
  { label: "Thứ 6", value: "fri" },
  { label: "Thứ 7", value: "sat" },
  { label: "Chủ nhật", value: "sun" },
];
// ✅ Zod schema khớp với backend Mongoose
const activitySchema = z.object({
  name: z.string().min(1, 'Tên hoạt động là bắt buộc'),
  type: z.enum(['weekly', 'special'], { required_error: 'Chọn loại hoạt động' }), // 🆕
  description: z.string().optional(),
  grades: z.array(z.enum(['10', '11', '12'])).nonempty('Chọn ít nhất 1 khối'),
  dayOfWeek: z.string().optional(), // Monday, Tuesday, ...
  timeSlot: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v ? String(v) : undefined)),
  startDate: z.string().min(1, 'Chọn ngày bắt đầu'),
  endDate: z.string().min(1, 'Chọn ngày kết thúc'),
  isActive: z.boolean().default(true),
});

type ActivityFormData = z.infer<typeof activitySchema>;

interface ActivityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityData?: ActivityFormData;
  onSubmit: (data: ActivityFormData) => Promise<void>;
}

export const ActivityForm = ({ open, onOpenChange, activityData, onSubmit }: ActivityFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      name: '',
      description: '',
      grades: [],
      dayOfWeek: '',
      timeSlot: '',
      startDate: '',
      endDate: '',
      isActive: true,
      ...activityData,
    },
  });

  useEffect(() => {
    if (activityData) form.reset(activityData);
  }, [activityData, form]);

  const handleSubmit = async (data: ActivityFormData) => {
    setIsLoading(true);
    try {
      await onSubmit(data);
      toast({
        title: activityData ? 'Cập nhật hoạt động' : 'Tạo hoạt động thành công',
        description: `${data.name} đã được lưu.`,
      });
      onOpenChange(false);
      form.reset();
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
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{activityData ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động mới'}</DialogTitle>
          <DialogDescription>
            {activityData ? 'Cập nhật thông tin hoạt động' : 'Nhập thông tin để tạo hoạt động mới'}
          </DialogDescription>
        </DialogHeader>
      <div className="max-h-[65vh] overflow-y-auto pr-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Tên hoạt động */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên hoạt động</FormLabel>
                  <FormControl>
                    <Input placeholder="Ví dụ: Chào cờ, Sinh hoạt chủ nhiệm..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
  control={form.control}
  name="type"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Loại hoạt động</FormLabel>
      <Select value={field.value} onValueChange={field.onChange}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Chọn loại hoạt động" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="weekly">Hàng tuần</SelectItem>
          <SelectItem value="special">Đặc biệt</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>

            {/* Mô tả */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mô tả</FormLabel>
                  <FormControl>
                    <Input placeholder="Ghi chú thêm (nếu có)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

             {/* Khối áp dụng */}
            <FormField
              control={form.control}
              name="grades"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Khối áp dụng</FormLabel>
                  <div className="flex gap-4">
                    {['10', '11', '12'].map((grade) => (
                      <FormItem key={grade} className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value.includes(grade as any)}
                            onCheckedChange={(checked) => {
                              if (checked) field.onChange([...field.value, grade]);
                              else field.onChange(field.value.filter((v) => v !== grade));
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

            {/* Ngày trong tuần */}
            <FormField
              control={form.control}
              name="dayOfWeek"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày trong tuần</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn ngày trong tuần" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {days.map((day) => (
                        <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tiết học */}
            <FormField
              control={form.control}
              name="timeSlot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tiết học</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Ví dụ: Tiết 1, 07:00 - 07:45"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Ngày bắt đầu */}
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày bắt đầu</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ngày kết thúc */}
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày kết thúc</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Trạng thái */}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">Hoạt động đang kích hoạt</FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Hủy
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Đang xử lý...' : activityData ? 'Cập nhật' : 'Tạo hoạt động'}
              </Button>
            </DialogFooter>
          </form>
          
        </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
