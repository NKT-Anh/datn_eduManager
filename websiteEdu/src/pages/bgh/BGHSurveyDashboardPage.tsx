import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, BookOpen, School, Award, Trophy, BarChart3 } from 'lucide-react';
import surveyApi from '@/services/surveyApi';
import { useSchoolYears } from '@/hooks';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import { useSubjects } from '@/hooks';
import { useDepartments } from '@/hooks';
import { useClasses } from '@/hooks';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function BGHSurveyDashboardPage() {
  const { toast } = useToast();
  const { schoolYears } = useSchoolYears();
  const { currentYearCode } = useCurrentAcademicYear();
  const { subjects } = useSubjects();
  const { classes } = useClasses();

  // ✅ Xác định học kỳ hiện tại dựa trên tháng
  // Học kỳ 1: Tháng 9-12 (hoặc tháng 1) | Học kỳ 2: Tháng 2-6
  const getCurrentSemester = (): '1' | '2' => {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    // Tháng 9, 10, 11, 12, 1 → Học kỳ 1
    // Tháng 2, 3, 4, 5, 6 → Học kỳ 2
    if (currentMonth >= 9 || currentMonth === 1) {
      return '1';
    } else {
      return '2';
    }
  };

  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>(getCurrentSemester());
  
  // ✅ Set năm học hiện tại khi có dữ liệu
  useEffect(() => {
    if (currentYearCode && !selectedYear) {
      setSelectedYear(currentYearCode);
    }
  }, [currentYearCode, selectedYear]);
  
  // ✅ Lấy danh sách tổ bộ môn theo năm học hiện tại
  const [departments, setDepartments] = useState<any[]>([]);
  
  useEffect(() => {
    const loadDepartments = async () => {
      if (!selectedYear) return;
      try {
        const { departmentApi } = await import('@/services/departmentApi');
        const depts = await departmentApi.getAll({ year: selectedYear });
        setDepartments(depts);
      } catch (error) {
        console.error('Lỗi khi tải danh sách tổ bộ môn:', error);
        // Fallback: Lấy tất cả tổ bộ môn
        const { departmentApi } = await import('@/services/departmentApi');
        const allDepts = await departmentApi.getAll();
        setDepartments(allDepts);
      }
    };
    loadDepartments();
  }, [selectedYear]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [dashboardData, setDashboardData] = useState<any>(null);

  // ✅ Load dashboard khi component mount hoặc khi filters thay đổi
  useEffect(() => {
    if (selectedYear) {
      loadDashboard();
    }
  }, [selectedYear, selectedSemester, selectedSubjectId, selectedDepartmentId, selectedClassId]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await surveyApi.getSurveyDashboard({
        year: selectedYear || undefined,
        semester: selectedSemester !== 'all' ? selectedSemester : undefined,
        subjectId: selectedSubjectId !== 'all' ? selectedSubjectId : undefined,
        departmentId: selectedDepartmentId !== 'all' ? selectedDepartmentId : undefined,
        classId: selectedClassId !== 'all' ? selectedClassId : undefined,
      });
      setDashboardData(data);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể tải dashboard',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getRatingLabel = (rating: string) => {
    const ratingMap: Record<string, { label: string; color: string }> = {
      excellent: { label: 'Xuất sắc', color: 'bg-yellow-500' },
      good: { label: 'Khá', color: 'bg-green-500' },
      average: { label: 'Trung bình', color: 'bg-blue-500' },
      needs_improvement: { label: 'Cần cải thiện', color: 'bg-orange-500' },
    };
    return ratingMap[rating] || { label: rating, color: 'bg-gray-500' };
  };

  const prepareScoreDistributionData = () => {
    if (!dashboardData?.summary?.scoreDistribution) return [];
    const dist = dashboardData.summary.scoreDistribution;
    return [
      { name: 'Xuất sắc', nameFull: 'Xuất sắc (≥4.5)', value: dist.excellent || 0 },
      { name: 'Khá', nameFull: 'Khá (3.5-4.5)', value: dist.good || 0 },
      { name: 'Trung bình', nameFull: 'Trung bình (2.5-3.5)', value: dist.average || 0 },
      { name: 'Cần cải thiện', nameFull: 'Cần cải thiện (<2.5)', value: dist.needs_improvement || 0 },
    ];
  };

  const prepareTeacherRankingData = () => {
    if (!dashboardData?.teacherRankings) return [];
    return dashboardData.teacherRankings.slice(0, 10).map((teacher: any) => ({
      name: teacher.teacher.name.substring(0, 15) + (teacher.teacher.name.length > 15 ? '...' : ''),
      'Điểm TB': Number(teacher.averageScore.toFixed(2)),
    }));
  };

  const prepareSubjectStatisticsData = () => {
    if (!dashboardData?.subjectStatistics) return [];
    return dashboardData.subjectStatistics.map((subj: any) => ({
      name: subj.subjectName.substring(0, 15) + (subj.subjectName.length > 15 ? '...' : ''),
      'Điểm TB': Number(subj.averageScore.toFixed(2)),
    }));
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Khảo sát</h1>
        <p className="text-muted-foreground">
          Tổng quan thống kê khảo sát đánh giá giáo viên
          {selectedYear && (
            <span className="ml-2 font-semibold text-primary">
              - {selectedYear} {selectedSemester !== 'all' && `(Học kỳ ${selectedSemester})`}
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <Label>Năm học:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year._id} value={year.code}>
                      {year.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Học kỳ:</Label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="1">
                    Học kỳ 1 {getCurrentSemester() === '1' && '(Hiện tại)'}
                  </SelectItem>
                  <SelectItem value="2">
                    Học kỳ 2 {getCurrentSemester() === '2' && '(Hiện tại)'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Môn học:</Label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject._id} value={subject._id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bộ môn:</Label>
              <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept._id} value={dept._id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lớp:</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      {cls.className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center">Đang tải...</CardContent>
        </Card>
      ) : !dashboardData ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Chưa có dữ liệu</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Tổng số giáo viên
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {dashboardData.summary?.totalTeachers || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Điểm trung bình tổng thể
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {dashboardData.summary?.overallAverage?.toFixed(2) || '0.00'}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Tổng phản hồi: {dashboardData.summary?.totalResponses || 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Số môn học
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {dashboardData.summary?.totalSubjects || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <School className="h-5 w-5" />
                  Số lớp
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {dashboardData.summary?.totalClasses || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Score Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Phân bố điểm đánh giá</CardTitle>
              <CardDescription>
                Số lượng giáo viên theo từng mức đánh giá
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Biểu đồ */}
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={prepareScoreDistributionData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => value > 0 ? `${name}\n${value}` : ''}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {prepareScoreDistributionData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any, name: any, props: any) => [
                          `${props.payload.nameFull || name}: ${value}`,
                          'Số lượng'
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Bảng tóm tắt */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Tóm tắt</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mức đánh giá</TableHead>
                        <TableHead className="text-right">Số lượng</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prepareScoreDistributionData().map((entry, index) => (
                        <TableRow key={entry.name}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              {entry.nameFull || entry.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {entry.value}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>Tổng cộng</TableCell>
                        <TableCell className="text-right">
                          {prepareScoreDistributionData().reduce((sum, entry) => sum + entry.value, 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Teacher Rankings */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Giáo viên</CardTitle>
              <CardDescription>
                Xếp hạng giáo viên theo điểm trung bình
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={prepareTeacherRankingData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Điểm TB" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Teacher Rankings Table */}
          <Card>
            <CardHeader>
              <CardTitle>Bảng xếp hạng giáo viên</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hạng</TableHead>
                    <TableHead>Giáo viên</TableHead>
                    <TableHead>Mã GV</TableHead>
                    <TableHead>Số phản hồi</TableHead>
                    <TableHead>Điểm TB</TableHead>
                    <TableHead>Xếp loại</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.teacherRankings?.map((teacher: any, index: number) => {
                    const ratingInfo = getRatingLabel(teacher.rating);
                    return (
                      <TableRow key={teacher.teacher._id}>
                        <TableCell className="font-bold">#{teacher.rank}</TableCell>
                        <TableCell>{teacher.teacher.name}</TableCell>
                        <TableCell>{teacher.teacher.teacherCode}</TableCell>
                        <TableCell>{teacher.responseCount}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {teacher.averageScore.toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${ratingInfo.color} text-white`}>
                            {ratingInfo.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Subject Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Thống kê theo môn học</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={prepareSubjectStatisticsData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Điểm TB" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Subject Statistics Table */}
          <Card>
            <CardHeader>
              <CardTitle>Bảng thống kê theo môn học</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Môn học</TableHead>
                    <TableHead>Số phản hồi</TableHead>
                    <TableHead>Điểm TB</TableHead>
                    <TableHead>Xếp loại</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.subjectStatistics?.map((subj: any) => {
                    const ratingInfo = getRatingLabel(subj.rating);
                    return (
                      <TableRow key={subj.subjectId}>
                        <TableCell className="font-medium">{subj.subjectName}</TableCell>
                        <TableCell>{subj.responseCount}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {subj.averageScore.toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${ratingInfo.color} text-white`}>
                            {ratingInfo.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Department Statistics */}
          {dashboardData.departmentStatistics && dashboardData.departmentStatistics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Thống kê theo bộ môn</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bộ môn</TableHead>
                      <TableHead>Số phản hồi</TableHead>
                      <TableHead>Điểm TB</TableHead>
                      <TableHead>Xếp loại</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.departmentStatistics.map((dept: any) => {
                      const ratingInfo = getRatingLabel(dept.rating);
                      return (
                        <TableRow key={dept.departmentId}>
                          <TableCell className="font-medium">{dept.departmentName}</TableCell>
                          <TableCell>{dept.responseCount}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {dept.averageScore.toFixed(2)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${ratingInfo.color} text-white`}>
                              {ratingInfo.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Class Statistics */}
          {dashboardData.classStatistics && dashboardData.classStatistics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Thống kê theo lớp</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lớp</TableHead>
                      <TableHead>Số phản hồi</TableHead>
                      <TableHead>Điểm TB</TableHead>
                      <TableHead>Xếp loại</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.classStatistics.map((cls: any) => {
                      const ratingInfo = getRatingLabel(cls.rating);
                      return (
                        <TableRow key={cls.classId}>
                          <TableCell className="font-medium">{cls.className}</TableCell>
                          <TableCell>{cls.responseCount}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {cls.averageScore.toFixed(2)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${ratingInfo.color} text-white`}>
                              {ratingInfo.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

