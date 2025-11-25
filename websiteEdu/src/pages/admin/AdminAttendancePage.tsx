import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useClasses, useSchoolYears, useSubjects } from '@/hooks';
import { useTeachers } from '@/hooks/teachers/useTeachers';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import {
  ClipboardList,
  Search,
  Calendar,
  Check,
  X,
  Edit,
  Users,
  School,
  TrendingUp,
  Loader2,
  AlertCircle,
  Clock,
  Filter,
  BarChart3,
  PieChart,
  Activity,
  Eye,
  History,
  User,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import studentApi from '@/services/studentApi';

interface AttendanceRecord {
  _id: string;
  studentId: {
    _id: string;
    name: string;
    studentCode?: string;
    avatarUrl?: string;
  };
  classId: {
    _id: string;
    className: string;
    classCode: string;
    grade: string;
  };
  subjectId?: {
    _id: string;
    name: string;
    code?: string;
  };
  teacherId?: {
    _id: string;
    name: string;
  };
  date: string;
  period?: number;
  session?: 'morning' | 'afternoon';
  status: 'present' | 'absent' | 'excused' | 'late';
  notes?: string;
  schoolYear: string;
  semester: string;
}

interface OverviewStats {
  overall: {
    totalStudents: number;
    totalClasses: number;
    present: number;
    absent: number;
    excused: number;
    late: number;
    totalAbsent: number;
    attendanceRate: number;
  };
  byGrade: Array<{
    grade: string;
    totalStudents: number;
    totalClasses: number;
    present: number;
    absent: number;
    totalAbsent: number;
    attendanceRate: number;
  }>;
  topLowAttendance: Array<{
    classId: string;
    className: string;
    grade: string;
    attendanceRate: number;
    totalAbsent: number;
  }>;
}

const AdminAttendancePage = () => {
  const { toast } = useToast();
  const { classes } = useClasses();
  const { schoolYears: allSchoolYears, currentYearData } = useSchoolYears();
  const { subjects } = useSubjects();
  const { teachers } = useTeachers();
  const { currentYearCode } = useCurrentAcademicYear();
  const schoolYears = useMemo(() => 
    allSchoolYears.map(y => ({ code: y.code, name: y.name })),
    [allSchoolYears]
  );

  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [statsByClass, setStatsByClass] = useState<any[]>([]);
  const [statsByGrade, setStatsByGrade] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // Filters
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [dateRangeType, setDateRangeType] = useState<'day' | 'week' | 'month'>('day');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Edit dialog
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<'present' | 'absent' | 'excused' | 'late'>('present');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Detail dialog
  const [viewingStudent, setViewingStudent] = useState<AttendanceRecord | null>(null);
  const [studentDetail, setStudentDetail] = useState<any>(null);
  const [studentHistory, setStudentHistory] = useState<AttendanceRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Today's stats for summary cards
  const [todayStats, setTodayStats] = useState<any>(null);

  // Initialize school year - Ưu tiên năm học hiện tại
  useEffect(() => {
    if (currentYearCode) {
      // Ưu tiên năm học hiện tại từ hook
      setSchoolYear(currentYearCode);
    } else if (schoolYears.length > 0) {
      // Fallback: lấy năm học cuối cùng (thường là năm học hiện tại)
      const activeYear = schoolYears.find(y => y.code === currentYearCode) || schoolYears[schoolYears.length - 1];
      setSchoolYear(activeYear.code);
    } else {
      // Fallback cuối cùng: tính toán từ ngày hiện tại
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      setSchoolYear(currentYear);
    }
  }, [schoolYears, currentYearCode]);

  // Tự động set "Từ ngày" và "Đến ngày" dựa trên học kỳ
  useEffect(() => {
    if (!schoolYear || !semester) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Tìm năm học được chọn để lấy thông tin semesters
    const selectedYearData = allSchoolYears.find(y => y.code === schoolYear);
    
    let semesterStartDate: Date | null = null;
    let semesterEndDate: Date | null = null;
    
    if (selectedYearData && selectedYearData.semesters && selectedYearData.semesters.length > 0) {
      // Tìm học kỳ tương ứng (semester: '1' hoặc '2')
      const semesterCode = semester === '1' ? 'HK1' : 'HK2';
      const semesterData = selectedYearData.semesters.find(s => s.code === semesterCode);
      
      if (semesterData) {
        if (semesterData.startDate) {
          semesterStartDate = new Date(semesterData.startDate);
          semesterStartDate.setHours(0, 0, 0, 0);
        }
        if (semesterData.endDate) {
          semesterEndDate = new Date(semesterData.endDate);
          semesterEndDate.setHours(0, 0, 0, 0);
        }
      }
    }
    
    // Set "Đến ngày": ưu tiên ngày hiện tại, nếu vượt quá ngày cuối học kỳ thì dùng ngày cuối học kỳ
    const targetEndDate = semesterEndDate && today > semesterEndDate 
      ? semesterEndDate 
      : today;
    
    const endDateStr = targetEndDate.toISOString().split('T')[0];
    // Luôn tự động cập nhật "Đến ngày" khi thay đổi năm học/học kỳ
    setEndDate(endDateStr);
    
    // Set "Từ ngày": mặc định là ngày đầu học kỳ (nếu có), chỉ set khi chưa có giá trị
    if (semesterStartDate && !startDate) {
      const startDateStr = semesterStartDate.toISOString().split('T')[0];
      setStartDate(startDateStr);
    }
  }, [schoolYear, semester, allSchoolYears]);

  // Fetch today's stats for summary cards - CHỈ load khi có năm học
  const fetchTodayStats = async () => {
    if (!schoolYear || !semester) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const params: any = {
        schoolYear,
        semester,
        startDate: today,
        endDate: today,
      };
      const res = await attendanceApi.getAttendanceStats(params);
      if (res.success && res.data) {
        setTodayStats(res.data);
      }
    } catch (err) {
      console.error('Error fetching today stats:', err);
    }
  };

  // Fetch student detail and history
  const fetchStudentDetail = async (studentId: string) => {
    try {
      setDetailLoading(true);
      const student = await studentApi.getById(studentId);
      setStudentDetail(student);

      // Fetch 30 days history
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const historyRes = await attendanceApi.getAttendance({
        studentId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        schoolYear,
        semester,
      });
      
      if (historyRes.success && historyRes.data) {
        setStudentHistory(historyRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching student detail:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải thông tin học sinh',
        variant: 'destructive',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  // Open detail dialog
  const openDetailDialog = async (attendance: AttendanceRecord) => {
    setViewingStudent(attendance);
    await fetchStudentDetail(attendance.studentId._id);
  };

  // Fetch overview stats - CHỈ load khi có năm học
  const fetchOverview = async () => {
    if (!schoolYear || !semester) return;
    
    try {
      setOverviewLoading(true);
      const params: any = { schoolYear, semester };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await attendanceApi.getAttendanceOverview(params);
      if (res.success && res.data) {
        setOverviewStats(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching overview:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải thống kê tổng quan',
        variant: 'destructive',
      });
    } finally {
      setOverviewLoading(false);
    }
  };

  // Fetch stats by class - CHỈ load khi có năm học
  const fetchStatsByClass = async () => {
    if (!schoolYear || !semester) return;
    
    try {
      setStatsLoading(true);
      const params: any = { schoolYear, semester };
      if (selectedGrade) params.grade = selectedGrade;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await attendanceApi.getAttendanceStatsByClass(params);
      if (res.success && res.data) {
        setStatsByClass(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching stats by class:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch stats by grade - CHỈ load khi có năm học
  const fetchStatsByGrade = async () => {
    if (!schoolYear || !semester) return;
    
    try {
      setStatsLoading(true);
      const params: any = { schoolYear, semester };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await attendanceApi.getAttendanceStatsByGrade(params);
      if (res.success && res.data) {
        setStatsByGrade(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching stats by grade:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch trends - CHỈ load khi có năm học
  const fetchTrends = async () => {
    if (!schoolYear || !semester) return;
    
    try {
      setStatsLoading(true);
      const params: any = { 
        schoolYear, 
        semester, 
        groupBy: 'day',
      };
      if (selectedClassId) params.classId = selectedClassId;
      if (selectedGrade) params.grade = selectedGrade;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await attendanceApi.getAttendanceTrends(params);
      if (res.success && res.data) {
        setTrends(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching trends:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch attendance records - CHỈ load khi có năm học
  const fetchAttendance = async () => {
    if (!schoolYear || !semester) return;
    
    try {
      setLoading(true);
      const params: any = { schoolYear, semester };
      if (selectedClassId) params.classId = selectedClassId;
      if (selectedSubjectId) params.subjectId = selectedSubjectId;
      if (selectedTeacherId) params.teacherId = selectedTeacherId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      // Chỉ lấy học sinh vắng mặt (absent, excused, late)
      // Nếu có statusFilter và không phải 'all', dùng filter đó
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      } else {
        // Mặc định chỉ lấy vắng mặt - filter ở frontend
        // Backend sẽ trả về tất cả, nhưng frontend sẽ filter
      }

      const res = await attendanceApi.getAttendance(params);
      if (res.success && res.data) {
        // Chỉ lấy những bản ghi vắng mặt (absent, excused, late)
        const absentOnly = Array.isArray(res.data) 
          ? res.data.filter((att: AttendanceRecord) => 
              att.status === 'absent' || att.status === 'excused' || att.status === 'late'
            )
          : [];
        setAttendances(absentOnly);
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

  // Fetch edit history - CHỈ load khi có năm học
  const fetchEditHistory = async () => {
    if (!schoolYear || !semester) return;
    
    try {
      setLoading(true);
      const params: any = { schoolYear, semester };
      if (selectedClassId) params.classId = selectedClassId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await attendanceApi.getAttendanceEditHistory(params);
      if (res.success && res.data) {
        setEditHistory(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching edit history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load data based on active tab
  useEffect(() => {
    if (!schoolYear || !semester) return;

    if (activeTab === 'overview') {
      fetchOverview();
      fetchTodayStats();
    } else if (activeTab === 'summary') {
      fetchStatsByClass();
      fetchStatsByGrade();
      fetchTrends();
    } else if (activeTab === 'details') {
      fetchAttendance();
    } else if (activeTab === 'history') {
      fetchEditHistory();
    }
  }, [activeTab, schoolYear, semester, selectedClassId, selectedGrade, startDate, endDate]);

  // Filtered attendances - chỉ hiển thị vắng mặt
  const filteredAttendances = useMemo(() => {
    // Chỉ lấy những bản ghi vắng mặt (absent, excused, late)
    let filtered = attendances.filter((att) => 
      att.status === 'absent' || att.status === 'excused' || att.status === 'late'
    );

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((att) =>
        att.studentId.name.toLowerCase().includes(searchLower) ||
        att.studentId.studentCode?.toLowerCase().includes(searchLower) ||
        att.classId.className.toLowerCase().includes(searchLower)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((att) => att.status === statusFilter);
    }

    return filtered;
  }, [attendances, searchTerm, statusFilter]);

  // Open edit dialog
  const openEditDialog = (attendance: AttendanceRecord) => {
    setEditingAttendance(attendance);
    setEditStatus(attendance.status);
    setEditNotes(attendance.notes || '');
    setEditReason('');
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingAttendance) return;

    try {
      setSaving(true);
      const isPastDate = new Date(editingAttendance.date) < new Date();
      
      await attendanceApi.updateAttendance(editingAttendance._id, {
        status: editStatus,
        notes: editNotes,
        reason: isPastDate ? editReason : undefined,
      });
      
      toast({
        title: 'Thành công',
        description: 'Đã cập nhật điểm danh thành công',
      });
      setEditingAttendance(null);
      fetchAttendance();
      fetchOverview();
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
          <p className="text-muted-foreground">
            Xem và quản lý điểm danh học sinh toàn trường - Tổng quát, Khái quát và Chi tiết
          </p>
        </div>
      </div>

      {/* Summary Cards - Hiển thị ở đầu trang */}
      {todayStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700 mb-1">📗 Có mặt hôm nay</p>
                  <p className="text-3xl font-bold text-green-700">{todayStats.present || 0}</p>
                  <p className="text-xs text-green-600 mt-1">học sinh</p>
                </div>
                <Check className="h-12 w-12 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700 mb-1">📕 Tổng vắng hôm nay</p>
                  <p className="text-3xl font-bold text-red-700">{todayStats.totalAbsent || 0}</p>
                  <p className="text-xs text-red-600 mt-1">học sinh</p>
                </div>
                <X className="h-12 w-12 text-red-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-1">📘 Tỉ lệ chuyên cần</p>
                  <p className="text-3xl font-bold text-blue-700">{todayStats.attendanceRate || 0}%</p>
                  <p className="text-xs text-blue-600 mt-1">tỷ lệ có mặt</p>
                </div>
                <TrendingUp className="h-12 w-12 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700 mb-1">📙 Lớp vắng nhiều</p>
                  <p className="text-3xl font-bold text-orange-700">
                    {overviewStats?.topLowAttendance?.[0]?.className?.split(' ')[0] || '-'}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    {overviewStats?.topLowAttendance?.[0]?.attendanceRate || 0}% có mặt
                  </p>
                </div>
                <AlertCircle className="h-12 w-12 text-orange-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Bộ lọc
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <Label>Năm học</Label>
              <Select value={schoolYear} onValueChange={setSchoolYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((y) => (
                    <SelectItem key={y.code} value={y.code}>
                      {y.name}
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
              <Label>Khối</Label>
              <Select value={selectedGrade || 'all'} onValueChange={(v) => setSelectedGrade(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả khối" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả khối</SelectItem>
                  <SelectItem value="10">Khối 10</SelectItem>
                  <SelectItem value="11">Khối 11</SelectItem>
                  <SelectItem value="12">Khối 12</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lớp học</Label>
              <Select value={selectedClassId || 'all'} onValueChange={(v) => setSelectedClassId(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả lớp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả lớp</SelectItem>
                  {classes
                    .filter((c) => !selectedGrade || c.grade === selectedGrade)
                    .map((cls) => (
                      <SelectItem key={cls._id} value={cls._id}>
                        {cls.className} - Khối {cls.grade}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Loại thời gian</Label>
              <Select value={dateRangeType} onValueChange={(v: any) => setDateRangeType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Ngày</SelectItem>
                  <SelectItem value="week">Tuần</SelectItem>
                  <SelectItem value="month">Tháng</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Từ ngày</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Đến ngày</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Môn học</Label>
              <Select value={selectedSubjectId || 'all'} onValueChange={(v) => setSelectedSubjectId(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả môn" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả môn</SelectItem>
                  {subjects.map((subj) => (
                    <SelectItem key={subj._id} value={subj._id}>
                      {subj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Giáo viên</Label>
              <Select value={selectedTeacherId || 'all'} onValueChange={(v) => setSelectedTeacherId(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả giáo viên" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả giáo viên</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher._id} value={teacher._id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Tổng quan
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Khái quát
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Chi tiết
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Lịch sử
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Tổng quan */}
        <TabsContent value="overview" className="space-y-4">
          {overviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Đang tải thống kê tổng quan...</span>
            </div>
          ) : overviewStats ? (
            <>
              {/* Overall Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Users className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-bold">{overviewStats.overall.totalStudents}</p>
                    <p className="text-sm text-muted-foreground">Tổng học sinh</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <School className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-bold">{overviewStats.overall.totalClasses}</p>
                    <p className="text-sm text-muted-foreground">Tổng lớp</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Check className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-600">{overviewStats.overall.present}</p>
                    <p className="text-sm text-muted-foreground">Có mặt</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <X className="h-6 w-6 text-red-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-600">{overviewStats.overall.absent}</p>
                    <p className="text-sm text-muted-foreground">Vắng không phép</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <AlertCircle className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-yellow-600">{overviewStats.overall.excused}</p>
                    <p className="text-sm text-muted-foreground">Vắng có phép</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-orange-600">{overviewStats.overall.late}</p>
                    <p className="text-sm text-muted-foreground">Muộn</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-bold text-primary">{overviewStats.overall.attendanceRate}%</p>
                    <p className="text-sm text-muted-foreground">Tỷ lệ có mặt</p>
                  </CardContent>
                </Card>
              </div>

              {/* By Grade */}
              <Card>
                <CardHeader>
                  <CardTitle>Thống kê theo khối</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Khối</TableHead>
                          <TableHead>Số lớp</TableHead>
                          <TableHead>Số học sinh</TableHead>
                          <TableHead>Có mặt</TableHead>
                          <TableHead>Vắng không phép</TableHead>
                          <TableHead>Tổng vắng</TableHead>
                          <TableHead>Tỷ lệ có mặt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overviewStats.byGrade.map((grade) => (
                          <TableRow key={grade.grade}>
                            <TableCell className="font-medium">Khối {grade.grade}</TableCell>
                            <TableCell>{grade.totalClasses}</TableCell>
                            <TableCell>{grade.totalStudents}</TableCell>
                            <TableCell className="text-green-600 font-medium">{grade.present}</TableCell>
                            <TableCell className="text-red-600 font-medium">{grade.absent}</TableCell>
                            <TableCell>{grade.totalAbsent}</TableCell>
                            <TableCell>
                              <Badge variant={grade.attendanceRate >= 95 ? 'default' : grade.attendanceRate >= 90 ? 'secondary' : 'destructive'}>
                                {grade.attendanceRate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Top Low Attendance Classes */}
              {overviewStats.topLowAttendance.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      Top 5 lớp có tỷ lệ điểm danh thấp nhất
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {overviewStats.topLowAttendance.map((cls, index) => (
                        <div key={cls.classId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">#{index + 1}</Badge>
                            <div>
                              <p className="font-medium">{cls.className}</p>
                              <p className="text-sm text-muted-foreground">Khối {cls.grade}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Tỷ lệ có mặt</p>
                              <p className="text-lg font-bold text-red-600">{cls.attendanceRate}%</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Tổng vắng</p>
                              <p className="text-lg font-bold">{cls.totalAbsent}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : !schoolYear || !semester ? (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Vui lòng chọn năm học</h3>
              <p className="text-muted-foreground">Hệ thống sẽ tự động load dữ liệu theo năm học được chọn</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Chưa có dữ liệu</h3>
              <p className="text-muted-foreground">Không có dữ liệu điểm danh cho năm học {schoolYear} - Học kỳ {semester}</p>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Khái quát */}
        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Stats by Class */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <School className="h-5 w-5" />
                  Thống kê theo lớp
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span className="text-muted-foreground">Đang tải...</span>
                  </div>
                ) : statsByClass.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lớp</TableHead>
                          <TableHead>HS</TableHead>
                          <TableHead>Có mặt</TableHead>
                          <TableHead>Vắng</TableHead>
                          <TableHead>Tỷ lệ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statsByClass.slice(0, 10).map((cls) => (
                          <TableRow key={cls.classId}>
                            <TableCell className="font-medium">{cls.className}</TableCell>
                            <TableCell>{cls.totalStudents}</TableCell>
                            <TableCell className="text-green-600">{cls.present}</TableCell>
                            <TableCell className="text-red-600">{cls.totalAbsent}</TableCell>
                            <TableCell>
                              <Badge variant={cls.attendanceRate >= 95 ? 'default' : 'destructive'}>
                                {cls.attendanceRate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {statsByClass.length > 10 && (
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        Hiển thị 10/{statsByClass.length} lớp đầu tiên
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats by Grade */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Thống kê theo khối
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span className="text-muted-foreground">Đang tải...</span>
                  </div>
                ) : statsByGrade.length > 0 ? (
                  <div className="space-y-3">
                    {statsByGrade.map((grade) => (
                      <div key={grade.grade} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Khối {grade.grade}</h4>
                          <Badge variant={grade.attendanceRate >= 95 ? 'default' : 'destructive'}>
                            {grade.attendanceRate}%
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Học sinh</p>
                            <p className="font-medium">{grade.totalStudents}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Có mặt</p>
                            <p className="font-medium text-green-600">{grade.present}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Vắng</p>
                            <p className="font-medium text-red-600">{grade.totalAbsent}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Xu hướng điểm danh
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                  <span className="text-muted-foreground">Đang tải...</span>
                </div>
              ) : trends.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ngày</TableHead>
                        <TableHead>Có mặt</TableHead>
                        <TableHead>Vắng không phép</TableHead>
                        <TableHead>Vắng có phép</TableHead>
                        <TableHead>Muộn</TableHead>
                        <TableHead>Tổng vắng</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trends.slice(0, 15).map((trend) => (
                        <TableRow key={trend.date}>
                          <TableCell>
                            {new Date(trend.dateObj || trend.date).toLocaleDateString('vi-VN')}
                          </TableCell>
                          <TableCell className="text-green-600">{trend.present}</TableCell>
                          <TableCell className="text-red-600">{trend.absent}</TableCell>
                          <TableCell className="text-yellow-600">{trend.excused}</TableCell>
                          <TableCell className="text-orange-600">{trend.late}</TableCell>
                          <TableCell>{trend.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {trends.length > 15 && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      Hiển thị 15/{trends.length} ngày gần nhất
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu xu hướng
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Analytics - Biểu đồ thống kê */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Line Chart - Tỷ lệ chuyên cần theo tuần */}
            <Card>
              <CardHeader>
                <CardTitle>Tỷ lệ chuyên cần theo tuần</CardTitle>
                <CardDescription>Xu hướng điểm danh trong 4 tuần gần nhất</CardDescription>
              </CardHeader>
              <CardContent>
                {trends.length > 0 ? (
                  <ChartContainer
                    config={{
                      attendanceRate: {
                        label: 'Tỷ lệ có mặt (%)',
                        color: 'hsl(var(--chart-1))',
                      },
                    }}
                    className="h-[300px]"
                  >
                    <LineChart data={trends.slice(-28).map(t => ({
                      date: new Date(t.dateObj || t.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
                      attendanceRate: parseFloat(t.attendanceRate || '0'),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 100]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line 
                        type="monotone" 
                        dataKey="attendanceRate" 
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pie Chart - Tỷ lệ các trạng thái vắng */}
            <Card>
              <CardHeader>
                <CardTitle>Tỷ lệ các trạng thái vắng</CardTitle>
                <CardDescription>Phân bổ các loại vắng mặt</CardDescription>
              </CardHeader>
              <CardContent>
                {overviewStats ? (
                  <ChartContainer
                    config={{
                      absent: { label: 'Vắng không phép', color: '#ef4444' },
                      excused: { label: 'Vắng có phép', color: '#eab308' },
                      late: { label: 'Muộn', color: '#f97316' },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer>
                      <RechartsPieChart>
                        <Pie
                          data={[
                            { name: 'Vắng không phép', value: overviewStats.overall.absent },
                            { name: 'Vắng có phép', value: overviewStats.overall.excused },
                            { name: 'Muộn', value: overviewStats.overall.late },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          <Cell fill="#ef4444" />
                          <Cell fill="#eab308" />
                          <Cell fill="#f97316" />
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bar Chart - Thống kê theo lớp */}
          <Card>
            <CardHeader>
              <CardTitle>Thống kê điểm danh theo lớp</CardTitle>
              <CardDescription>Top 10 lớp có tỷ lệ điểm danh tốt nhất</CardDescription>
            </CardHeader>
            <CardContent>
              {statsByClass.length > 0 ? (
                <ChartContainer
                  config={{
                    attendanceRate: {
                      label: 'Tỷ lệ có mặt (%)',
                      color: 'hsl(var(--chart-1))',
                    },
                  }}
                  className="h-[400px]"
                >
                  <BarChart data={statsByClass.slice(0, 10).map(cls => ({
                    className: cls.className,
                    attendanceRate: cls.attendanceRate,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="className" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis domain={[0, 100]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="attendanceRate" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  Chưa có dữ liệu
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Chi tiết */}
        <TabsContent value="details" className="space-y-4">
          {/* Additional filters for details */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div>
                  <Label>Trạng thái vắng</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả vắng mặt</SelectItem>
                      <SelectItem value="absent">Vắng không phép</SelectItem>
                      <SelectItem value="excused">Vắng có phép</SelectItem>
                      <SelectItem value="late">Muộn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={fetchAttendance} variant="outline" className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    Tìm kiếm
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Danh sách điểm danh chi tiết
              </CardTitle>
              <CardDescription>
                Chỉ hiển thị học sinh vắng mặt (vắng không phép, vắng có phép, muộn) - Tổng số: {filteredAttendances.length} bản ghi
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>STT</TableHead>
                          <TableHead>Học sinh</TableHead>
                          <TableHead>Lớp</TableHead>
                          <TableHead>Buổi</TableHead>
                          <TableHead>Giáo viên</TableHead>
                          <TableHead>Ngày</TableHead>
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
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage 
                                    src={att.studentId.avatarUrl} 
                                    alt={att.studentId.name}
                                  />
                                  <AvatarFallback>
                                    {att.studentId.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{att.studentId.name}</div>
                                  {att.studentId.studentCode && (
                                    <div className="text-sm text-muted-foreground">
                                      {att.studentId.studentCode}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {att.classId.className} - Khối {att.classId.grade}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {att.session ? (
                                <Badge variant="outline">
                                  {att.session === 'morning' ? 'Buổi sáng' : 'Buổi chiều'}
                                </Badge>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>
                              {att.teacherId ? att.teacherId.name : '-'}
                            </TableCell>
                            <TableCell>
                              {new Date(att.date).toLocaleDateString('vi-VN')}
                            </TableCell>
                            <TableCell>{getStatusBadge(att.status)}</TableCell>
                            <TableCell>
                              {att.notes ? (
                                <span className="text-sm text-muted-foreground">{att.notes}</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDetailDialog(att)}
                                  className="h-8 w-8"
                                  title="Xem chi tiết"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(att)}
                                  className="h-8 w-8"
                                  title="Chỉnh sửa"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
        </TabsContent>

        {/* Tab 4: Lịch sử chỉnh sửa */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Lịch sử chỉnh sửa điểm danh
              </CardTitle>
              <CardDescription>
                Theo dõi tất cả các thay đổi về điểm danh
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                  <span className="text-muted-foreground">Đang tải lịch sử...</span>
                </div>
              ) : editHistory.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Thời gian</TableHead>
                          <TableHead>Học sinh</TableHead>
                          <TableHead>Lớp</TableHead>
                          <TableHead>Ngày điểm danh</TableHead>
                          <TableHead>Người chỉnh sửa</TableHead>
                          <TableHead>Thay đổi</TableHead>
                          <TableHead>Lý do</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editHistory.map((edit) => (
                          <TableRow key={edit._id}>
                            <TableCell>
                              {new Date(edit.editedAt).toLocaleString('vi-VN')}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{edit.student?.name}</div>
                                {edit.student?.studentCode && (
                                  <div className="text-sm text-muted-foreground">
                                    {edit.student.studentCode}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{edit.class?.className || '-'}</TableCell>
                            <TableCell>
                              {new Date(edit.date).toLocaleDateString('vi-VN')}
                            </TableCell>
                            <TableCell>{edit.editedBy?.name || 'Admin'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-red-50">
                                  {edit.oldStatus === 'present' ? 'Có mặt' : 
                                   edit.oldStatus === 'absent' ? 'Vắng không phép' :
                                   edit.oldStatus === 'excused' ? 'Vắng có phép' : 'Muộn'}
                                </Badge>
                                <span>→</span>
                                <Badge variant="outline" className="bg-green-50">
                                  {edit.newStatus === 'present' ? 'Có mặt' : 
                                   edit.newStatus === 'absent' ? 'Vắng không phép' :
                                   edit.newStatus === 'excused' ? 'Vắng có phép' : 'Muộn'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {edit.reason || '-'}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Chưa có lịch sử chỉnh sửa</h3>
                  <p className="text-muted-foreground">
                    Không có thay đổi nào trong khoảng thời gian đã chọn
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingAttendance} onOpenChange={(open) => !open && setEditingAttendance(null)}>
        <DialogContent className="max-w-2xl">
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
                <Label>Lớp - Buổi</Label>
                <Input
                  value={`${editingAttendance.classId.className} - ${
                    editingAttendance.session 
                      ? (editingAttendance.session === 'morning' ? 'Buổi sáng' : 'Buổi chiều')
                      : '-'
                  }`}
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
              {new Date(editingAttendance.date) < new Date() && (
                <div>
                  <Label>Lý do chỉnh sửa *</Label>
                  <Input
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Bắt buộc khi chỉnh sửa điểm danh ngày trước"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Vui lòng nhập lý do khi chỉnh sửa điểm danh của ngày trước
                  </p>
                </div>
              )}
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

      {/* Detail Dialog - Xem chi tiết điểm danh học sinh */}
      <Dialog open={!!viewingStudent} onOpenChange={(open) => !open && setViewingStudent(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết điểm danh học sinh</DialogTitle>
            <DialogDescription>
              Thông tin chi tiết và lịch sử điểm danh 30 ngày gần nhất
            </DialogDescription>
          </DialogHeader>
          {viewingStudent && (
            <div className="space-y-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                  <span className="text-muted-foreground">Đang tải thông tin...</span>
                </div>
              ) : (
                <>
                  {/* Thông tin học sinh */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                          <AvatarImage 
                            src={studentDetail?.avatarUrl || viewingStudent.studentId.avatarUrl} 
                            alt={viewingStudent.studentId.name}
                          />
                          <AvatarFallback className="text-2xl">
                            {viewingStudent.studentId.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold">{viewingStudent.studentId.name}</h3>
                          <p className="text-muted-foreground">
                            Mã học sinh: {viewingStudent.studentId.studentCode || 'Chưa có mã'}
                          </p>
                          <p className="text-muted-foreground">
                            Lớp: {viewingStudent.classId.className} - Khối {viewingStudent.classId.grade}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Trạng thái trong ngày */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Trạng thái điểm danh hôm nay</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">
                              {viewingStudent.session === 'morning' ? 'Buổi sáng' : 'Buổi chiều'}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {new Date(viewingStudent.date).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                          {getStatusBadge(viewingStudent.status)}
                        </div>
                        {viewingStudent.notes && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <strong>Ghi chú:</strong> {viewingStudent.notes}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Lịch sử 30 ngày gần nhất */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Lịch sử điểm danh 30 ngày gần nhất</CardTitle>
                      <CardDescription>
                        Tổng số: {studentHistory.length} bản ghi
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {studentHistory.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="overflow-x-auto max-h-[400px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Ngày</TableHead>
                                  <TableHead>Buổi</TableHead>
                                  <TableHead>Trạng thái</TableHead>
                                  <TableHead>Ghi chú</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {studentHistory.map((record) => (
                                  <TableRow key={record._id}>
                                    <TableCell>
                                      {new Date(record.date).toLocaleDateString('vi-VN')}
                                    </TableCell>
                                    <TableCell>
                                      {record.session ? (
                                        <Badge variant="outline">
                                          {record.session === 'morning' ? 'Sáng' : 'Chiều'}
                                        </Badge>
                                      ) : (
                                        '-'
                                      )}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                                    <TableCell>
                                      {record.notes ? (
                                        <span className="text-sm text-muted-foreground">{record.notes}</span>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Chưa có lịch sử điểm danh
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingStudent(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAttendancePage;
