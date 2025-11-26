import { useState, useEffect, useMemo } from "react";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useTeachers, useUpdateTeacherAvailability, useTeacherAvailability } from "@/hooks";
import { Teacher } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Save, X, Search } from "lucide-react";

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
  
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [teacherAvailabilityMap, setTeacherAvailabilityMap] = useState<Record<string, boolean[][]>>({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");

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
  }, [teachersError, toast]);

  // ✅ Lấy availability cho tất cả giáo viên
  useEffect(() => {
    if (teachers.length > 0) {
      teachers.forEach((teacher) => {
        if (teacher._id && !teacherAvailabilityMap[teacher._id]) {
          // Khởi tạo với availableMatrix từ teacher hoặc mặc định
          const defaultMatrix = Array(days.length)
            .fill(null)
            .map(() => Array(slots.length).fill(true));
          
          const matrix = teacher.availableMatrix && Array.isArray(teacher.availableMatrix) && teacher.availableMatrix.length > 0
            ? teacher.availableMatrix.map((row: boolean[]) => [...row])
            : defaultMatrix;
          
          setTeacherAvailabilityMap((prev) => ({
            ...prev,
            [teacher._id!]: matrix,
          }));
        }
      });
    }
  }, [teachers]);

  // toggle 1 ô
  const toggleCell = (teacherId: string, dayIndex: number, slotIndex: number) => {
    if (editingTeacherId !== teacherId) return; // Chỉ cho phép edit khi đang ở chế độ edit
    
    setTeacherAvailabilityMap((prev) => {
      const copy = { ...prev };
      if (!copy[teacherId]) {
        copy[teacherId] = Array(days.length)
          .fill(null)
          .map(() => Array(slots.length).fill(true));
      }
      const matrix = copy[teacherId].map((row) => [...row]);
      matrix[dayIndex][slotIndex] = !matrix[dayIndex][slotIndex];
      return { ...copy, [teacherId]: matrix };
    });
  };

  // Bắt đầu edit
  const handleStartEdit = (teacherId: string) => {
    setEditingTeacherId(teacherId);
  };

  // Hủy edit
  const handleCancelEdit = (teacherId: string) => {
    // Khôi phục lại từ teacher.availableMatrix
    const teacher = teachers.find((t) => t._id === teacherId);
    if (teacher) {
      const defaultMatrix = Array(days.length)
        .fill(null)
        .map(() => Array(slots.length).fill(true));
      
      const matrix = teacher.availableMatrix && Array.isArray(teacher.availableMatrix) && teacher.availableMatrix.length > 0
        ? teacher.availableMatrix.map((row: boolean[]) => [...row])
        : defaultMatrix;
      
      setTeacherAvailabilityMap((prev) => ({
        ...prev,
        [teacherId]: matrix,
      }));
    }
    setEditingTeacherId(null);
  };

  // lưu
  const handleSave = async (teacherId: string) => {
    const availability = teacherAvailabilityMap[teacherId];
    if (!availability) return;

    try {
      await updateAvailabilityMutation.mutateAsync({
        id: teacherId,
        availableMatrix: availability,
      });
      toast({ title: "Thành công", description: "Đã lưu lịch rảnh" });
      setEditingTeacherId(null);
    } catch (err) {
      toast({ title: "Lỗi", description: "Không thể lưu lịch rảnh", variant: "destructive" });
    }
  };

  // Lấy tên môn học của giáo viên
  const getTeacherSubjects = (teacher: Teacher): string => {
    if (teacher.mainSubject?.name) {
      return teacher.mainSubject.name;
    }
    if (teacher.subjects && teacher.subjects.length > 0) {
      return teacher.subjects
        .map((s: any) => s.subjectId?.name || s.subjectId)
        .filter(Boolean)
        .join(", ");
    }
    return "Chưa có môn";
  };

  // Lấy danh sách môn học từ tất cả giáo viên (để làm select filter)
  const allSubjects = useMemo(() => {
    const subjectSet = new Set<string>();
    teachers.forEach((teacher) => {
      const subjects = getTeacherSubjects(teacher);
      if (subjects && subjects !== "Chưa có môn") {
        subjects.split(", ").forEach((subject) => subjectSet.add(subject));
      }
    });
    return Array.from(subjectSet).sort();
  }, [teachers]);

  // Filter giáo viên dựa trên search và subject
  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      // Filter theo tên
      const nameMatch = searchQuery === "" || 
        teacher.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filter theo môn học
      const subjectMatch = selectedSubject === "all" || 
        getTeacherSubjects(teacher).toLowerCase().includes(selectedSubject.toLowerCase());
      
      return nameMatch && subjectMatch;
    });
  }, [teachers, searchQuery, selectedSubject]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">📅 Lịch rảnh của giáo viên</h1>

      {/* Tìm kiếm và Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="🔍 Tìm kiếm theo tên giáo viên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tất cả môn học" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả môn học</SelectItem>
                {allSubjects.map((subject) => (
                  <SelectItem key={subject} value={subject.toLowerCase()}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground">
              Hiển thị: {filteredTeachers.length} / {teachers.length} giáo viên
            </div>
          </div>
        </CardContent>
      </Card>

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
      ) : filteredTeachers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Không tìm thấy giáo viên nào phù hợp với bộ lọc.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeachers.map((teacher) => {
            const isEditing = editingTeacherId === teacher._id;
            const availability = teacherAvailabilityMap[teacher._id!] || 
              Array(days.length).fill(null).map(() => Array(slots.length).fill(true));

            return (
              <Card key={teacher._id} className="shadow-md">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{teacher.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getTeacherSubjects(teacher)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!isEditing ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartEdit(teacher._id!)}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Sửa
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelEdit(teacher._id!)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Hủy
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSave(teacher._id!)}
                            disabled={updateAvailabilityMutation.isPending}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Lưu
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditing && (
                    <div className="mb-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTeacherAvailabilityMap((prev) => {
                            const copy = { ...prev };
                            copy[teacher._id!] = Array(days.length)
                              .fill(null)
                              .map(() => Array(slots.length).fill(true));
                            return copy;
                          });
                        }}
                      >
                        ✅ Rảnh tất cả
                      </Button>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="border-collapse border w-full text-center text-xs">
                      <thead>
                        <tr>
                          <th className="border px-2 py-1 bg-gray-100">Tiết / Thứ</th>
                          {days.map((day) => (
                            <th key={day} className="border px-2 py-1 bg-gray-100">
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((slot, slotIndex) => (
                          <tr key={slot}>
                            <td className="border px-2 py-1 font-medium bg-gray-50">{slot}</td>
                            {days.map((_, dayIndex) => (
                              <td
                                key={dayIndex}
                                onClick={() => isEditing && toggleCell(teacher._id!, dayIndex, slotIndex)}
                                className={`border cursor-pointer py-1 ${
                                  isEditing
                                    ? availability[dayIndex]?.[slotIndex]
                                      ? "bg-green-500 text-white hover:bg-green-600"
                                      : "bg-gray-200 hover:bg-gray-300"
                                    : availability[dayIndex]?.[slotIndex]
                                    ? "bg-green-500 text-white"
                                    : "bg-gray-200"
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
