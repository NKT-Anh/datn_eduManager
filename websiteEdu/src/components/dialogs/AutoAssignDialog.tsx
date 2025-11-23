import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from "@/components/ui/select";

import { autoAssignTeaching, payloadsToAssignments } from "@/services/smartSystem/autoAssignTeaching";
import { ClassType, Subject, TeachingAssignment, TeachingAssignmentPayload } from "@/types/class";
import { Teacher } from "@/types/auth";

interface AutoAssignDialogProps {
open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ClassType[];
  subjects: Subject[];
  teachers: Teacher[];
  existingAssignments: TeachingAssignment[];
  onFinish: (newAssignments: TeachingAssignmentPayload[]) => void;
}

export function AutoAssignDialog({
    open,
    onOpenChange,
  classes,
  subjects,
  teachers,
  existingAssignments,
  onFinish
}:  AutoAssignDialogProps) {
  const [year, setYear] = useState("2024-2025");
  const [semester, setSemester] = useState<"1" | "2">("1");
  const [grades, setGrades] = useState<string[]>(["10"]);

  const handleSubmit = () => {
    const result = autoAssignTeaching(classes, subjects, teachers, existingAssignments, year, semester, grades);
    onFinish(result);
    onOpenChange(false);
  };

  return (
    <>
      

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thiết lập thông tin phân công</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div>
              <label className="block mb-1 text-sm font-medium">Năm học</label>
              <Input value={year} onChange={e => setYear(e.target.value)} placeholder="VD: 2024-2025" />
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium">Học kỳ</label>
              <Select value={semester} onValueChange={v => setSemester(v as "1" | "2")}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn học kỳ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Học kỳ 1</SelectItem>
                  <SelectItem value="2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
            <label className="block mb-1 text-sm font-medium">Khối</label>
            <div className="flex gap-4">
                {["10", "11", "12"].map((grade) => (
                <label key={grade} className="flex items-center space-x-2">
                    <input
                    type="checkbox"
                    checked={grades.includes(grade)}
                    onChange={(e) => {
                        if (e.target.checked) {
                        setGrades((prev) => [...prev, grade]);
                        } else {
                        setGrades((prev) => prev.filter((g) => g !== grade));
                        }
                    }}
                    />
                    <span>Khối {grade}</span>
                </label>
                ))}
            </div>
            </div>
            </div>


          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button onClick={handleSubmit}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
