import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Student } from '@/types/auth';
import { ClassType } from '@/types/class';
import { Search, User, Phone, MapPin, Calendar, Eye } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface ClassStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classItem: ClassType | null;
  students: Student[];
}

export const ClassStudentsDialog = ({
  open,
  onOpenChange,
  classItem,
  students,
}: ClassStudentsDialogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  if (!classItem) return null;

  // 🔹 Lọc học sinh thuộc lớp này
const classStudents = students.filter((s) => {
  if (!s.classId) return false;
  return typeof s.classId === "string"
    ? s.classId === classItem._id
    : s.classId._id === classItem._id;
});


  // 🔹 Tìm kiếm theo tên hoặc mã học sinh
  const filteredStudents = classStudents.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 🔹 Hàm rút gọn chuỗi nếu quá dài
  const truncateText = (text: string = '', maxLength = 40) =>
    text.length > maxLength ? text.slice(0, maxLength) + '...' : text;

  const handleViewStudent = (studentId: string) => {
    navigate(`/admin/students/${studentId}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Danh sách học sinh - {classItem.className}
          </DialogTitle>
          <DialogDescription>
            Tổng số: {classStudents.length} học sinh
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* 🔍 Tìm kiếm */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm học sinh..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* 📋 Danh sách học sinh */}
          <div className="flex-1 overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm
                    ? 'Không tìm thấy học sinh'
                    : 'Lớp này chưa có học sinh'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredStudents.map((student) => (
                  <div
                    key={student._id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* 🔹 Tên & mã học sinh */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-semibold">{student.name}</h3>
                          {student.studentCode && (
                            <Badge variant="outline" className="text-xs">
                              {student.studentCode}
                            </Badge>
                          )}
                          {student.status === 'inactive' && (
                            <Badge variant="destructive" className="text-xs">
                              Nghỉ học
                            </Badge>
                          )}
                        </div>

                        {/* 🔹 Thông tin chi tiết */}
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {student.dob && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {new Date(student.dob).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          )}
                          {student.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3" />
                              <span>{student.phone}</span>
                            </div>
                          )}
                          {student.address && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-primary" />
                              <span
                                className="truncate max-w-[220px]"
                                title={student.address}
                              >
                                {truncateText(student.address, 40)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 👁️ Xem chi tiết */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewStudent(student._id)}
                        className="ml-2"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
