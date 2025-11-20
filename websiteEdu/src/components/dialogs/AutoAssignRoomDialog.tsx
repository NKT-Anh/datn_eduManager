import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface AutoAssignRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reassignAll: boolean) => void;
}

export const AutoAssignRoomDialog = ({
  open,
  onOpenChange,
  onConfirm,
}: AutoAssignRoomDialogProps) => {
  const [assignMode, setAssignMode] = useState<'new' | 'all'>('new');

  const handleConfirm = () => {
    onConfirm(assignMode === 'all');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tự động gán phòng</DialogTitle>
          <DialogDescription>
            Chọn cách phân phòng cho các lớp học
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={assignMode} onValueChange={(value) => setAssignMode(value as 'new' | 'all')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new" />
              <Label htmlFor="new" className="cursor-pointer">
                <div>
                  <div className="font-medium">Chỉ phân các lớp chưa có phòng</div>
                  <div className="text-sm text-muted-foreground">
                    Chỉ gán phòng cho các lớp chưa được gán phòng
                  </div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all" className="cursor-pointer">
                <div>
                  <div className="font-medium">Phân lại toàn bộ</div>
                  <div className="text-sm text-muted-foreground">
                    Gán lại phòng cho tất cả lớp (kể cả lớp đã có phòng)
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleConfirm}>
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};















