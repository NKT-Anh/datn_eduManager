import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Download, Edit, Trash2, RefreshCw } from 'lucide-react';
import gradesApi from '@/services/gradesApi';
import schoolConfigApi from '@/services/schoolConfigApi';
import api from '@/services/axiosInstance';
import { useSchoolYears } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

const AdminGradesPage: React.FC = () => {
  const { backendUser } = useAuth();
  const { schoolYears: allSchoolYears, currentYear, currentYearData } = useSchoolYears();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    schoolYear: '',
    semester: '',
    classId: '',
    subjectId: '',
    grade: '',
    keyword: '',
  });

  // Data
  const [studentsGrades, setStudentsGrades] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);

  // Options
  const [semesters, setSemesters] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);

  // ✅ Set default filters
  useEffect(() => {
    const defaultYear = currentYearData?.code || currentYear || (allSchoolYears.length > 0 ? allSchoolYears[allSchoolYears.length - 1].code : '');
    if (defaultYear && !filters.schoolYear) {
      setFilters(prev => ({ ...prev, schoolYear: defaultYear, semester: '1' }));
    }
  }, [allSchoolYears, currentYearData, currentYear]);

  // ✅ Load semesters, classes, subjects, grades
  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const [semRes, classRes, subjectRes, gradeRes] = await Promise.all([
          schoolConfigApi.getSemesters(),
          api.get('/class'),
          api.get('/subjects'),
          schoolConfigApi.getGrades(),
        ]);
        setSemesters(semRes.data || []);
        setClasses(classRes.data || []);
        setSubjects(subjectRes.data || []);
        setGrades(gradeRes.data || gradeRes || []);
      } catch (err) {
        console.error('Load base data failed:', err);
      }
    };
    fetchBaseData();
  }, []);

  // ✅ Load students grades
  const fetchStudentsGrades = async () => {
    if (!filters.schoolYear || !filters.semester) {
      toast.error('Vui lòng chọn năm học và học kỳ');
      return;
    }
    setLoading(true);
    try {
      const res = await gradesApi.getAllStudentsGrades(filters);
      setStudentsGrades(res.data || []);
    } catch (err: any) {
      console.error('Load grades failed:', err);
      toast.error(err.response?.data?.message || 'Không thể tải điểm');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Load statistics
  const fetchStatistics = async () => {
    if (!filters.schoolYear || !filters.semester) {
      toast.error('Vui lòng chọn năm học và học kỳ');
      return;
    }
    setLoading(true);
    try {
      const res = await gradesApi.getStatistics({
        schoolYear: filters.schoolYear,
        semester: filters.semester,
        classId: filters.classId || undefined,
        grade: filters.grade || undefined,
      });
      setStatistics(res.data || null);
    } catch (err: any) {
      console.error('Load statistics failed:', err);
      toast.error(err.response?.data?.message || 'Không thể tải thống kê');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Load audit log
  const fetchAuditLog = async () => {
    setLoading(true);
    try {
      const res = await gradesApi.getAuditLog({
        schoolYear: filters.schoolYear || undefined,
        semester: filters.semester || undefined,
        classId: filters.classId || undefined,
        subjectId: filters.subjectId || undefined,
        limit: 100,
      });
      setAuditLog(res.data || []);
    } catch (err: any) {
      console.error('Load audit log failed:', err);
      toast.error(err.response?.data?.message || 'Không thể tải lịch sử');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Load data when tab changes
  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'details') {
      fetchStudentsGrades();
    } else if (activeTab === 'statistics') {
      fetchStatistics();
    } else if (activeTab === 'audit') {
      fetchAuditLog();
    }
  }, [activeTab, filters.schoolYear, filters.semester]);

  // ✅ Handle delete grade item
  const handleDeleteGradeItem = async (itemId: string) => {
    if (!confirm('Bạn có chắc muốn xóa điểm này?')) return;
    try {
      await gradesApi.deleteGradeItem(itemId);
      toast.success('Đã xóa điểm thành công');
      fetchStudentsGrades();
      fetchAuditLog();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xóa điểm');
    }
  };

  // ✅ Get color for average score
  const getAverageColor = (avg: number | null | undefined): string => {
    if (avg === null || avg === undefined) return 'text-gray-500';
    if (avg >= 8) return 'text-yellow-600 font-bold';
    if (avg >= 6.5) return 'text-blue-600 font-semibold';
    if (avg >= 5.0) return 'text-black font-semibold';
    return 'text-red-600 font-bold';
  };

  // ✅ Get academic level badge
  const getAcademicLevelBadge = (level: string | null | undefined) => {
    if (!level) return null;
    const colorMap: Record<string, string> = {
      'Giỏi': 'bg-green-100 text-green-800',
      'Khá': 'bg-blue-100 text-blue-800',
      'Trung bình': 'bg-yellow-100 text-yellow-800',
      'Yếu': 'bg-red-100 text-red-800',
    };
    return (
      <Badge className={colorMap[level] || 'bg-gray-100 text-gray-800'}>
        {level}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">📊 Quản lý điểm - Admin</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Select
              value={filters.schoolYear}
              onValueChange={(v) => setFilters(prev => ({ ...prev, schoolYear: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Năm học" />
              </SelectTrigger>
              <SelectContent>
                {allSchoolYears.map((y) => (
                  <SelectItem key={y.code} value={y.code}>
                    {y.name} {currentYearData?.code === y.code && '(Hiện tại)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.semester}
              onValueChange={(v) => setFilters(prev => ({ ...prev, semester: v }))}
            >
              <SelectTrigger>
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

            <Select
              value={filters.grade || "all"}
              onValueChange={(v) => setFilters(prev => ({ ...prev, grade: v === "all" ? '' : v, classId: '' }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Khối" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả khối</SelectItem>
                {grades.map((g) => (
                  <SelectItem key={g.code || g} value={String(g.code || g)}>
                    Khối {g.name || g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.classId || "all"}
              onValueChange={(v) => setFilters(prev => ({ ...prev, classId: v === "all" ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Lớp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả lớp</SelectItem>
                {classes
                  .filter(c => !filters.grade || String(c.grade) === String(filters.grade))
                  .map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.className}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.subjectId || "all"}
              onValueChange={(v) => setFilters(prev => ({ ...prev, subjectId: v === "all" ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Môn học" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả môn</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Tìm theo tên, mã HS..."
                value={filters.keyword}
                onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
                className="pl-10"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="details">Chi tiết điểm</TabsTrigger>
              <TabsTrigger value="statistics">Thống kê</TabsTrigger>
              <TabsTrigger value="audit">Lịch sử</TabsTrigger>
            </TabsList>

            {/* Tab: Overview */}
            <TabsContent value="overview" className="mt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Tổng quan điểm học sinh</h3>
                  <Button onClick={fetchStudentsGrades} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Làm mới
                  </Button>
                </div>
                {loading ? (
                  <div className="text-center py-8">Đang tải...</div>
                ) : studentsGrades.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Chưa có dữ liệu</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>STT</TableHead>
                          <TableHead>Họ tên</TableHead>
                          <TableHead>Mã HS</TableHead>
                          <TableHead>Lớp</TableHead>
                          <TableHead>ĐTB HK</TableHead>
                          <TableHead>ĐTB CN</TableHead>
                          <TableHead>Học lực</TableHead>
                          <TableHead>Hạnh kiểm</TableHead>
                          <TableHead>Xếp hạng</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsGrades
                          .filter(student => 
                            !filters.keyword || 
                            student.name?.toLowerCase().includes(filters.keyword.toLowerCase()) ||
                            student.studentCode?.toLowerCase().includes(filters.keyword.toLowerCase())
                          )
                          .map((student, idx) => (
                            <TableRow key={student._id}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell className="font-medium">{student.name || '-'}</TableCell>
                              <TableCell>{student.studentCode || '-'}</TableCell>
                              <TableCell>{student.class?.className || '-'}</TableCell>
                              <TableCell className={getAverageColor(student.gpa)}>
                                {student.gpa?.toFixed(1) || '-'}
                              </TableCell>
                              <TableCell className={getAverageColor(student.semesterAverage)}>
                                {student.semesterAverage?.toFixed(1) || '-'}
                              </TableCell>
                              <TableCell>{getAcademicLevelBadge(student.academicLevel)}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{student.conduct || '-'}</Badge>
                              </TableCell>
                              <TableCell>{student.rank || '-'}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab: Details */}
            <TabsContent value="details" className="mt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Chi tiết điểm từng môn</h3>
                  <Button onClick={fetchStudentsGrades} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Làm mới
                  </Button>
                </div>
                {loading ? (
                  <div className="text-center py-8">Đang tải...</div>
                ) : studentsGrades.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Chưa có dữ liệu</div>
                ) : (
                  <div className="space-y-6">
                    {studentsGrades
                      .filter(student => 
                        !filters.keyword || 
                        student.name?.toLowerCase().includes(filters.keyword.toLowerCase()) ||
                        student.studentCode?.toLowerCase().includes(filters.keyword.toLowerCase())
                      )
                      .filter(student => 
                        !filters.subjectId || 
                        student.subjects?.some((s: any) => s.subject?._id === filters.subjectId)
                      )
                      .map((student) => (
                        <Card key={student._id}>
                          <CardHeader>
                            <CardTitle className="text-lg">
                              {student.name} ({student.studentCode}) - {student.class?.className}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Môn học</TableHead>
                                  <TableHead>Miệng</TableHead>
                                  <TableHead>15'</TableHead>
                                  <TableHead>45'</TableHead>
                                  <TableHead>Giữa kỳ</TableHead>
                                  <TableHead>Cuối kỳ</TableHead>
                                  <TableHead>ĐTB môn</TableHead>
                                  <TableHead>Hành động</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {student.subjects?.map((subject: any) => (
                                  <TableRow key={subject._id}>
                                    <TableCell className="font-medium">
                                      {subject.subject?.name || '-'}
                                    </TableCell>
                                    <TableCell>{subject.averages?.oral || '-'}</TableCell>
                                    <TableCell>{subject.averages?.quiz15 || '-'}</TableCell>
                                    <TableCell>{subject.averages?.quiz45 || '-'}</TableCell>
                                    <TableCell>{subject.averages?.midterm || '-'}</TableCell>
                                    <TableCell>{subject.averages?.final || '-'}</TableCell>
                                    <TableCell className={getAverageColor(subject.average)}>
                                      {subject.average?.toFixed(1) || '-'}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            // TODO: Implement edit
                                            toast.info('Tính năng sửa điểm đang phát triển');
                                          }}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab: Statistics */}
            <TabsContent value="statistics" className="mt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Thống kê xếp loại</h3>
                  <Button onClick={fetchStatistics} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Làm mới
                  </Button>
                </div>
                {loading ? (
                  <div className="text-center py-8">Đang tải...</div>
                ) : !statistics ? (
                  <div className="text-center py-8 text-gray-500">Chưa có dữ liệu</div>
                ) : (
                  <div className="space-y-6">
                    {/* Overall Statistics */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Tổng quan</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-5 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {statistics.overall?.excellent || 0}
                            </div>
                            <div className="text-sm text-gray-600">Giỏi</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {statistics.overall?.good || 0}
                            </div>
                            <div className="text-sm text-gray-600">Khá</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-600">
                              {statistics.overall?.average || 0}
                            </div>
                            <div className="text-sm text-gray-600">Trung bình</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {statistics.overall?.weak || 0}
                            </div>
                            <div className="text-sm text-gray-600">Yếu</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">
                              {statistics.overall?.total || 0}
                            </div>
                            <div className="text-sm text-gray-600">Tổng số</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* By Grade */}
                    {statistics.byGrade && Object.keys(statistics.byGrade).length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Theo khối</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Khối</TableHead>
                                <TableHead>Tổng số</TableHead>
                                <TableHead>Giỏi</TableHead>
                                <TableHead>Khá</TableHead>
                                <TableHead>Trung bình</TableHead>
                                <TableHead>Yếu</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Object.values(statistics.byGrade).map((grade: any) => (
                                <TableRow key={grade.grade}>
                                  <TableCell className="font-medium">Khối {grade.grade}</TableCell>
                                  <TableCell>{grade.total || 0}</TableCell>
                                  <TableCell className="text-green-600">{grade.excellent || 0}</TableCell>
                                  <TableCell className="text-blue-600">{grade.good || 0}</TableCell>
                                  <TableCell className="text-yellow-600">{grade.average || 0}</TableCell>
                                  <TableCell className="text-red-600">{grade.weak || 0}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* By Class */}
                    {statistics.byClass && Object.keys(statistics.byClass).length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Theo lớp</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Lớp</TableHead>
                                  <TableHead>Tổng số</TableHead>
                                  <TableHead>Giỏi</TableHead>
                                  <TableHead>Khá</TableHead>
                                  <TableHead>Trung bình</TableHead>
                                  <TableHead>Yếu</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Object.values(statistics.byClass).map((cls: any) => (
                                  <TableRow key={cls.className}>
                                    <TableCell className="font-medium">{cls.className}</TableCell>
                                    <TableCell>{cls.total || 0}</TableCell>
                                    <TableCell className="text-green-600">{cls.excellent || 0}</TableCell>
                                    <TableCell className="text-blue-600">{cls.good || 0}</TableCell>
                                    <TableCell className="text-yellow-600">{cls.average || 0}</TableCell>
                                    <TableCell className="text-red-600">{cls.weak || 0}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab: Audit Log */}
            <TabsContent value="audit" className="mt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Lịch sử nhập/sửa điểm</h3>
                  <Button onClick={fetchAuditLog} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Làm mới
                  </Button>
                </div>
                {loading ? (
                  <div className="text-center py-8">Đang tải...</div>
                ) : auditLog.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Chưa có dữ liệu</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Thời gian</TableHead>
                          <TableHead>Học sinh</TableHead>
                          <TableHead>Môn học</TableHead>
                          <TableHead>Loại điểm</TableHead>
                          <TableHead>Điểm</TableHead>
                          <TableHead>Người nhập/sửa</TableHead>
                          <TableHead>Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLog.map((log) => (
                          <TableRow key={log._id}>
                            <TableCell>
                              {dayjs(log.updatedAt || log.createdAt).format('DD/MM/YYYY HH:mm')}
                            </TableCell>
                            <TableCell>
                              {log.student?.name} ({log.student?.studentCode})
                            </TableCell>
                            <TableCell>{log.subject?.name || '-'}</TableCell>
                            <TableCell>
                              {log.component === 'oral' ? 'Miệng' :
                               log.component === 'quiz15' ? '15\'' :
                               log.component === 'quiz45' ? '45\'' :
                               log.component === 'midterm' ? 'Giữa kỳ' :
                               log.component === 'final' ? 'Cuối kỳ' : log.component}
                            </TableCell>
                            <TableCell className="font-semibold">{log.score}</TableCell>
                            <TableCell>{log.teacher?.name || '-'}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteGradeItem(log._id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminGradesPage;

