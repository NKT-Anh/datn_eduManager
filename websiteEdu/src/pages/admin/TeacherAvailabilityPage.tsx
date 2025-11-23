import { useState, useEffect } from "react";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useTeachers, useUpdateTeacherAvailability, useTeacherAvailability } from "@/hooks";
import { Teacher } from "@/types/auth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

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

export default function TeacherAvailabilityPage() {
  const { toast } = useToast();
  // ✅ Sử dụng hooks
  const { teachers, isLoading: isLoadingTeachers, error: teachersError } = useTeachers();
  const updateAvailabilityMutation = useUpdateTeacherAvailability();
  
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [availability, setAvailability] = useState<boolean[][]>([]);
  
  // ✅ Sử dụng hook để lấy availability
  const { data: availabilityData, isLoading: loading } = useTeacherAvailability(selectedTeacher?._id);
  
  // ✅ Log để debug
  useEffect(() => {
    if (teachersError) {
      console.error("❌ Lỗi khi tải danh sách giáo viên:", teachersError);
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách giáo viên. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
    console.log("📋 Danh sách giáo viên:", teachers.length, teachers);
  }, [teachers, teachersError, toast]);
  
  // ✅ Cập nhật availability khi data thay đổi
  useEffect(() => {
    if (availabilityData && availabilityData.length > 0) {
      setAvailability(availabilityData);
    } else if (selectedTeacher) {
      // ✅ Mặc định: tất cả đều RẢNH (true) - giống với backend schema default
      setAvailability(
        Array(days.length)
          .fill(null)
          .map(() => Array(slots.length).fill(true))
      );
    }
  }, [availabilityData, selectedTeacher]);

  // load lịch khi chọn giáo viên
  const handleSelectTeacher = (id: string) => {
    const teacher = teachers.find((t) => t._id === id) || null;
    setSelectedTeacher(teacher);
    // ✅ Hook sẽ tự động load availability khi selectedTeacher thay đổi
  };

  // toggle 1 ô
  const toggleCell = (dayIndex: number, slotIndex: number) => {
    setAvailability((prev) => {
      const copy = prev.map((row) => [...row]);
      copy[dayIndex][slotIndex] = !copy[dayIndex][slotIndex];
      return copy;
    });
  };

  // lưu
  const handleSave = async () => {
    if (!selectedTeacher) return;
    const freeSlots: string[] = [];
    availability.forEach((dayRow, dayIndex) => {
      dayRow.forEach((isFree, slotIndex) => {
        if (isFree) freeSlots.push(`${days[dayIndex]} - ${slots[slotIndex]}`);
      });
    });

    console.log("Các tiết rảnh của giáo viên:", freeSlots);

    try {
      await updateAvailabilityMutation.mutateAsync({
        id: selectedTeacher._id!,
        availableMatrix: availability,
      });
      toast({ title: "Thành công", description: "Đã lưu lịch rảnh" });
    } catch {
      toast({ title: "Lỗi", description: "Không thể lưu lịch rảnh" });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">📅 Lịch rảnh của giáo viên</h1>

      {isLoadingTeachers ? (
        <div className="text-center py-4">
          <p>Đang tải danh sách giáo viên...</p>
        </div>
      ) : teachersError ? (
        <div className="text-center py-4 text-red-600">
          <p>Lỗi khi tải danh sách giáo viên. Vui lòng thử lại.</p>
        </div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">
          <p>Chưa có giáo viên nào trong hệ thống.</p>
        </div>
      ) : (
        <Select onValueChange={handleSelectTeacher}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Chọn giáo viên" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((t) => (
              <SelectItem key={t._id} value={t._id!}>
                {t.name}
                {t.subjects && t.subjects.length > 0 && (
                  <> ({t.subjects.map((s: any) => s.subjectId?.name || s.subjectId).join(", ")})</>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selectedTeacher && (
        <Card className="p-4 border shadow-md">
          <p className="font-medium mb-3">
            Giáo viên: {selectedTeacher.name} ({selectedTeacher.accountId?.email})
          </p>

          {loading ? (
            <p>Đang tải...</p>
          ) : (
            <div className="overflow-x-auto">
  <table className="border-collapse border w-full text-center">
    <thead>
      <tr>
        <th className="border px-3 py-2 bg-gray-100">Tiết / Thứ</th>
        {days.map((day) => (
          <th key={day} className="border px-3 py-2 bg-gray-100">
            {day}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {slots.map((slot, slotIndex) => (
        <tr key={slot}>
          <td className="border px-3 py-2 font-medium bg-gray-50">{slot}</td>
          {days.map((_, dayIndex) => (
            <td
              key={dayIndex}
              onClick={() => toggleCell(dayIndex, slotIndex)}
              className={`border cursor-pointer py-2 ${
                availability[dayIndex]?.[slotIndex]
                  ? "bg-green-500 text-white"
                  : "bg-gray-100"
              }`}
            >
              {availability[dayIndex]?.[slotIndex] ? "✓" : ""}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
</div>

          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAvailability(
                  Array(days.length)
                    .fill(null)
                    .map(() => Array(slots.length).fill(true))
                );
              }}
            >
              ✅ Rảnh tất cả
            </Button>

            <Button onClick={handleSave}>💾 Lưu lịch</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
