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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import attendanceApi from '@/services/attendanceApi';
import { classApi } from '@/services/classApi';
import schoolConfigApi from '@/services/schoolConfigApi';
import { subjectApi } from '@/services/subjectApi';
import {
  ClipboardList,
  Search,
  Calendar,
  Check,
  X,
  Edit,
  Plus,
  Users,
  School,
  BookOpen,
  TrendingUp,
  Loader2,
  AlertCircle,
  Clock,
  Filter,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AttendanceRecord {
  _id: string;
  studentId: {
    _id: string;
    name: string;
    studentCode?: string;
  };
  classId: {
    _id: string;
    className: string;
    classCode: string;
    grade: string;
  };
  subjectId: {
    _id: string;
    name: string;
    code?: string;
  };
  teacherId: {
    _id: string;
    name: string;
  };
  date: string;
  period: number;
  status: 'present' | 'absent' | 'excused' | 'late';
  notes?: string;
  schoolYear: string;
  semester: string;
}

interface Class {
  _id: string;
  className: string;
  classCode?: string;
  grade: string;
}

interface Subject {
  _id: string;
  name: string;
  code?: string;
}

const AdminAttendancePage = () => {
  const { toast } = useToast();
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Edit dialog
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<'present' | 'absent' | 'excused' | 'late'>('present');
  const [editNotes, setEditNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Lấy năm học
  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        const res = await schoolConfigApi.getSchoolYears();
        if (res.data && res.data.length > 0) {
          setSchoolYear(res.data[res.data.length - 1].code);
        } else {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
          setSchoolYear(currentYear);
        }
      } catch (err) {
        console.error('Error fetching school years:', err);
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
        setSchoolYear(currentYear);
      }
    };
    fetchSchoolYears();
  }, []);

  // Lấy danh sách lớp và môn
  useEffect(() => {
    const fetchClassesAndSubjects = async () => {
      try {
        const [classesRes, subjectsRes] = await Promise.all([
          classApi.getAll(),
          subjectApi.getSubjects(),
        ]);
        setClasses(Array.isArray(classesRes) ? classesRes : []);
        setSubjects(Array.isArray(subjectsRes) ? subjectsRes : []);
      } catch (err) {
        console.error('Error fetching classes/subjects:', err);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải danh sách lớp/môn học',
          variant: 'destructive',
        });
      }
    };
    fetchClassesAndSubjects();
  }, []);

  // Lấy điểm danh
  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const params: any = {
        schoolYear,
        semester,
      };
      if (selectedClassId) params.classId = selectedClassId;
      if (selectedSubjectId) params.subjectId = selectedSubjectId;
      if (selectedDate) params.date = selectedDate;

      const res = await attendanceApi.getAttendance(params);
      if (res.success && res.data) {
        setAttendances(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching attendance:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải điểm danh',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Lấy thống kê
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const params: any = {
        schoolYear,
        semester,
      };
      if (selectedClassId) params.classId = selectedClassId;
      if (selectedSubjectId) params.subjectId = selectedSubjectId;
      if (selectedDate) {
        params.startDate = selectedDate;
        params.endDate = selectedDate;
      }

      const res = await attendanceApi.getAttendanceStats(params);
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (schoolYear && semester) {
      fetchAttendance();
      fetchStats();
    }
  }, [selectedClassId, selectedSubjectId, selectedDate, schoolYear, semester]);

  // Lọc theo search term
  const filteredAttendances = attendances.filter((att) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      att.studentId.name.toLowerCase().includes(searchLower) ||
      att.studentId.studentCode?.toLowerCase().includes(searchLower) ||
      att.classId.className.toLowerCase().includes(searchLower) ||
      att.subjectId.name.toLowerCase().includes(searchLower)
    );
  });

  // Mở dialog chỉnh sửa
  const openEditDialog = (attendance: AttendanceRecord) => {
    setEditingAttendance(attendance);
    setEditStatus(attendance.status);
    setEditNotes(attendance.notes || '');
  };

  // Lưu chỉnh sửa
  const handleSaveEdit = async () => {
    if (!editingAttendance) return;

    try {
      setSaving(true);
      await attendanceApi.updateAttendance(editingAttendance._id, {
        status: editStatus,
        notes: editNotes,
      });
      toast({
        title: 'Thành công',
        description: 'Đã cập nhật điểm danh thành công',
      });
      setEditingAttendance(null);
      fetchAttendance();
      fetchStats();
    } catch (err: any) {
      console.error('Error updating attendance:', err);
      toast({
        title: 'Lỗi',
        description: err.response?.data?.message || 'Không thể cập nhật điểm danh',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'present':
        return (
          <Badge className="bg-green-600">
            <Check className="h-3 w-3 mr-1" />
            Có mặt
          </Badge>
        );
      case 'absent':
        return (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" />
            Vắng không phép
          </Badge>
        );
      case 'excused':
        return (
          <Badge className="bg-yellow-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Vắng có phép
          </Badge>
        );
      case 'late':
        return (
          <Badge className="bg-orange-600">
            <Clock className="h-3 w-3 mr-1" />
            Muộn
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý điểm danh</h1>
          <p className="text-muted-foreground">Xem và quản lý điểm danh học sinh toàn trường</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Bộ lọc
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label>Năm học</Label>
              <Input
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                placeholder="2024-2025"
              />
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
              <Select value={selectedClassId || 'all'} onValueChange={(value) => setSelectedClassId(value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả lớp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả lớp</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      {cls.className} - Khối {cls.grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Môn học</Label>
              <Select value={selectedSubjectId || 'all'} onValueChange={(value) => setSelectedSubjectId(value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả môn" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả môn</SelectItem>
                  {subjects.map((subject) => (
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
              <Label>Tìm kiếm</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tên, mã HS, lớp..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <ClipboardList className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Tổng số tiết</p>
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
              <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-primary">{stats.attendanceRate}%</p>
              <p className="text-sm text-muted-foreground">Tỷ lệ có mặt</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Danh sách điểm danh
          </CardTitle>
          <CardDescription>
            {selectedDate && `Ngày ${new Date(selectedDate).toLocaleDateString('vi-VN')}`}
            {selectedClassId && ` - ${classes.find((c) => c._id === selectedClassId)?.className || ''}`}
            {selectedSubjectId && ` - ${subjects.find((s) => s._id === selectedSubjectId)?.name || ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Đang tải điểm danh...</span>
            </div>
          ) : filteredAttendances.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>STT</TableHead>
                    <TableHead>Học sinh</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead>Môn học</TableHead>
                    <TableHead>Giáo viên</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Tiết</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendances.map((att, index) => (
                    <TableRow key={att._id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{att.studentId.name}</div>
                          {att.studentId.studentCode && (
                            <div className="text-sm text-muted-foreground">
                              {att.studentId.studentCode}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {att.classId.className} - Khối {att.classId.grade}
                        </Badge>
                      </TableCell>
                      <TableCell>{att.subjectId.name}</TableCell>
                      <TableCell>{att.teacherId.name}</TableCell>
                      <TableCell>
                        {new Date(att.date).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell>Tiết {att.period}</TableCell>
                      <TableCell>{getStatusBadge(att.status)}</TableCell>
                      <TableCell>
                        {att.notes ? (
                          <span className="text-sm text-muted-foreground">{att.notes}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(att)}
                          className="h-8 w-8"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Chưa có dữ liệu điểm danh</h3>
              <p className="text-muted-foreground">
                Không có điểm danh nào phù hợp với bộ lọc đã chọn
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingAttendance} onOpenChange={(open) => !open && setEditingAttendance(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa điểm danh</DialogTitle>
            <DialogDescription>
              Cập nhật trạng thái điểm danh cho học sinh
            </DialogDescription>
          </DialogHeader>
          {editingAttendance && (
            <div className="space-y-4">
              <div>
                <Label>Học sinh</Label>
                <Input
                  value={`${editingAttendance.studentId.name} (${editingAttendance.studentId.studentCode || 'Chưa có mã'})`}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>Lớp - Môn học</Label>
                <Input
                  value={`${editingAttendance.classId.className} - ${editingAttendance.subjectId.name}`}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>Trạng thái *</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as any)}>
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
              <div>
                <Label>Ghi chú</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Nhập lý do (tùy chọn)"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingAttendance(null)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                'Lưu thay đổi'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAttendancePage;

