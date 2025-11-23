import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Hash,
  Calendar,
  Phone,
  MapPin,
  GraduationCap,
  School,
  Globe,
  Home,
  IdCard,
  FileText,
} from "lucide-react";
import { Student } from "@/types/auth";
import { useStudent } from "@/hooks/auth/useStudents";

interface StudentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId?: string;
}

export const StudentDetailDialog = ({
  open,
  onOpenChange,
  studentId,
}: StudentDetailDialogProps) => {
  const { data: student, isLoading } = useStudent(studentId);

  const InfoItem = ({
    icon: Icon,
    label,
    value,
  }: {
    icon?: any;
    label: string;
    value?: string | number | null;
  }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3">
        {Icon && <Icon className="h-4 w-4 mt-1 text-muted-foreground" />}
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-medium">{value}</p>
        </div>
      </div>
    );
  };

  if (!open || !studentId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            {isLoading ? "Đang tải..." : student?.name || "Thông tin học sinh"}
          </DialogTitle>
          <DialogDescription>
            {student?.studentCode && (
              <span>Mã học sinh: <Badge variant="outline">{student.studentCode}</Badge></span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <p className="text-muted-foreground">Đang tải thông tin học sinh...</p>
          </div>
        )}

        {!isLoading && student && (
          <div className="space-y-6 mt-4">
            {/* Thông tin cá nhân */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" /> Thông tin cá nhân
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoItem icon={User} label="Họ và tên" value={student.name} />
                <InfoItem icon={Hash} label="Mã học sinh" value={student.studentCode} />
                <InfoItem
                  label="Giới tính"
                  value={
                    student.gender === "male"
                      ? "Nam"
                      : student.gender === "female"
                      ? "Nữ"
                      : student.gender === "other"
                      ? "Khác"
                      : null
                  }
                />
                <InfoItem
                  icon={Calendar}
                  label="Ngày sinh"
                  value={student.dob ? new Date(student.dob).toLocaleDateString("vi-VN") : null}
                />
                <InfoItem icon={Phone} label="Số điện thoại" value={student.phone} />
                <InfoItem icon={MapPin} label="Địa chỉ" value={student.address} />
                <InfoItem icon={GraduationCap} label="Khối" value={student.grade ? `Khối ${student.grade}` : null} />
                <InfoItem
                  icon={School}
                  label="Lớp"
                  value={
                    student.classId
                      ? typeof student.classId === "object"
                        ? student.classId.className
                        : "Chưa xếp lớp"
                      : "Chưa xếp lớp"
                  }
                />
                <InfoItem icon={Globe} label="Dân tộc" value={student.ethnic} />
                <InfoItem icon={Globe} label="Tôn giáo" value={student.religion} />
                <InfoItem icon={Home} label="Quê quán" value={student.hometown} />
                <InfoItem icon={Home} label="Nơi sinh" value={student.birthPlace} />
                <InfoItem icon={IdCard} label="Số CCCD/CMND" value={student.idNumber} />
                <InfoItem icon={FileText} label="Ghi chú" value={student.note} />
                <InfoItem
                  label="Trạng thái"
                  value={
                    student.status === "active"
                      ? "Đang học"
                      : student.status === "inactive"
                      ? "Nghỉ học"
                      : student.status === "graduated"
                      ? "Đã tốt nghiệp"
                      : student.status === "suspended"
                      ? "Đình chỉ"
                      : student.status === "transferred"
                      ? "Chuyển trường"
                      : null
                  }
                />
              </CardContent>
            </Card>

            {/* Phụ huynh */}
            {student.parents && student.parents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" /> Thông tin phụ huynh
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {student.parents.map((parent, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <InfoItem label="Họ và tên" value={parent.name} />
                          <InfoItem label="Số điện thoại" value={parent.phone} />
                          <InfoItem label="Nghề nghiệp" value={parent.occupation} />
                          <InfoItem
                            label="Quan hệ"
                            value={
                              parent.relation === "father"
                                ? "Cha"
                                : parent.relation === "mother"
                                ? "Mẹ"
                                : parent.relation === "guardian"
                                ? "Người giám hộ"
                                : null
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!isLoading && !student && (
          <div className="text-center py-8">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Không tìm thấy thông tin học sinh</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
















