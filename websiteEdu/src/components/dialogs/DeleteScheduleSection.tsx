import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { scheduleApi } from "@/services/scheduleApi";

interface DeleteScheduleDialogProps {
  onDeleted?: () => void;
  disabled?: boolean;
  defaultYear?: string;
  defaultSemester?: string;
  defaultGrade?: string;
}

export default function DeleteScheduleDialog({
  onDeleted,
  disabled = false,
  defaultYear = "",
  defaultSemester = "1",
  defaultGrade = "10",
}: DeleteScheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(defaultYear);
  const [semester, setSemester] = useState(defaultSemester);
  const [grade, setGrade] = useState(defaultGrade);
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    setYear(defaultYear);
    setSemester(defaultSemester);
    setGrade(defaultGrade);
  }, [defaultYear, defaultSemester, defaultGrade]);

  const handleDelete = async () => {
    if (!year || !semester || !grade) {
      alert("Vui lòng nhập đầy đủ năm học, học kỳ và khối.");
      return;
    }
    try {
      setIsDeleting(true);
      await scheduleApi.deleteByGradeYearSemester(year, semester, grade);
      alert(`Đã xóa TKB của khối ${grade} năm ${year} học kỳ ${semester} thành công!`);
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      console.error(err);
      alert("Xảy ra lỗi khi xóa TKB.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Button 
        variant="destructive" 
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? "Thời khóa biểu đã khóa. Vui lòng mở khóa trước khi xóa." : ""}
      >
        Xóa toàn bộ TKB
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa thời khóa biểu</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-2">
            <div>
              <label className="font-semibold mr-2">Năm học:</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Ví dụ: 2025-2026"
                className="border rounded px-2 py-1 w-full"
              />
            </div>

            <div>
              <label className="font-semibold mr-2">Học kỳ:</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="1">HK 1</option>
                <option value="2">HK 2</option>
              </select>
            </div>

            <div>
              <label className="font-semibold mr-2">Khối:</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="10">Khối 10</option>
                <option value="11">Khối 11</option>
                <option value="12">Khối 12</option>
              </select>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Đang xóa..." : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
