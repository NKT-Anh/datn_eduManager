import { useEffect, useState } from "react";
import { teacherApi } from "@/services/teacherApi";
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
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [availability, setAvailability] = useState<boolean[][]>([]);
  const [loading, setLoading] = useState(false);

  // load danh sách giáo viên
  useEffect(() => {
    teacherApi
      .getAll()
      .then(setTeachers)
      .catch(() => {
        toast({
          title: "Lỗi",
          description: "Không tải được danh sách giáo viên",
        });
      });
  }, []);

  // load lịch khi chọn giáo viên
  const handleSelectTeacher = async (id: string) => {
    const teacher = teachers.find((t) => t._id === id) || null;
    setSelectedTeacher(teacher);
    if (!teacher) return;

    setLoading(true);
    try {
      const data = await teacherApi.getAvailability(id);
      if (data && data.length > 0)
        setAvailability(data);
      else
        setAvailability(
          Array(days.length)
            .fill(null)
            .map(() => Array(slots.length).fill(false))
        );
    } finally {
      setLoading(false);
    }
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
      await teacherApi.updateAvailability(selectedTeacher._id!, availability);
      toast({ title: "Thành công", description: "Đã lưu lịch rảnh" });
    } catch {
      toast({ title: "Lỗi", description: "Không thể lưu lịch rảnh" });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">📅 Lịch rảnh của giáo viên</h1>

      <Select onValueChange={handleSelectTeacher}>
        <SelectTrigger className="w-80">
          <SelectValue placeholder="Chọn giáo viên" />
        </SelectTrigger>
        <SelectContent>
          {teachers.map((t) => (
            <SelectItem key={t._id} value={t._id!}>
              {t.name} (
              {t.subjects?.map((s) => s.subjectId.name).join(", ")})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
