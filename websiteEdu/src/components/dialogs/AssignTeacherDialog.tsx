import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Teacher } from '@/types/auth';
import { ClassType } from '@/types/class';
import { teacherApi } from '@/services/teacherApi';
import { useToast } from '@/hooks/use-toast';

interface AssignTeacherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classItem: ClassType | null;
  onSuccess: () => void;
}

export const AssignTeacherDialog = ({
  open,
  onOpenChange,
  classItem,
  onSuccess,
}: AssignTeacherDialogProps) => {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('none');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      teacherApi.getAll().then(setTeachers).catch(console.error);
      // Set giáo viên hiện tại nếu có
      if (classItem?.teacherId) {
        const teacherId = typeof classItem.teacherId === 'string' 
          ? classItem.teacherId 
          : (classItem.teacherId as any)?._id;
        setSelectedTeacherId(teacherId || 'none');
      } else {
        setSelectedTeacherId('none');
      }
    }
  }, [open, classItem]);

  const handleSubmit = async () => {
    if (!classItem) return;

    setIsLoading(true);
    try {
      const { classApi } = await import('@/services/classApi');
      await classApi.update(classItem._id, {
        teacherId: selectedTeacherId === 'none' ? null : selectedTeacherId,
      });

      toast({
        title: '✅ Thành công',
        description: `Đã ${selectedTeacherId !== 'none' ? 'gán' : 'gỡ'} giáo viên chủ nhiệm cho lớp ${classItem.className}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: '❌ Lỗi',
        description: error.response?.data?.message || 'Không thể gán giáo viên chủ nhiệm',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gán giáo viên chủ nhiệm</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Lớp</Label>
            <div className="mt-1 p-2 bg-muted rounded-md">
              <span className="font-medium">{classItem?.className}</span>
              <span className="text-sm text-muted-foreground ml-2">
                (Khối {classItem?.grade} - {classItem?.year})
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor="teacher">Giáo viên chủ nhiệm</Label>
            <Select
              value={selectedTeacherId || 'none'}
              onValueChange={setSelectedTeacherId}
            >
              <SelectTrigger id="teacher" className="mt-1">
                <SelectValue placeholder="Chọn giáo viên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không chọn</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher._id} value={teacher._id || 'none'}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Đang xử lý...' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

