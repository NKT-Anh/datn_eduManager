import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import attendanceApi from '@/services/attendanceApi';
import { assignmentApi } from '@/services/assignmentApi';
import { classApi } from '@/services/classApi';
import { scheduleApi } from '@/services/scheduleApi';
import {
  ClipboardList,
  Save,
  Users,
  Calendar,
  Clock,
  BookOpen,
  Check,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { TeachingAssignment } from '@/types/class';
import { ClassType } from '@/types/class';
import { Subject } from '@/types/class';
import schoolConfigApi from '@/services/schoolConfigApi';

interface Student {
  _id: string;
  name: string;
  studentCode?: string;
}

interface AttendanceRecord {
  studentId: string;
  status: 'present' | 'absent' | 'excused' | 'late';
  notes?: string;
}

const TeacherTakeAttendancePage = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendances, setAttendances] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lấy năm học hiện tại
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await schoolConfigApi.getSchoolYears();
        if (res.data && res.data.length > 0) {
          setSchoolYear(res.data[res.data.length - 1].code);
        } else {
          // Tính năm học mặc định
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
          setSchoolYear(currentYear);
        }
      } catch (err: any) {
        console.error('Error fetching school year:', err);
        // Tính năm học mặc định
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
        setSchoolYear(currentYear);
      }
    };
    fetchSettings();
  }, []);

  // Lấy danh sách phân công giảng dạy của giáo viên
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!backendUser?._id || !schoolYear) return;
      try {
        setLoading(true);
        const res = await assignmentApi.getByTeacher(backendUser._id, { year: schoolYear, semester });
        setAssignments(Array.isArray(res) ? res : []);
      } catch (err: any) {
        console.error('Error fetching assignments:', err);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải danh sách lớp dạy',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, [backendUser, schoolYear, semester]);

  // Lấy danh sách học sinh khi chọn lớp
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedClassId) {
        setStudents([]);
        return;
      }
      try {
        setLoading(true);
        const res = await attendanceApi.getStudentsForAttendance(selectedClassId);
        if (res.success && res.data) {
          setStudents(res.data);
          // Khởi tạo tất cả học sinh là "Có mặt"
          const initialAttendances: Record<string, AttendanceRecord> = {};
          res.data.forEach((student: Student) => {
            initialAttendances[student._id] = {
              studentId: student._id,
              status: 'present',
              notes: '',
            };
          });
          setAttendances(initialAttendances);
        }
      } catch (err: any) {
        console.error('Error fetching students:', err);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải danh sách học sinh',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [selectedClassId]);

  // Lấy điểm danh đã có (nếu có)
  useEffect(() => {
    const fetchExistingAttendance = async () => {
      if (!selectedClassId || !selectedSubjectId || !selectedDate || !selectedPeriod) return;
      try {
        const res = await attendanceApi.getAttendance({
          classId: selectedClassId,
          subjectId: selectedSubjectId,
          date: selectedDate,
          period: selectedPeriod,
          schoolYear,
          semester,
        });
        if (res.success && res.data && res.data.length > 0) {
          // Cập nhật điểm danh đã có
          const existing: Record<string, AttendanceRecord> = {};
          res.data.forEach((att: any) => {
            existing[att.studentId._id] = {
              studentId: att.studentId._id,
              status: att.status,
              notes: att.notes || '',
            };
          });
          // Merge với danh sách học sinh hiện tại
          students.forEach((student) => {
            if (!existing[student._id]) {
              existing[student._id] = {
                studentId: student._id,
                status: 'present',
                notes: '',
              };
            }
          });
          setAttendances(existing);
          toast({
            title: 'Thông báo',
            description: 'Đã tải điểm danh đã có. Bạn có thể chỉnh sửa.',
          });
        }
      } catch (err) {
        // Không có điểm danh cũ là bình thường
        console.log('No existing attendance:', err);
      }
    };
    fetchExistingAttendance();
  }, [selectedClassId, selectedSubjectId, selectedDate, selectedPeriod, schoolYear, semester]);

  // Lọc assignments theo lớp đã chọn
  const availableSubjects = assignments
    .filter((a) => a.classId._id === selectedClassId)
    .map((a) => a.subjectId);

  const selectedClass = assignments.find((a) => a.classId._id === selectedClassId)?.classId;

  const handleStatusChange = (studentId: string, status: AttendanceRecord['status']) => {
    setAttendances({
      ...attendances,
      [studentId]: {
        ...attendances[studentId],
        status,
      },
    });
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendances({
      ...attendances,
      [studentId]: {
        ...attendances[studentId],
        notes,
      },
    });
  };

  const handleSave = async () => {
    if (!selectedClassId || !selectedSubjectId || !selectedDate || !selectedPeriod) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng chọn đầy đủ lớp, môn, ngày và tiết học',
        variant: 'destructive',
      });
      return;
    }

    const attendanceArray = Object.values(attendances);
    if (attendanceArray.length === 0) {
      toast({
        title: 'Chưa có học sinh',
        description: 'Chưa có học sinh để điểm danh',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const res = await attendanceApi.takeAttendance({
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        date: selectedDate,
        period: selectedPeriod,
        attendances: attendanceArray,
        schoolYear,
        semester,
      });

      toast({
        title: 'Thành công',
        description: res.message || `Đã điểm danh ${res.created} học sinh`,
      });
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      toast({
        title: 'Lỗi',
        description: err.response?.data?.message || 'Không thể lưu điểm danh',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-600">Có mặt</Badge>;
      case 'absent':
        return <Badge variant="destructive">Vắng không phép</Badge>;
      case 'excused':
        return <Badge className="bg-yellow-600">Vắng có phép</Badge>;
      case 'late':
        return <Badge className="bg-orange-600">Muộn</Badge>;
      default:
        return null;
    }
  };

  const stats = {
    total: students.length,
    present: Object.values(attendances).filter((a) => a.status === 'present').length,
    absent: Object.values(attendances).filter((a) => a.status === 'absent').length,
    excused: Object.values(attendances).filter((a) => a.status === 'excused').length,
    late: Object.values(attendances).filter((a) => a.status === 'late').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Điểm danh học sinh</h1>
          <p className="text-muted-foreground">
            Điểm danh học sinh theo lớp, môn học và tiết học
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || !selectedClassId || !selectedSubjectId}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang lưu...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" /> Lưu điểm danh
            </>
          )}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Chọn thông tin điểm danh</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Năm học</Label>
              <Input value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} />
            </div>
            <div>
              <Label>Học kỳ</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Học kỳ 1</SelectItem>
                  <SelectItem value="2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lớp học</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn lớp" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(assignments.map((a) => a.classId._id))).map((classId) => {
                    const classItem = assignments.find((a) => a.classId._id === classId)?.classId;
                    return (
                      <SelectItem key={classId} value={classId}>
                        {classItem?.className} - Khối {classItem?.grade}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Môn học</Label>
              <Select
                value={selectedSubjectId}
                onValueChange={setSelectedSubjectId}
                disabled={!selectedClassId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn môn" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubjects.map((subject) => (
                    <SelectItem key={subject._id} value={subject._id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ngày</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Tiết học</Label>
              <Select
                value={selectedPeriod.toString()}
                onValueChange={(value) => setSelectedPeriod(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((p) => (
                    <SelectItem key={p} value={p.toString()}>
                      Tiết {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {selectedClassId && students.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Tổng số</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Check className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">{stats.present}</p>
              <p className="text-sm text-muted-foreground">Có mặt</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <X className="h-6 w-6 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              <p className="text-sm text-muted-foreground">Vắng không phép</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertCircle className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-yellow-600">{stats.excused}</p>
              <p className="text-sm text-muted-foreground">Vắng có phép</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-6 w-6 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-orange-600">{stats.late}</p>
              <p className="text-sm text-muted-foreground">Muộn</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance List */}
      {selectedClassId && selectedSubjectId && students.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Danh sách điểm danh
            </CardTitle>
            <CardDescription>
              {selectedClass?.className} - Tiết {selectedPeriod} -{' '}
              {new Date(selectedDate).toLocaleDateString('vi-VN')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {students.map((student) => {
                const attendance = attendances[student._id] || {
                  studentId: student._id,
                  status: 'present' as const,
                  notes: '',
                };
                return (
                  <div
                    key={student._id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3">
                        <p className="font-medium">{student.name}</p>
                        {student.studentCode && (
                          <p className="text-sm text-muted-foreground">{student.studentCode}</p>
                        )}
                      </div>
                      <div className="col-span-3">
                        <Select
                          value={attendance.status}
                          onValueChange={(value) =>
                            handleStatusChange(student._id, value as AttendanceRecord['status'])
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">
                              <div className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-600" />
                                Có mặt
                              </div>
                            </SelectItem>
                            <SelectItem value="absent">
                              <div className="flex items-center gap-2">
                                <X className="h-4 w-4 text-red-600" />
                                Vắng không phép
                              </div>
                            </SelectItem>
                            <SelectItem value="excused">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-yellow-600" />
                                Vắng có phép
                              </div>
                            </SelectItem>
                            <SelectItem value="late">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-orange-600" />
                                Muộn
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4">
                        {(attendance.status === 'absent' ||
                          attendance.status === 'excused' ||
                          attendance.status === 'late') && (
                          <Input
                            placeholder="Ghi chú lý do (tùy chọn)"
                            value={attendance.notes || ''}
                            onChange={(e) => handleNotesChange(student._id, e.target.value)}
                          />
                        )}
                      </div>
                      <div className="col-span-2 text-right">
                        {getStatusBadge(attendance.status)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        selectedClassId &&
        !loading && (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Chưa chọn đủ thông tin</h3>
              <p className="text-muted-foreground">
                Vui lòng chọn lớp và môn học để bắt đầu điểm danh
              </p>
            </CardContent>
          </Card>
        )
      )}

      {loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Đang tải dữ liệu...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeacherTakeAttendancePage;

