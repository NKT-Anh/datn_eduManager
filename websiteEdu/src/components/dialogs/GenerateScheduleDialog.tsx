import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { autoScheduleApi } from "@/services/autoScheduleApi";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSchoolYears } from "@/hooks";

type StatusDialogMode = "loading" | "success";

interface StatusDialogState {
  open: boolean;
  mode: StatusDialogMode;
  title: string;
  description?: string;
}

interface GenerateScheduleDialogProps {
  onGenerate?: (grades: string[], year: string, semester: string) => Promise<void> | void;
  currentYear?: string;
  currentSemester?: string;
  onSuccess?: () => void; // ✅ Callback khi tạo thành công
  customGenerate?: (params: {
    grades: string[];
    year: string;
    semester: string;
    includeActivities: boolean;
  }) => Promise<any>;
  triggerLabel?: string;
  generateButtonText?: string;
}

export const GenerateScheduleDialog = ({
  onGenerate,
  currentYear,
  currentSemester,
  onSuccess,
  customGenerate,
  triggerLabel = "📅 Tạo lịch tự động",
  generateButtonText = "Tạo lịch",
}: GenerateScheduleDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear || "");
  const [selectedSemester, setSelectedSemester] = useState<string>(currentSemester || "1");
  const [includeActivities, setIncludeActivities] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [statusDialog, setStatusDialog] = useState<StatusDialogState>({
    open: false,
    mode: "loading",
    title: "",
    description: "",
  });
  
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

    const targetLabel = `Khối ${selectedGrades.join(", ")} • ${selectedYear} • HK${selectedSemester}`;
    const showLoadingDialog = (message?: string) => {
      setStatusDialog({
        open: true,
        mode: "loading",
        title: message || "Đang tạo thời khóa biểu...",
        description: targetLabel,
      });
    };
    const showSuccessDialog = (message?: string, description?: string) => {
      setStatusDialog({
        open: true,
        mode: "success",
        title: message || "Hoàn tất!",
        description: description || `Đã tạo thời khóa biểu cho ${targetLabel}`,
      });
    };
    const closeStatusDialog = () => {
      setStatusDialog((prev) => ({ ...prev, open: false }));
    };

    // ✅ Nếu có callback cũ, gọi nó
    if (onGenerate) {
      showLoadingDialog();
      setIsGenerating(true);
      try {
        await Promise.resolve(onGenerate(selectedGrades, selectedYear, selectedSemester));
        showSuccessDialog("Đã tạo thành công!");
        setOpen(false);
      } catch (error: any) {
        closeStatusDialog();
        console.error("❌ Lỗi khi tạo lịch (callback):", error);
        if (!error?.__handled && error?.message) {
          toast.error(`❌ Lỗi: ${error.message}`);
        }
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    if (customGenerate) {
      const toastId = toast.loading("⏳ Đang chạy thuật toán...", {
        description: `Đang tạo lịch cho khối ${selectedGrades.join(", ")} - ${selectedYear} HK${selectedSemester}. Vui lòng đợi...`,
        duration: Infinity,
      });
      setIsGenerating(true);
      showLoadingDialog("Đang chạy thuật toán...");
      try {
        const result = await customGenerate({
          grades: selectedGrades,
          year: selectedYear,
          semester: selectedSemester,
          includeActivities,
        });
        toast.dismiss(toastId);
        toast.success(
          result?.message ||
            `✅ Đã tạo thời khóa biểu cho ${selectedGrades.join(", ")}`,
          {
            duration: 5000,
          }
        );
        showSuccessDialog(result?.message);
        if (onSuccess) {
          onSuccess();
        }
        setOpen(false);
      } catch (error: any) {
        console.error("❌ Lỗi khi tạo lịch (custom):", error);
        toast.dismiss(toastId);
        toast.error(`❌ Lỗi: ${error.response?.data?.message || error.message}`, {
          duration: 5000,
        });
        closeStatusDialog();
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // ✅ Hiển thị toast ngay khi bắt đầu tạo để tránh người dùng thao tác nhanh
    const toastId = toast.loading("⏳ Đang tạo lịch tự động...", {
      description: `Đang tạo lịch cho khối ${selectedGrades.join(", ")} - ${selectedYear} HK${selectedSemester}. Vui lòng đợi...`,
      duration: Infinity, // Toast sẽ không tự đóng
    });

    setIsGenerating(true);
    showLoadingDialog();

    try {
      const result = await autoScheduleApi.generateSchedule(
        selectedGrades,
        selectedYear,
        selectedSemester
      );

      // ✅ Đóng toast loading và hiển thị toast thành công
      toast.dismiss(toastId);
      toast.success(
        result.message || `✅ Đã tạo thời khóa biểu cho ${result.schedules?.length || 0} lớp`,
        {
          duration: 5000,
        }
      );
      showSuccessDialog(result.message);

      // ✅ Gọi callback khi thành công
      if (onSuccess) {
        onSuccess();
      }

      setOpen(false);
    } catch (error: any) {
      console.error("❌ Lỗi khi tạo lịch:", error);
      // ✅ Đóng toast loading và hiển thị toast lỗi
      toast.dismiss(toastId);
      toast.error(`❌ Lỗi: ${error.response?.data?.message || error.message}`, {
        duration: 5000,
      });
      closeStatusDialog();
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
    <>
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        // ✅ Không cho phép đóng dialog khi đang tạo lịch
        if (!newOpen && isGenerating) {
          toast.warning("⏳ Đang tạo lịch, vui lòng đợi...");
          return;
        }
        setOpen(newOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto relative"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* ✅ Overlay loading khi đang tạo */}
        {isGenerating && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Đang tạo lịch tự động...</p>
              <p className="text-xs text-muted-foreground">Vui lòng không đóng dialog</p>
            </div>
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="text-center">Chọn khối, năm học và học kỳ để tạo lịch</DialogTitle>
          <DialogDescription className="sr-only">
            Hộp thoại cho phép bạn tạo thời khóa biểu tự động theo khối, năm học, học kỳ và lựa chọn thuật toán.
          </DialogDescription>
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
                    disabled={isGenerating || isValidating}
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
                  disabled={yearOptions.length === 0 || isGenerating || isValidating}
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
                disabled={isGenerating || isValidating}
              >
                <option value="1">Học kỳ 1</option>
                <option value="2">Học kỳ 2</option>
              </select>
            </div>
          </div>

          {/* Checkbox bao gồm hoạt động */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="includeActivities"
              checked={includeActivities}
              onChange={(e) => setIncludeActivities(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
              disabled={isGenerating || isValidating}
            />
            <label htmlFor="includeActivities" className="text-sm font-medium cursor-pointer">
              Bao gồm hoạt động
            </label>
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
              generateButtonText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog
        open={statusDialog.open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && statusDialog.mode === "loading") {
            return;
          }
          setStatusDialog((prev) => ({ ...prev, open: nextOpen }));
        }}
      >
        <DialogContent className="sm:max-w-[320px] text-center">
          <div className="flex flex-col items-center gap-3 py-6">
            {statusDialog.mode === "loading" ? (
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            ) : (
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            )}
            <div className="space-y-1">
              <p className="text-base font-semibold">{statusDialog.title}</p>
              {statusDialog.description && (
                <p className="text-sm text-muted-foreground">{statusDialog.description}</p>
              )}
            </div>
            {statusDialog.mode === "success" && (
              <Button variant="default" onClick={() => setStatusDialog((prev) => ({ ...prev, open: false }))}>
                Đóng
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
