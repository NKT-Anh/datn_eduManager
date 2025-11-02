import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

interface GenerateScheduleDialogProps {
  onGenerate: (grades: string[], year: string, semester: string) => void;
  currentYear: string;
  currentSemester: string;
}

export const GenerateScheduleDialog = ({
  onGenerate,
  currentYear,
  currentSemester,
}: GenerateScheduleDialogProps) => {
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear || "");
  const [selectedSemester, setSelectedSemester] = useState<string>(currentSemester || "1");

  const toggleGrade = (grade: string) => {
    setSelectedGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
  };

  // ✅ Khi dialog mở hoặc currentYear thay đổi, cập nhật giá trị
  useEffect(() => {
    if (!selectedYear) {
      const year = new Date().getFullYear();
      setSelectedYear(`${year - 1}-${year}`);
    }
  }, []);

  const handleConfirm = () => {
    if (selectedGrades.length === 0) return alert("Chọn ít nhất 1 khối!");
    if (!selectedYear) return alert("Chưa chọn năm học!");
    onGenerate(selectedGrades, selectedYear, selectedSemester);
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - i;
    return `${year - 1}-${year}`;
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>📅 Tạo lịch tự động</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Chọn khối, năm học và học kỳ để tạo lịch</DialogTitle>
        </DialogHeader>

        {/* Chọn khối */}
        <div className="flex flex-col gap-2 mt-2">
          <p className="font-semibold">Chọn khối:</p>
          {["10", "11", "12"].map((grade) => (
            <label key={grade} className="flex items-center gap-2">
              <input
                type="checkbox"
                value={grade}
                checked={selectedGrades.includes(grade)}
                onChange={() => toggleGrade(grade)}
              />
              Khối {grade}
            </label>
          ))}
        </div>

        {/* Chọn năm học & học kỳ */}
        <div className="mt-4 flex flex-col gap-2">
          <label className="flex items-center gap-2">
            Năm học:
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border rounded px-2 py-1"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            Học kỳ:
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="1">HK 1</option>
              <option value="2">HK 2</option>
            </select>
          </label>
        </div>

        <DialogFooter>
          <Button onClick={handleConfirm}>Tạo lịch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
