import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Database, Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import gradesApi from '@/services/gradesApi';
import api from '@/services/axiosInstance';
import schoolConfigApi from '@/services/schoolConfigApi';
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSchoolYears, useStudents } from '@/hooks';

export default function GradesAdminPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'class' | 'student'>('class');
  
  // Mode: Xem theo lớp/môn
  const [filters, setFilters] = useState({
    classId: '',
    subjectId: '',
    schoolYear: '',
    semester: '1',
  });
  const [gradeLevel, setGradeLevel] = useState<'10' | '11' | '12' | 'all'>('all');
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  
  // Mode: Xem theo học sinh
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentFilters, setStudentFilters] = useState({
    schoolYear: '',
    semester: '1',
  });
  const [studentGrades, setStudentGrades] = useState<any[]>([]);
  
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ✅ Lấy danh sách học sinh
  const { students } = useStudents();

  // ✅ Lấy danh sách năm học từ hooks
  const { schoolYears: allSchoolYears } = useSchoolYears();
  
  // 1. Lấy danh sách học kỳ
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const semRes = await schoolConfigApi.getSemesters();
        setSemesters(semRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSemesters();
  }, []);

  // ✅ Set schoolYears và filters từ hooks
  useEffect(() => {
    const years = allSchoolYears.map(y => ({ code: y.code, name: y.name }));
    setSchoolYears(years);
    if (!filters.schoolYear && years.length > 0) {
      setFilters((prev) => ({
        ...prev,
        schoolYear: years[years.length - 1].code,
        semester: '1',
      }));
    }
    // Tự động set năm học cho studentFilters
    if (!studentFilters.schoolYear && years.length > 0) {
      setStudentFilters((prev) => ({
        ...prev,
        schoolYear: years[years.length - 1].code,
        semester: '1',
      }));
    }
  }, [allSchoolYears]);

  // 2. Lấy danh sách lớp & môn
  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const [classRes, subjectRes] = await Promise.all([api.get('/class'), api.get('/subjects')]);
        setClasses(classRes.data);
        setSubjects(subjectRes.data);
      } catch (err) {
        toast({ title: 'Lỗi', description: 'Không thể tải lớp/môn', variant: 'destructive' });
      }
    };
    fetchBaseData();
  }, []);

  // 3. Xem bảng điểm theo lớp/môn
  const fetchSummary = async () => {
    if (!filters.classId || !filters.subjectId || !filters.schoolYear || !filters.semester) {
      toast({ title: 'Thiếu thông tin', description: 'Chọn lớp, môn, năm học, học kỳ' });
      return;
    }
    setLoading(true);
    try {
      const res = await gradesApi.getClassSubjectSummary(filters);
      setData(res.data || []);
    } catch (err) {
      toast({ title: 'Lỗi', description: 'Không thể tải bảng điểm', variant: 'destructive' });
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // 4. Xem điểm của 1 học sinh
  const fetchStudentGrades = async () => {
    if (!selectedStudentId || !studentFilters.schoolYear || !studentFilters.semester) {
      toast({ title: 'Thiếu thông tin', description: 'Chọn học sinh, năm học, học kỳ' });
      return;
    }
    setLoading(true);
    try {
      const res = await gradesApi.getStudentGrades({
        studentId: selectedStudentId,
        schoolYear: studentFilters.schoolYear,
        semester: studentFilters.semester,
      });
      setStudentGrades(res.success ? (res.data || []) : []);
    } catch (err: any) {
      toast({ 
        title: 'Lỗi', 
        description: err.response?.data?.message || 'Không thể tải điểm số', 
        variant: 'destructive' 
      });
      setStudentGrades([]);
    } finally {
      setLoading(false);
    }
  };

  // Lọc học sinh theo search
  const filteredStudents = students.filter((s) => {
    const searchLower = studentSearch.toLowerCase();
    return (
      s.name?.toLowerCase().includes(searchLower) ||
      s.studentCode?.toLowerCase().includes(searchLower) ||
      s.fullName?.toLowerCase().includes(searchLower)
    );
  });

  // ✅ Điều hướng sang trang khởi tạo bảng điểm
  const handleNavigateToInit = () => {
    navigate('/admin/init-grades');
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Quản lý bảng điểm</CardTitle>
            <Button variant="outline" onClick={handleNavigateToInit}>
              <Database className="h-4 w-4 mr-2" />
              Khởi tạo bảng điểm
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'class' | 'student')}>
            <TabsList className="mb-6">
              <TabsTrigger value="class">Xem theo lớp/môn</TabsTrigger>
              <TabsTrigger value="student">Xem theo học sinh</TabsTrigger>
            </TabsList>

            {/* Tab: Xem theo lớp/môn */}
            <TabsContent value="class" className="space-y-4">
          <div className="flex flex-wrap gap-4 mb-6 items-end">
            {/* Khối */}
            <Select value={gradeLevel} onValueChange={(v) => setGradeLevel(v as any)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Khối" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="11">11</SelectItem>
                <SelectItem value="12">12</SelectItem>
              </SelectContent>
            </Select>

            {/* Lớp */}
            <Select value={filters.classId} onValueChange={(v) => setFilters({ ...filters, classId: v })}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Chọn lớp" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.className}</SelectItem>)}</SelectContent>
            </Select>

            {/* Môn */}
            <Select value={filters.subjectId} onValueChange={(v) => setFilters({ ...filters, subjectId: v })}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Chọn môn" /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>

            {/* Năm học */}
            <Select value={filters.schoolYear} onValueChange={(v) => setFilters({ ...filters, schoolYear: v })}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Chọn năm học" /></SelectTrigger>
              <SelectContent>{schoolYears.map((y) => <SelectItem key={y.code} value={y.code}>{y.name}</SelectItem>)}</SelectContent>
            </Select>

            {/* Học kỳ */}
            <Select value={filters.semester} onValueChange={(v) => setFilters({ ...filters, semester: v })}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Học kỳ" /></SelectTrigger>
              <SelectContent>{semesters.map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}</SelectContent>
            </Select>

            {/* Nút xem */}
            <Button onClick={fetchSummary} disabled={loading}>{loading ? 'Đang tải...' : 'Xem bảng điểm'}</Button>
          </div>

          {/* Bảng dữ liệu */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">STT</TableHead>
                <TableHead>Học sinh</TableHead>
                <TableHead>Điểm miệng</TableHead>
                <TableHead>15'</TableHead>
                <TableHead>45'</TableHead>
                <TableHead>Giữa kỳ</TableHead>
                <TableHead>Cuối kỳ</TableHead>
                <TableHead>Trung bình</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={item.studentId._id}>
                  <TableCell className="text-center font-medium">{index + 1}</TableCell>
                  <TableCell className="font-medium">{item.studentId.fullName || item.studentId.name || '-'}</TableCell>
                  <TableCell>{item.averages?.oral ?? '-'}</TableCell>
                  <TableCell>{item.averages?.quiz15 ?? '-'}</TableCell>
                  <TableCell>{item.averages?.quiz45 ?? '-'}</TableCell>
                  <TableCell>{item.averages?.midterm ?? '-'}</TableCell>
                  <TableCell>{item.averages?.final ?? '-'}</TableCell>
                  <TableCell className="font-medium">{item.average?.toFixed(2) ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

              {data.length === 0 && !loading && (
                <p className="text-muted-foreground text-center mt-6">Chưa có dữ liệu</p>
              )}
            </TabsContent>

            {/* Tab: Xem theo học sinh */}
            <TabsContent value="student" className="space-y-4">
              <div className="flex flex-wrap gap-4 mb-6 items-end">
                {/* Tìm kiếm học sinh */}
                <div className="flex-1 min-w-[300px] relative">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Tìm kiếm học sinh (tên, mã HS)..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  {studentSearch && filteredStudents.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredStudents.slice(0, 10).map((s) => (
                        <button
                          key={s._id}
                          onClick={() => {
                            setSelectedStudentId(s._id);
                            setStudentSearch(s.name || s.fullName || s.studentCode || '');
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-2"
                        >
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{s.name || s.fullName}</div>
                            <div className="text-sm text-muted-foreground">{s.studentCode}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Năm học */}
                <Select 
                  value={studentFilters.schoolYear} 
                  onValueChange={(v) => setStudentFilters({ ...studentFilters, schoolYear: v })}
                >
                  <SelectTrigger className="w-48">
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

                {/* Học kỳ */}
                <Select 
                  value={studentFilters.semester} 
                  onValueChange={(v) => setStudentFilters({ ...studentFilters, semester: v })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Học kỳ" />
                  </SelectTrigger>
                  <SelectContent>
                    {semesters.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Nút xem */}
                <Button onClick={fetchStudentGrades} disabled={loading || !selectedStudentId}>
                  {loading ? 'Đang tải...' : 'Xem điểm'}
                </Button>
              </div>

              {/* Hiển thị học sinh đã chọn */}
              {selectedStudentId && (
                <div className="mb-4 p-3 bg-muted rounded-md flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    {students.find((s) => s._id === selectedStudentId)?.name || 
                     students.find((s) => s._id === selectedStudentId)?.fullName || 
                     'Học sinh'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedStudentId('');
                      setStudentSearch('');
                      setStudentGrades([]);
                    }}
                  >
                    ✕
                  </Button>
                </div>
              )}

              {/* Bảng điểm của học sinh */}
              {studentGrades.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">STT</TableHead>
                      <TableHead>Môn học</TableHead>
                      <TableHead>Điểm miệng</TableHead>
                      <TableHead>15'</TableHead>
                      <TableHead>45'</TableHead>
                      <TableHead>Giữa kỳ</TableHead>
                      <TableHead>Cuối kỳ</TableHead>
                      <TableHead>Trung bình</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentGrades.map((item, index) => (
                      <TableRow key={item._id || item.subjectId?._id || index}>
                        <TableCell className="text-center font-medium">{index + 1}</TableCell>
                        <TableCell className="font-medium">
                          {item.subject?.name || item.subjectId?.name || '-'}
                        </TableCell>
                        <TableCell>{item.averages?.oral ?? '-'}</TableCell>
                        <TableCell>{item.averages?.quiz15 ?? '-'}</TableCell>
                        <TableCell>{item.averages?.quiz45 ?? '-'}</TableCell>
                        <TableCell>{item.averages?.midterm ?? '-'}</TableCell>
                        <TableCell>{item.averages?.final ?? '-'}</TableCell>
                        <TableCell className="font-medium">
                          {item.average?.toFixed(2) ?? '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {studentGrades.length === 0 && !loading && selectedStudentId && (
                <p className="text-muted-foreground text-center mt-6">Chưa có dữ liệu điểm</p>
              )}

              {!selectedStudentId && (
                <p className="text-muted-foreground text-center mt-6">
                  Vui lòng tìm kiếm và chọn học sinh để xem điểm
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
