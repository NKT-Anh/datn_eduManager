import { useState, useEffect } from "react";
import { teacherApi } from "@/services/teacherApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save, RefreshCw, Calendar } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const slots = [
  "Tiết 1",
  "Tiết 2",
  "Tiết 3",
  "Tiết 4",
  "Tiết 5",
  "Tiết 6",
  "Tiết 7",
  "Tiết 8",
  "Tiết 9",
  "Tiết 10",
];

export default function TeacherMyAvailabilityPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ✅ Lấy lịch rảnh của chính mình
  const {
    data: availabilityData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["teacher", "me", "availability"],
    queryFn: () => teacherApi.getMyAvailability(),
    staleTime: 5 * 60 * 1000,
  });

  // ✅ State để quản lý ma trận lịch rảnh
  const [availableMatrix, setAvailableMatrix] = useState<boolean[][]>(() => {
    // Khởi tạo với ma trận mặc định (tất cả rảnh)
    return Array(days.length)
      .fill(null)
      .map(() => Array(slots.length).fill(true));
  });

  // ✅ Cập nhật state khi có dữ liệu từ API
  useEffect(() => {
    if (availabilityData?.availableMatrix) {
      setAvailableMatrix(
        availabilityData.availableMatrix.map((row) => [...row])
      );
    }
  }, [availabilityData]);

  // ✅ Mutation để cập nhật lịch rảnh
  const updateMutation = useMutation({
    mutationFn: (matrix: boolean[][]) => teacherApi.updateMyAvailability(matrix),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "me", "availability"] });
      toast({
        title: "✅ Thành công",
        description: "Cập nhật lịch rảnh thành công.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Lỗi",
        description: error?.response?.data?.message || "Không thể cập nhật lịch rảnh.",
        variant: "destructive",
      });
    },
  });

  // ✅ Toggle một ô (rảnh/bận)
  const toggleCell = (dayIndex: number, slotIndex: number) => {
    setAvailableMatrix((prev) => {
      const newMatrix = prev.map((row) => [...row]);
      newMatrix[dayIndex][slotIndex] = !newMatrix[dayIndex][slotIndex];
      return newMatrix;
    });
  };

  // ✅ Lưu lịch rảnh
  const handleSave = () => {
    updateMutation.mutate(availableMatrix);
  };

  // ✅ Reset về dữ liệu từ server
  const handleReset = () => {
    if (availabilityData?.availableMatrix) {
      setAvailableMatrix(
        availabilityData.availableMatrix.map((row) => [...row])
      );
      toast({
        title: "Đã khôi phục",
        description: "Đã khôi phục lịch rảnh từ server.",
      });
    }
  };

  // ✅ Toggle cả một ngày
  const toggleDay = (dayIndex: number) => {
    setAvailableMatrix((prev) => {
      const newMatrix = prev.map((row) => [...row]);
      const allAvailable = newMatrix[dayIndex].every((cell) => cell === true);
      newMatrix[dayIndex] = Array(slots.length).fill(!allAvailable);
      return newMatrix;
    });
  };

  // ✅ Toggle cả một tiết (tất cả các ngày)
  const toggleSlot = (slotIndex: number) => {
    setAvailableMatrix((prev) => {
      const newMatrix = prev.map((row) => [...row]);
      const allAvailable = newMatrix.every((row) => row[slotIndex] === true);
      newMatrix.forEach((row) => {
        row[slotIndex] = !allAvailable;
      });
      return newMatrix;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Đang tải lịch rảnh...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lỗi</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">
            Không thể tải lịch rảnh. Vui lòng thử lại sau.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Lịch rảnh của tôi
              </CardTitle>
              <CardDescription className="mt-2">
                Nhấp vào các ô để đánh dấu rảnh (xanh) hoặc bận (đỏ). 
                Bạn có thể nhấp vào tên ngày hoặc số tiết để toggle cả hàng/cột.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={updateMutation.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Khôi phục
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr>
                  <th className="border border-gray-300 px-2 py-2 bg-gray-100 font-medium min-w-[80px]">
                    Ngày/Tiết
                  </th>
                  {slots.map((slot, index) => (
                    <th
                      key={index}
                      className="border border-gray-300 px-2 py-2 bg-gray-100 font-medium cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => toggleSlot(index)}
                      title="Nhấp để toggle cả cột"
                    >
                      {slot}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day, dayIndex) => (
                  <tr key={dayIndex}>
                    <td
                      className="border border-gray-300 px-3 py-2 bg-gray-50 font-medium cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleDay(dayIndex)}
                      title="Nhấp để toggle cả hàng"
                    >
                      {day}
                    </td>
                    {slots.map((_, slotIndex) => {
                      const isAvailable = availableMatrix[dayIndex]?.[slotIndex] ?? true;
                      return (
                        <td
                          key={slotIndex}
                          className={`border border-gray-300 px-2 py-2 text-center cursor-pointer transition-colors ${
                            isAvailable
                              ? "bg-green-100 hover:bg-green-200 text-green-800"
                              : "bg-red-100 hover:bg-red-200 text-red-800"
                          }`}
                          onClick={() => toggleCell(dayIndex, slotIndex)}
                          title={
                            isAvailable
                              ? "Rảnh - Nhấp để đánh dấu bận"
                              : "Bận - Nhấp để đánh dấu rảnh"
                          }
                        >
                          {isAvailable ? "✓" : "✗"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300"></div>
              <span>Rảnh (có thể dạy)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-300"></div>
              <span>Bận (không thể dạy)</span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Lưu ý:</strong> Lịch rảnh này sẽ được sử dụng khi hệ thống tự động tạo thời khóa biểu. 
              Hãy cập nhật chính xác để tránh xung đột lịch dạy.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

