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

interface AutoAssignHomeroomTeacherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reassignAll: boolean) => void;
}

export const AutoAssignHomeroomTeacherDialog = ({
  open,
  onOpenChange,
  onConfirm,
}: AutoAssignHomeroomTeacherDialogProps) => {
  const [assignMode, setAssignMode] = useState<'new' | 'all'>('new');

  const handleConfirm = () => {
    onConfirm(assignMode === 'all');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tự động gán giáo viên chủ nhiệm</DialogTitle>
          <DialogDescription>
            Chọn cách phân giáo viên chủ nhiệm cho các lớp học
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground mb-4">
            <p className="font-medium mb-2">Quy tắc gán:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ưu tiên giáo viên dạy môn Văn hoặc Toán</li>
              <li>GVCN không được chủ nhiệm 2 lớp cùng năm học</li>
              <li>Chỉ gán giáo viên dạy đúng khối</li>
            </ul>
          </div>

          <RadioGroup value={assignMode} onValueChange={(value) => setAssignMode(value as 'new' | 'all')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new" />
              <Label htmlFor="new" className="cursor-pointer">
                <div>
                  <div className="font-medium">Chỉ phân các lớp chưa có GVCN</div>
                  <div className="text-sm text-muted-foreground">
                    Chỉ gán GVCN cho các lớp chưa được gán giáo viên chủ nhiệm
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
                    Gán lại GVCN cho tất cả lớp (kể cả lớp đã có GVCN)
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
















