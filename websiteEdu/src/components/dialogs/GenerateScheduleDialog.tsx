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
import { autoScheduleApi } from "@/services/autoScheduleApi";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSchoolYears } from "@/hooks";

interface GenerateScheduleDialogProps {
  onGenerate?: (grades: string[], year: string, semester: string) => void;
  currentYear?: string;
  currentSemester?: string;
  onSuccess?: () => void; // ✅ Callback khi tạo thành công
}

export const GenerateScheduleDialog = ({
  onGenerate,
  currentYear,
  currentSemester,
  onSuccess,
}: GenerateScheduleDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear || "");
  const [selectedSemester, setSelectedSemester] = useState<string>(currentSemester || "1");
  const [isValidating, setIsValidating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  
  // ✅ Lấy danh sách năm học từ API
  const { schoolYears, isLoading: isLoadingYears } = useSchoolYears();

  const toggleGrade = (grade: string) => {
    setSelectedGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
  };

  // ✅ Khi dialog mở hoặc currentYear thay đổi, cập nhật giá trị
  useEffect(() => {
    if (!selectedYear && currentYear) {
      setSelectedYear(currentYear);
    } else if (!selectedYear && schoolYears.length > 0) {
      // ✅ Ưu tiên lấy năm học active, nếu không có thì lấy năm học đầu tiên
      const activeYear = schoolYears.find((y: any) => y.isActive) || schoolYears[0];
      if (activeYear) {
        setSelectedYear(activeYear.code);
      } else {
        // Fallback: Tự tính năm học hiện tại
        const year = new Date().getFullYear();
        setSelectedYear(`${year - 1}-${year}`);
      }
    }
    if (currentSemester) {
      setSelectedSemester(currentSemester);
    }
  }, [currentYear, currentSemester, schoolYears]);

  // ✅ Reset validation khi đóng dialog
  useEffect(() => {
    if (!open) {
      setValidationResult(null);
    }
  }, [open]);

  // ✅ Kiểm tra điều kiện trước khi tạo
  const handleValidate = async () => {
    if (selectedGrades.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 khối!");
      return;
    }
    if (!selectedYear) {
      toast.error("Vui lòng chọn năm học!");
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await autoScheduleApi.validateBeforeGenerate(
        selectedGrades,
        selectedYear,
        selectedSemester
      );
      setValidationResult(result);

      if (result.valid) {
        toast.success("Điều kiện hợp lệ! Bạn có thể tạo lịch.");
      } else {
        toast.warning("Có một số điều kiện chưa đáp ứng. Vui lòng kiểm tra.");
      }
    } catch (error: any) {
      console.error("❌ Lỗi khi kiểm tra điều kiện:", error);
      toast.error(`Lỗi: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  // ✅ Tạo lịch tự động
  const handleGenerate = async () => {
    if (selectedGrades.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 khối!");
      return;
    }
    if (!selectedYear) {
      toast.error("Vui lòng chọn năm học!");
      return;
    }

    // ✅ Nếu có callback cũ, gọi nó
    if (onGenerate) {
      onGenerate(selectedGrades, selectedYear, selectedSemester);
      setOpen(false);
      return;
    }

    setIsGenerating(true);

    try {
      const result = await autoScheduleApi.generateSchedule(
        selectedGrades,
        selectedYear,
        selectedSemester
      );

      toast.success(
        result.message || `Đã tạo thời khóa biểu cho ${result.schedules?.length || 0} lớp`
      );

      // ✅ Gọi callback khi thành công
      if (onSuccess) {
        onSuccess();
      }

      setOpen(false);
    } catch (error: any) {
      console.error("❌ Lỗi khi tạo lịch:", error);
      toast.error(`Lỗi: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ Lấy danh sách năm học từ API (đã được load từ hook)
  const yearOptions = schoolYears.map((y: any) => ({
    code: y.code,
    name: y.name || y.code,
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>📅 Tạo lịch tự động</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chọn khối, năm học và học kỳ để tạo lịch</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Chọn khối */}
          <div className="flex flex-col gap-2">
            <p className="font-semibold">Chọn khối:</p>
            <div className="flex gap-4">
              {["10", "11", "12"].map((grade) => (
                <label key={grade} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    value={grade}
                    checked={selectedGrades.includes(grade)}
                    onChange={() => toggleGrade(grade)}
                    className="w-4 h-4"
                  />
                  <span>Khối {grade}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Chọn năm học & học kỳ */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Năm học:</label>
              {isLoadingYears ? (
                <div className="w-full border rounded px-3 py-2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Đang tải...</span>
                </div>
              ) : (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  disabled={yearOptions.length === 0}
                >
                  {yearOptions.length === 0 ? (
                    <option value="">Chưa có năm học</option>
                  ) : (
                    yearOptions.map((year) => (
                      <option key={year.code} value={year.code}>
                        {year.name}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Học kỳ:</label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="1">Học kỳ 1</option>
                <option value="2">Học kỳ 2</option>
              </select>
            </div>
          </div>

          {/* Kết quả validation */}
          {validationResult && (
            <div className="space-y-2">
              {validationResult.valid ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    ✅ Tất cả điều kiện đã đáp ứng. Bạn có thể tạo lịch.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    ⚠️ Có {validationResult.errors?.length || 0} lỗi cần khắc phục trước khi tạo lịch.
                  </AlertDescription>
                </Alert>
              )}

              {validationResult.errors && validationResult.errors.length > 0 && (
                <div className="text-sm text-red-600 space-y-1">
                  <p className="font-semibold">Lỗi:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.errors.map((error: any, idx: number) => (
                      <li key={idx}>{error.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationResult.warnings && validationResult.warnings.length > 0 && (
                <div className="text-sm text-orange-600 space-y-1">
                  <p className="font-semibold">Cảnh báo:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.warnings.map((warning: any, idx: number) => (
                      <li key={idx}>{warning.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 mt-4">
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={isValidating || isGenerating || selectedGrades.length === 0 || !selectedYear}
          >
            {isValidating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang kiểm tra...
              </>
            ) : (
              "Kiểm tra điều kiện"
            )}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || isValidating || selectedGrades.length === 0 || !selectedYear}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tạo lịch...
              </>
            ) : (
              "Tạo lịch"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
