import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

export default function GradesAdminPage() {
  const [filters, setFilters] = useState({
    classId: '',
    subjectId: '',
    schoolYear: '',
    semester: '1',
  });
  const [gradeLevel, setGradeLevel] = useState<'10' | '11' | '12' | 'all'>('all');
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);

  // 1. Lấy danh sách năm học & học kỳ
  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const [yearRes, semRes] = await Promise.all([
          schoolConfigApi.getSchoolYears(),
          schoolConfigApi.getSemesters(),
        ]);
        setSchoolYears(yearRes.data);
        setSemesters(semRes.data);
        if (!filters.schoolYear && yearRes.data.length > 0) {
          setFilters((prev) => ({
            ...prev,
            schoolYear: yearRes.data.at(-1).code,
            semester: '1',
          }));
        }
      } catch (err) {
        toast({ title: 'Lỗi', description: 'Không thể tải cấu hình năm học/học kỳ', variant: 'destructive' });
      }
    };
    fetchConfigs();
  }, []);

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

  // 3. Xem bảng điểm
  const fetchSummary = async () => {
    if (!filters.classId || !filters.subjectId || !filters.schoolYear || !filters.semester) {
      toast({ title: 'Thiếu thông tin', description: 'Chọn lớp, môn, năm học, học kỳ' });
      return;
    }
    setLoading(true);
    try {
      const res = await gradesApi.getClassSubjectSummary(filters);
      setData(res.data);
    } catch (err) {
      toast({ title: 'Lỗi', description: 'Không thể tải bảng điểm', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // 4. Khởi tạo bảng điểm rỗng
  const handleInitGrades = async () => {
    if (!filters.schoolYear || !filters.semester) {
      toast({ title: 'Thiếu thông tin', description: 'Chọn năm học và học kỳ' });
      return;
    }
    setInitLoading(true);
    try {
      const res = await gradesApi.initGradeTable({
        gradeLevel,
        schoolYear: filters.schoolYear,
        semester: filters.semester,
      });
      const created = res.createdCount || res.data?.created || 0;
      const skipped = res.skippedCount || res.data?.skipped || 0;
      const message = created > 0 
        ? `Đã khởi tạo ${created} bản ghi bảng điểm${skipped > 0 ? `, bỏ qua ${skipped} bản ghi đã tồn tại` : ''}`
        : skipped > 0 
          ? `Tất cả bản ghi đã tồn tại (${skipped} bản ghi)`
          : 'Không có dữ liệu để khởi tạo';
      toast({ title: 'Hoàn tất', description: message });

      // Nếu đã chọn lớp + môn, tải luôn bảng điểm rỗng
      if (filters.classId && filters.subjectId) fetchSummary();
    } catch (err) {
      console.error(err);
      toast({ title: 'Lỗi', description: 'Khởi tạo bảng điểm thất bại', variant: 'destructive' });
    } finally {
      setInitLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quản lý bảng điểm (Admin)</CardTitle>
        </CardHeader>
        <CardContent>
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

            {/* Nút khởi tạo */}
            <Button onClick={handleInitGrades} disabled={initLoading}>{initLoading ? 'Đang khởi tạo...' : 'Khởi tạo bảng điểm'}</Button>

            {/* Nút xem */}
            <Button onClick={fetchSummary} disabled={loading}>{loading ? 'Đang tải...' : 'Xem bảng điểm'}</Button>
          </div>

          {/* Bảng dữ liệu */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Học sinh</TableHead>
                <TableHead>Oral</TableHead>
                <TableHead>15'</TableHead>
                <TableHead>45'</TableHead>
                <TableHead>Giữa kỳ</TableHead>
                <TableHead>Cuối kỳ</TableHead>
                <TableHead>Trung bình</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.studentId._id}>
                  <TableCell>{item.studentId.fullName}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
