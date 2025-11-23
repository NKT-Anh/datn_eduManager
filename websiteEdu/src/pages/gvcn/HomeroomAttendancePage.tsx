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
import api from '@/services/axiosInstance';
import { useSchoolYears, useScheduleConfig } from '@/hooks';
import schoolConfigApi from '@/services/schoolConfigApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ClipboardList,
  Save,
  Users,
  Calendar,
  Check,
  X,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  Edit,
  History,
} from 'lucide-react';

interface Student {
  _id: string;
  name: string;
  studentCode?: string;
}

interface AbsentStudent {
  studentId: string;
  status: 'absent' | 'excused' | 'late';
  notes?: string;
  attendanceId?: string; // ID của bản ghi điểm danh (nếu đã có)
}

export default function HomeroomAttendancePage() {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const { currentYearData, currentYear, schoolYears: allSchoolYears } = useSchoolYears();
  const { scheduleConfig } = useScheduleConfig();
  
  const [homeroomClass, setHomeroomClass] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedSession, setSelectedSession] = useState<'morning' | 'afternoon'>('morning');
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [students, setStudents] = useState<Student[]>([]);
  const [absentStudents, setAbsentStudents] = useState<AbsentStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingStudent, setEditingStudent] = useState<AbsentStudent | null>(null);
  const [editReason, setEditReason] = useState<string>('');
  const [showEditDialog, setShowEditDialog] = useState(false);

  // ✅ Set năm học mặc định
  useEffect(() => {
    const defaultYear = currentYearData?.code || currentYear || (allSchoolYears.length > 0 ? allSchoolYears[allSchoolYears.length - 1].code : '');
    if (defaultYear && !schoolYear) {
      setSchoolYear(defaultYear);
    }
  }, [currentYearData, currentYear, allSchoolYears, schoolYear]);

  // ✅ Lấy lớp chủ nhiệm
  useEffect(() => {
    const fetchHomeroomClass = async () => {
      if (!schoolYear) return;
      try {
        setLoading(true);
        const res = await api.get('/class/homeroom/class', { params: { year: schoolYear } });
        if (res.data.success && res.data.data) {
          setHomeroomClass(res.data.data);
        } else {
          setHomeroomClass(null);
        }
      } catch (err: any) {
        console.error('Error fetching homeroom class:', err);
        setHomeroomClass(null);
      } finally {
        setLoading(false);
      }
    };
    fetchHomeroomClass();
  }, [schoolYear]);

  // ✅ Tự động set buổi học mặc định = buổi chính của khối
  useEffect(() => {
    if (homeroomClass?.grade && scheduleConfig) {
      const grade = String(homeroomClass.grade);
      let rule = null;
      
      // Ưu tiên lấy từ gradeConfigs
      if (scheduleConfig.gradeConfigs) {
        const gradeConfig = scheduleConfig.gradeConfigs[grade as '10' | '11' | '12'];
        if (gradeConfig?.rules) {
          rule = gradeConfig.rules;
        }
      }
      
      // Fallback về gradeSessionRules
      if (!rule && scheduleConfig.gradeSessionRules) {
        rule = scheduleConfig.gradeSessionRules.find((r: any) => r?.grade === grade);
      }
      
      if (rule?.session) {
        if (rule.session === 'morning') {
          setSelectedSession('morning');
        } else if (rule.session === 'afternoon') {
          setSelectedSession('afternoon');
        } else if (rule.session === 'both') {
          // Nếu cả hai buổi, mặc định sáng
          setSelectedSession('morning');
        }
      }
    }
  }, [homeroomClass, scheduleConfig]);

  // ✅ Lấy danh sách học sinh lớp chủ nhiệm
  useEffect(() => {
    const fetchStudents = async () => {
      if (!homeroomClass?._id) {
        setStudents([]);
        return;
      }
      try {
        setLoading(true);
        const res = await attendanceApi.getStudentsForAttendance(homeroomClass._id);
        if (res.success && res.data) {
          setStudents(res.data);
        }
      } catch (err: any) {
        console.error('Error fetching students:', err);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải danh sách học sinh',
          variant: 'destructive',
        });
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [homeroomClass]);

  // ✅ Lấy điểm danh đã có (nếu có) - bao gồm cả các ngày trước
  const [existingAttendanceRecords, setExistingAttendanceRecords] = useState<any[]>([]);
  useEffect(() => {
    const fetchExistingAttendance = async () => {
      if (!homeroomClass?._id || !selectedDate || !selectedSession) {
        setExistingAttendanceRecords([]);
        setAbsentStudents([]);
        return;
      }
      try {
        const res = await attendanceApi.getAttendance({
          classId: homeroomClass._id,
          date: selectedDate,
          session: selectedSession,
          schoolYear,
          semester,
        });
        if (res.success && res.absentData && res.absentData.length > 0) {
          // Lưu toàn bộ bản ghi để có thể chỉnh sửa
          setExistingAttendanceRecords(res.absentData);
          // Chỉ lấy danh sách học sinh vắng mặt
          const absent: AbsentStudent[] = res.absentData.map((att: any) => ({
            studentId: att.studentId._id || att.studentId,
            status: att.status === 'absent' ? 'absent' : att.status === 'excused' ? 'excused' : 'late',
            notes: att.notes || '',
            attendanceId: att._id, // Lưu ID để có thể cập nhật
          }));
          setAbsentStudents(absent);
        } else {
          setExistingAttendanceRecords([]);
          setAbsentStudents([]);
        }
      } catch (err) {
        console.log('No existing attendance:', err);
        setExistingAttendanceRecords([]);
        setAbsentStudents([]);
      }
    };
    fetchExistingAttendance();
  }, [homeroomClass, selectedDate, selectedSession, schoolYear, semester]);

  // ✅ Thêm học sinh vào danh sách vắng mặt
  const handleAddAbsent = (studentId: string) => {
    if (absentStudents.find(a => a.studentId === studentId)) {
      return; // Đã có trong danh sách vắng
    }
    setAbsentStudents([
      ...absentStudents,
      {
        studentId,
        status: 'absent',
        notes: '',
      },
    ]);
  };

  // ✅ Xóa học sinh khỏi danh sách vắng mặt
  const handleRemoveAbsent = (studentId: string) => {
    setAbsentStudents(absentStudents.filter(a => a.studentId !== studentId));
  };

  // ✅ Cập nhật trạng thái vắng mặt
  const handleStatusChange = (studentId: string, status: 'absent' | 'excused' | 'late') => {
    setAbsentStudents(absentStudents.map(a => 
      a.studentId === studentId ? { ...a, status } : a
    ));
  };

  // ✅ Cập nhật ghi chú
  const handleNotesChange = (studentId: string, notes: string) => {
    setAbsentStudents(absentStudents.map(a => 
      a.studentId === studentId ? { ...a, notes } : a
    ));
  };

  // ✅ Kiểm tra xem có phải ngày trước đó không
  const isPastDate = () => {
    const selected = new Date(selectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selected.setHours(0, 0, 0, 0);
    return selected < today;
  };

  // ✅ Lưu điểm danh
  const handleSave = async () => {
    if (!homeroomClass?._id || !selectedDate || !selectedSession) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng chọn đầy đủ lớp, ngày và buổi học',
        variant: 'destructive',
      });
      return;
    }

    // ✅ Nếu là ngày trước và có thay đổi → yêu cầu lý do
    if (isPastDate() && existingAttendanceRecords.length > 0) {
      // Có điểm danh cũ, cần kiểm tra có thay đổi không
      const hasChanges = absentStudents.some(absent => {
        const oldRecord = existingAttendanceRecords.find(
          (r: any) => (r.studentId._id || r.studentId) === absent.studentId
        );
        if (!oldRecord) return true; // Thêm mới
        return (
          oldRecord.status !== absent.status ||
          (oldRecord.notes || '') !== (absent.notes || '')
        );
      });

      if (hasChanges && !editReason) {
        toast({
          title: 'Thiếu lý do',
          description: 'Khi chỉnh sửa điểm danh của ngày trước, vui lòng nhập lý do chỉnh sửa',
          variant: 'destructive',
        });
        setShowEditDialog(true);
        return;
      }
    }

    try {
      setSaving(true);
      
      // ✅ Nếu là ngày trước và có bản ghi cũ → cập nhật từng bản ghi với reason trước
      if (isPastDate() && existingAttendanceRecords.length > 0) {
        let updatedCount = 0;
        
        // Cập nhật các bản ghi đã có (để lưu editHistory)
        for (const absent of absentStudents) {
          const oldRecord = existingAttendanceRecords.find(
            (r: any) => (r.studentId._id || r.studentId) === absent.studentId
          );
          if (oldRecord && oldRecord._id) {
            const hasChanged = 
              oldRecord.status !== absent.status ||
              (oldRecord.notes || '') !== (absent.notes || '');
            
            if (hasChanged) {
              await attendanceApi.updateAttendance(oldRecord._id, {
                status: absent.status,
                notes: absent.notes,
                reason: editReason || 'Chỉnh sửa điểm danh ngày trước',
              });
              updatedCount++;
            }
          }
        }
        
        // ✅ Tạo mới cho học sinh mới vắng (nếu có)
        const newAbsentStudents = absentStudents.filter(absent => {
          const oldRecord = existingAttendanceRecords.find(
            (r: any) => (r.studentId._id || r.studentId) === absent.studentId
          );
          return !oldRecord;
        });

        let createdCount = 0;
        if (newAbsentStudents.length > 0) {
          const res = await attendanceApi.takeAttendance({
            classId: homeroomClass._id,
            date: selectedDate,
            session: selectedSession,
            absentStudents: newAbsentStudents,
            schoolYear,
            semester,
          });
          createdCount = res.absentCount || newAbsentStudents.length;
        }

        // ✅ Xóa các bản ghi không còn trong danh sách vắng (học sinh đã có mặt)
        // Note: Cần endpoint xóa hoặc để admin xóa, hoặc có thể để lại (không ảnh hưởng thống kê)

        toast({
          title: 'Thành công',
          description: `${updatedCount > 0 ? `Đã chỉnh sửa ${updatedCount} học sinh. ` : ''}${createdCount > 0 ? `Đã thêm ${createdCount} học sinh vắng mới. ` : ''}Tổng ${absentStudents.length} học sinh vắng mặt.`,
        });
      } else {
        // ✅ Ngày mới hoặc chưa có điểm danh → lưu bình thường
        const res = await attendanceApi.takeAttendance({
          classId: homeroomClass._id,
          date: selectedDate,
          session: selectedSession,
          absentStudents: absentStudents,
          schoolYear,
          semester,
        });

        toast({
          title: 'Thành công',
          description: res.message || `Đã điểm danh vắng ${res.absentCount} học sinh`,
        });
      }
      
      setEditReason(''); // Reset lý do
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

  const getStatusBadge = (status: string) => {
    switch (status) {
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

  const absentStudentIds = new Set(absentStudents.map(a => a.studentId));
  const presentStudents = students.filter(s => !absentStudentIds.has(s._id));
  const stats = {
    total: students.length,
    present: presentStudents.length,
    absent: absentStudents.filter(a => a.status === 'absent').length,
    excused: absentStudents.filter(a => a.status === 'excused').length,
    late: absentStudents.filter(a => a.status === 'late').length,
  };

  if (loading && !homeroomClass) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Đang tải dữ liệu...</p>
        </CardContent>
      </Card>
    );
  }

  if (!homeroomClass) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Chưa có lớp chủ nhiệm</h3>
          <p className="text-muted-foreground">
            Thầy/cô chưa được phân công làm giáo viên chủ nhiệm lớp nào trong năm học này.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Điểm danh lớp chủ nhiệm</h1>
          <p className="text-muted-foreground">
            {homeroomClass.className} - Chỉ cần nhập danh sách học sinh vắng mặt
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
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

      {/* Cảnh báo nếu chỉnh sửa điểm danh ngày trước */}
      {isPastDate() && existingAttendanceRecords.length > 0 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Bạn đang chỉnh sửa điểm danh của ngày trước. Vui lòng nhập lý do chỉnh sửa khi lưu.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Chọn thông tin điểm danh</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Năm học</Label>
              <Select value={schoolYear} onValueChange={setSchoolYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {allSchoolYears.map(y => (
                    <SelectItem key={y.code} value={y.code}>
                      {y.name} {currentYearData?.code === y.code && "(Hiện tại)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label>Ngày</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Buổi học</Label>
              <Select
                value={selectedSession}
                onValueChange={(value) => setSelectedSession(value as 'morning' | 'afternoon')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    // ✅ Xác định buổi chính/phụ dựa trên khối của lớp
                    let mainSession: 'morning' | 'afternoon' = 'morning';
                    let extraSession: 'morning' | 'afternoon' = 'afternoon';
                    
                    if (homeroomClass?.grade && scheduleConfig) {
                      // Lấy rule từ gradeConfigs (ưu tiên) hoặc gradeSessionRules (fallback)
                      const grade = String(homeroomClass.grade);
                      let rule = null;
                      
                      // Ưu tiên lấy từ gradeConfigs
                      if (scheduleConfig.gradeConfigs) {
                        const gradeConfig = scheduleConfig.gradeConfigs[grade as '10' | '11' | '12'];
                        if (gradeConfig?.rules) {
                          rule = gradeConfig.rules;
                        }
                      }
                      
                      // Fallback về gradeSessionRules
                      if (!rule && scheduleConfig.gradeSessionRules) {
                        rule = scheduleConfig.gradeSessionRules.find((r: any) => r?.grade === grade);
                      }
                      
                      if (rule?.session) {
                        if (rule.session === 'morning') {
                          mainSession = 'morning';
                          extraSession = 'afternoon';
                        } else if (rule.session === 'afternoon') {
                          mainSession = 'afternoon';
                          extraSession = 'morning';
                        } else if (rule.session === 'both') {
                          // Nếu cả hai buổi, mặc định sáng là chính
                          mainSession = 'morning';
                          extraSession = 'afternoon';
                        }
                      }
                    }
                    
                    // ✅ Hiển thị buổi chính trước, buổi phụ sau
                    return (
                      <>
                        <SelectItem value={mainSession}>
                          <div className="flex items-center gap-2">
                            {mainSession === 'morning' ? (
                              <Sun className="h-4 w-4" />
                            ) : (
                              <Moon className="h-4 w-4" />
                            )}
                            Buổi {mainSession === 'morning' ? 'sáng' : 'chiều'} (Chính)
                          </div>
                        </SelectItem>
                        <SelectItem value={extraSession}>
                          <div className="flex items-center gap-2">
                            {extraSession === 'morning' ? (
                              <Sun className="h-4 w-4" />
                            ) : (
                              <Moon className="h-4 w-4" />
                            )}
                            Buổi {extraSession === 'morning' ? 'sáng' : 'chiều'} (Phụ)
                          </div>
                        </SelectItem>
                      </>
                    );
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {students.length > 0 && (
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
              <Calendar className="h-6 w-6 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-orange-600">{stats.late}</p>
              <p className="text-sm text-muted-foreground">Muộn</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Danh sách học sinh */}
      {students.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Học sinh có mặt */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                Học sinh có mặt ({presentStudents.length})
              </CardTitle>
              <CardDescription>
                Học sinh không có trong danh sách vắng mặt = có mặt
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {presentStudents.map((student) => (
                  <div
                    key={student._id}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{student.name}</p>
                      {student.studentCode && (
                        <p className="text-sm text-muted-foreground">{student.studentCode}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddAbsent(student._id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Vắng
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Học sinh vắng mặt */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <X className="h-5 w-5 text-red-600" />
                Học sinh vắng mặt ({absentStudents.length})
              </CardTitle>
              <CardDescription>
                Nhập danh sách học sinh vắng mặt, vắng có phép hoặc muộn
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {absentStudents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Chưa có học sinh vắng mặt. Click "Vắng" ở danh sách bên trái để thêm.
                  </p>
                ) : (
                  absentStudents.map((absent) => {
                    const student = students.find(s => s._id === absent.studentId);
                    if (!student) return null;
                    return (
                      <div
                        key={absent.studentId}
                        className="p-3 border rounded-lg bg-red-50 dark:bg-red-900/20"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{student.name}</p>
                              {student.studentCode && (
                                <p className="text-sm text-muted-foreground">{student.studentCode}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveAbsent(absent.studentId)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div>
                            <Label className="text-xs">Trạng thái</Label>
                            <Select
                              value={absent.status}
                              onValueChange={(value) => handleStatusChange(absent.studentId, value as any)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="absent">Vắng không phép</SelectItem>
                                <SelectItem value="excused">Vắng có phép</SelectItem>
                                <SelectItem value="late">Muộn</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Ghi chú (tùy chọn)</Label>
                            <Input
                              placeholder="Lý do vắng mặt..."
                              value={absent.notes || ''}
                              onChange={(e) => handleNotesChange(absent.studentId, e.target.value)}
                            />
                          </div>
                          {/* Hiển thị lịch sử chỉnh sửa nếu có */}
                          {existingAttendanceRecords.find(
                            (r: any) => (r.studentId._id || r.studentId) === absent.studentId
                          )?.editHistory && existingAttendanceRecords.find(
                            (r: any) => (r.studentId._id || r.studentId) === absent.studentId
                          )?.editHistory.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-2">
                              <History className="h-3 w-3 inline mr-1" />
                              Đã chỉnh sửa {existingAttendanceRecords.find(
                                (r: any) => (r.studentId._id || r.studentId) === absent.studentId
                              )?.editHistory.length} lần
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Chưa có học sinh</h3>
            <p className="text-muted-foreground">
              Lớp chủ nhiệm chưa có học sinh nào
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialog nhập lý do chỉnh sửa */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lý do chỉnh sửa điểm danh</DialogTitle>
            <DialogDescription>
              Bạn đang chỉnh sửa điểm danh của ngày trước. Vui lòng nhập lý do chỉnh sửa để BGH/Admin có thể giám sát.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Lý do chỉnh sửa *</Label>
              <Textarea
                placeholder="Ví dụ: Quên nhập điểm danh hôm qua, hoặc cần sửa từ 'vắng không phép' sang 'vắng có phép'..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Hủy
            </Button>
            <Button 
              onClick={() => {
                if (!editReason.trim()) {
                  toast({
                    title: 'Thiếu lý do',
                    description: 'Vui lòng nhập lý do chỉnh sửa',
                    variant: 'destructive',
                  });
                  return;
                }
                setShowEditDialog(false);
                handleSave();
              }}
            >
              Lưu với lý do
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

