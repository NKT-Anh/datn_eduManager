import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Teacher } from "@/types/auth";
import {
  User,
  Phone,
  Calendar,
  BookOpen,
  GraduationCap,
  Briefcase,
  Award,
  FileText,
  Users,
  Home,
} from "lucide-react";

interface TeacherDetailDialogProps {
  teacher: Teacher | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TeacherDetailDialog({
  teacher,
  open,
  onOpenChange,
}: TeacherDetailDialogProps) {
  if (!teacher) return null;

  const InfoItem = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: any;
    label: string;
    value?: string | number;
  }) => (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-1 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value || "Chưa cập nhật"}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Thông tin giáo viên</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Thông tin cơ bản */}
          <div className="flex gap-6">
            {teacher.profilePhoto && (
              <img
                src={teacher.profilePhoto}
                alt={teacher.name}
                className="w-32 h-32 object-cover rounded-lg border"
              />
            )}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <InfoItem icon={User} label="Họ và tên" value={teacher.name} />
              <InfoItem
                icon={FileText}
                label="Mã giáo viên"
                value={teacher.teacherCode}
              />
              <InfoItem icon={Phone} label="Số điện thoại" value={teacher.phone} />
              <InfoItem icon={Calendar} label="Ngày sinh" value={teacher.dob} />
              <InfoItem
                icon={User}
                label="Giới tính"
                value={
                  teacher.gender === "male"
                    ? "Nam"
                    : teacher.gender === "female"
                    ? "Nữ"
                    : "Khác"
                }
              />
              <InfoItem
                icon={FileText}
                label="Trạng thái"
                value={teacher.status === "active" ? "Đang làm việc" : "Nghỉ việc"}
              />
            </div>
          </div>

          <Separator />

          {/* Môn giảng dạy */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Môn giảng dạy
            </h3>
            <div className="space-y-3">
              {teacher.mainSubject && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Môn chính</p>
                  <Badge variant="default" className="text-base px-3 py-1">
                    {teacher.mainSubject.name} ({teacher.mainSubject.code})
                  </Badge>
                </div>
              )}
              {teacher.subjects && teacher.subjects.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Các môn giảng dạy
                  </p>
                  <div className="space-y-2">
                    {teacher.subjects.map((subject, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 flex-wrap"
                      >
                        <Badge variant="secondary">
                          {subject.subjectId.name} ({subject.subjectId.code})
                        </Badge>
                        <span className="text-sm text-muted-foreground">-</span>
                        <div className="flex gap-1">
                          {subject.grades.map((grade) => (
                            <Badge key={grade} variant="outline" className="text-xs">
                              Khối {grade}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Lớp phụ trách */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lớp phụ trách
            </h3>
            <div className="space-y-3">
              {teacher.homeroomClassIds && teacher.homeroomClassIds.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Lớp chủ nhiệm</p>
                  <div className="flex flex-wrap gap-2">
                    {teacher.homeroomClassIds.map((cls) => (
                      <Badge
                        key={cls._id}
                        variant="default"
                        className="flex items-center gap-1"
                      >
                        <Home className="h-3 w-3" />
                        {cls.className} (Khối {cls.grade})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {teacher.classIds && teacher.classIds.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Lớp giảng dạy</p>
                  <div className="flex flex-wrap gap-2">
                    {teacher.classIds.map((cls) => (
                      <Badge key={cls._id} variant="outline">
                        {cls.className} (Khối {cls.grade})    
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Thông tin công tác */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Thông tin công tác
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon={Briefcase} label="Trường" value={teacher.school} />
              <InfoItem icon={Award} label="Chức vụ" value={teacher.position} />
              <InfoItem icon={Calendar} label="Năm về trường" value={teacher.hireYear} />
              <InfoItem
                icon={Calendar}
                label="Năm vào ngành"
                value={teacher.hireYearInField}
              />
              <InfoItem icon={BookOpen} label="Số tiết/tuần" value={teacher.weeklyLessons} />
            </div>
          </div>

          <Separator />

          {/* Thông tin chuyên môn */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Thông tin chuyên môn
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem
                icon={Award}
                label="Bằng cấp/Trình độ"
                value={teacher.qualification}
              />
              <InfoItem
                icon={BookOpen}
                label="Chuyên ngành"
                value={teacher.specialization}
              />
              <InfoItem
                icon={Calendar}
                label="Thâm niên công tác"
                value={teacher.teachingExperience ? `${teacher.teachingExperience} năm` : undefined}
              />
            </div>
            {teacher.certifications && teacher.certifications.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Chứng chỉ/Khóa đào tạo
                </p>
                <div className="flex flex-wrap gap-2">
                  {teacher.certifications && typeof teacher.certifications === "string" && (
                  <div className="flex flex-wrap gap-2">
                    {teacher.certifications.split(",").map((cert, index) => (
                      <Badge key={index} variant="secondary">
                        {cert.trim()}
                      </Badge>
                    ))}
                  </div>
                )}

                </div>
              </div>
            )}
          </div>

          {/* Ghi chú */}
          {teacher.notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Ghi chú
                </h3>
                <p className="text-sm text-muted-foreground">{teacher.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
