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
import { Room } from '@/services/roomApi';
import { ClassType } from '@/types/class';
import { roomApi } from '@/services/roomApi';
import { useToast } from '@/hooks/use-toast';

interface AssignRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classItem: ClassType | null;
  onSuccess: () => void;
}

export const AssignRoomDialog = ({
  open,
  onOpenChange,
  classItem,
  onSuccess,
}: AssignRoomDialogProps) => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('none');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Chỉ lấy phòng học bình thường (type = 'normal')
      roomApi.getAll({ status: 'available', type: 'normal' }).then(setRooms).catch(console.error);
      // Set phòng hiện tại nếu có
      if (classItem?.roomId) {
        const roomId = typeof classItem.roomId === 'string' 
          ? classItem.roomId 
          : (classItem.roomId as any)?._id;
        setSelectedRoomId(roomId || 'none');
      } else {
        setSelectedRoomId('none');
      }
    }
  }, [open, classItem]);

  const handleSubmit = async () => {
    if (!classItem) return;

    setIsLoading(true);
    try {
      const { classApi } = await import('@/services/classApi');
      await classApi.assignRoom(
        classItem._id,
        selectedRoomId === 'none' ? null : selectedRoomId
      );

      toast({
        title: '✅ Thành công',
        description: `Đã ${selectedRoomId !== 'none' ? 'gán' : 'gỡ'} phòng học cho lớp ${classItem.className}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: '❌ Lỗi',
        description: error.response?.data?.message || 'Không thể gán phòng học',
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
          <DialogTitle>Gán phòng học</DialogTitle>
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
            <Label htmlFor="room">Phòng học</Label>
            <Select
              value={selectedRoomId || 'none'}
              onValueChange={setSelectedRoomId}
            >
              <SelectTrigger id="room" className="mt-1">
                <SelectValue placeholder="Chọn phòng học" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không chọn phòng</SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room._id} value={room._id || 'none'}>
                    {room.roomCode} {room.name ? `- ${room.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              💡 Một phòng có thể gán cho nhiều lớp (khác buổi sáng/chiều)
            </p>
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


