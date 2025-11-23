import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Dialog,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Teacher } from "@/types/auth";
import { ClassType, Subject } from "@/types/class";
import { cn } from "@/lib/utils";

interface TeacherViewDialogProps {
  teacher: Teacher;
  classes: ClassType[];
  subjects: Subject[];
  onClose: () => void;
}

export function TeacherViewDialog({ teacher, classes, subjects, onClose }: TeacherViewDialogProps) {
  // Lấy danh sách lớp phụ trách
  console.log(teacher.hireYearInField);
  const assignedClasses = teacher.classIds
    ?.map((c) => (typeof c === "string" ? classes.find(cl => cl._id === c) : c))
    .filter(Boolean);

  // Lấy danh sách lớp chủ nhiệm
  const homeroomClasses = teacher.homeroomClassIds
    ?.map((c) => (typeof c === "string" ? classes.find(cl => cl._id === c) : c))
    .filter(Boolean);

  return (
     <Dialog open={!!teacher} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Thông tin giáo viên</DialogTitle>
        <DialogDescription>Thông tin chi tiết về giáo viên</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-semibold">Họ tên:</span> {teacher.name}
          </div>
          <div>
            <span className="font-semibold">Điện thoại:</span> {teacher.phone || "-"}
          </div>
          <div>
            <span className="font-semibold">Ngày sinh:</span> {teacher.dob?.split("T")[0] || "-"}
          </div>
          <div>
            <span className="font-semibold">Giới tính:</span> {teacher.gender === "male" ? "Nam" : teacher.gender === "female" ? "Nữ" : "Khác"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-semibold">Môn chính:</span> {teacher.mainSubject?.name || "-"}
          </div>
          <div>
            <span className="font-semibold">Chức vụ:</span> {teacher.position || "-"}
          </div>
        </div>

        <div>
          <span className="font-semibold">Môn dạy:</span>
          <ul className="list-disc list-inside mt-1">
            {teacher.subjects?.map((s) => (
              <li key={s.subjectId._id}>
                {s.subjectId.name} (Khối: {s.grades.join(", ")})
              </li>
            )) || <li>-</li>}
          </ul>
        </div>

        <div>
          <span className="font-semibold">Lớp phụ trách:</span>
          {assignedClasses?.length ? (
            <div className="flex flex-wrap gap-2 mt-1">
              {assignedClasses.map((c) => (
                <span key={c!._id} className="px-2 py-1 text-sm bg-gray-200 rounded-full">{c!.className}</span>
              ))}
            </div>
          ) : "-"}
        </div>

        <div>
          <span className="font-semibold">Lớp chủ nhiệm:</span>
          {homeroomClasses?.length ? (
            <div className="flex flex-wrap gap-2 mt-1">
              {homeroomClasses.map((c) => (
                <span key={c!._id} className="px-2 py-1 text-sm bg-green-200 rounded-full">{c!.className}</span>
              ))}
            </div>
          ) : "-"}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-semibold">Trường:</span> {teacher.school || "-"}
          </div>
          <div>
            <span className="font-semibold">Năm về trường:</span> {teacher.hireYear || "-"}
          </div>
          <div>
            <span className="font-semibold">Năm vào ngành:</span> {teacher.hireYearInField || "-"}
            
          </div>
          <div>
            <span className="font-semibold">Số tiết / tuần:</span> {teacher.weeklyLessons || "-"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-semibold">Thâm niên:</span> {teacher.teachingExperience || "-"} năm
          </div>
          <div>
            <span className="font-semibold">Chứng chỉ / khóa đào tạo:</span> {teacher.certifications || "-"}
          </div>
        </div>

        <div>
          <span className="font-semibold">Ghi chú:</span>
          <p className="mt-1">{teacher.notes || "-"}</p>
        </div>

        {teacher.profilePhoto && (
          <div>
            <span className="font-semibold">Ảnh đại diện:</span>
            <img src={teacher.profilePhoto} alt={teacher.name} className="mt-1 w-32 h-32 object-cover rounded-lg border" />
          </div>
        )}
      </div>

      <DialogFooter className="mt-4">
        <Button onClick={onClose}>Đóng</Button>
      </DialogFooter>
    </DialogContent>
     </Dialog>
  );
}

export default TeacherViewDialog;
