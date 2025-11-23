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
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

// ✅ Zod schema khớp với backend Mongoose
// ✅ Lưu ý: dayOfWeek, timeSlot, isPermanent, startDate, endDate được lưu trong ScheduleConfig.ActivitySlot, không lưu trong Activity
const activitySchema = z.object({
  name: z.string().min(1, 'Tên hoạt động là bắt buộc'),
  type: z.enum(['weekly', 'special'], { required_error: 'Chọn loại hoạt động' }),
  description: z.string().optional(),
  grades: z.array(z.enum(['10', '11', '12'])).nonempty('Chọn ít nhất 1 khối'),
  isActive: z.boolean().default(true),
});

type ActivityFormData = z.infer<typeof activitySchema>;

interface ActivityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId?: string; // ✅ ID hoạt động để load dữ liệu khi edit
  activityData?: ActivityFormData; // ✅ Hoặc truyền trực tiếp dữ liệu
  onSubmit: (data: ActivityFormData) => Promise<void>;
}

export const ActivityForm = ({ open, onOpenChange, activityId, activityData, onSubmit }: ActivityFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      name: '',
      description: '',
      grades: [],
      isActive: true,
    },
  });

  // ✅ Load dữ liệu khi có activityId
  useEffect(() => {
    const loadActivityData = async () => {
      if (activityId && open) {
        setLoadingData(true);
        try {
          const { activityApi } = await import('@/services/activityApi');
          const data = await activityApi.getById(activityId);
          form.reset({
            name: data.name || '',
            type: data.type || 'weekly',
            description: data.description || '',
            grades: (data.grades || []) as ("10" | "11" | "12")[],
            isActive: data.isActive !== undefined ? data.isActive : true,
          });
        } catch (error) {
          toast({
            title: 'Lỗi',
            description: 'Không thể tải dữ liệu hoạt động',
            variant: 'destructive',
          });
        } finally {
          setLoadingData(false);
        }
      } else if (activityData) {
        // ✅ Nếu có activityData trực tiếp, dùng nó
        form.reset(activityData);
      } else if (open && !activityId) {
        // ✅ Reset form khi mở dialog tạo mới
        form.reset({
          name: '',
          description: '',
          grades: [],
          isActive: true,
        });
      }
    };

    loadActivityData();
  }, [activityId, activityData, open, form, toast]);

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
          <DialogTitle>{activityId || activityData ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động mới'}</DialogTitle>
          <DialogDescription>
            {activityId || activityData ? 'Cập nhật thông tin hoạt động' : 'Nhập thông tin để tạo hoạt động mới'}
          </DialogDescription>
        </DialogHeader>
      <div className="max-h-[65vh] overflow-y-auto pr-2">
        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Đang tải dữ liệu...</p>
          </div>
        ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            {/* ✅ Thông tin cơ bản */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Thông tin cơ bản</h3>
              
              {/* Tên hoạt động */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên hoạt động <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Ví dụ: Chào cờ, Sinh hoạt chủ nhiệm, Hoạt động ngoại khóa..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Loại hoạt động */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loại hoạt động <span className="text-destructive">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn loại hoạt động" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Hàng tuần (Lặp lại mỗi tuần)</SelectItem>
                        <SelectItem value="special">Đặc biệt (Chỉ diễn ra một lần hoặc theo lịch đặc biệt)</SelectItem>
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
                      <Textarea 
                        placeholder="Ghi chú thêm về hoạt động (nếu có)" 
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* ✅ Khối áp dụng */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Khối áp dụng</h3>
              
              {/* Khối áp dụng */}
              <FormField
                control={form.control}
                name="grades"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Khối áp dụng <span className="text-destructive">*</span></FormLabel>
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
                          <FormLabel className="font-normal cursor-pointer">Khối {grade}</FormLabel>
                        </FormItem>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Chọn các khối lớp sẽ áp dụng hoạt động này. Ngày trong tuần, tiết học và thời gian áp dụng sẽ được cấu hình trong Cấu hình thời khóa biểu.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* ✅ Trạng thái */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Trạng thái</h3>
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-normal cursor-pointer">
                        Kích hoạt hoạt động
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Hoạt động sẽ hiển thị và có thể được sử dụng trong hệ thống
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isLoading || loadingData}>
                Hủy
              </Button>
              <Button type="submit" disabled={isLoading || loadingData}>
                {isLoading ? 'Đang xử lý...' : activityId || activityData ? 'Cập nhật' : 'Tạo hoạt động'}
              </Button>
            </DialogFooter>
          </form>
          
        </Form>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
