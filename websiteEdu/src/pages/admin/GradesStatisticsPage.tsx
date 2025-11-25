import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart, Bar, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import gradesApi from '@/services/gradesApi';
import { useClasses, useSchoolYears } from '@/hooks';
import {
  BarChart3,
  TrendingUp,
  Users,
  Award,
  AlertCircle,
  Loader2,
  Download,
  School,
  BookOpen,
} from 'lucide-react';

interface StatisticsData {
  byClass: Record<string, {
    excellent: number;
    good: number;
    average: number;
    weak: number;
    total: number;
    averageGPA: number;
  }>;
  byGrade: Record<string, {
    excellent: number;
    good: number;
    average: number;
    weak: number;
    total: number;
    averageGPA: number;
  }>;
  overall: {
    excellent: number;
    good: number;
    average: number;
    weak: number;
    total: number;
  };
}

const GradesStatisticsPage = () => {
  const { toast } = useToast();
  const { classes } = useClasses();
  const { schoolYears: allSchoolYears, currentYearData } = useSchoolYears();
  const schoolYears = allSchoolYears.map(y => ({ code: y.code, name: y.name }));

  // State
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize school year
  useEffect(() => {
    if (currentYearData?.code) {
      setSchoolYear(currentYearData.code);
    } else if (schoolYears.length > 0) {
      setSchoolYear(schoolYears[schoolYears.length - 1].code);
    }
  }, [schoolYears, currentYearData]);

  // Fetch statistics
  const fetchStatistics = async () => {
    if (!schoolYear || !semester) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn năm học và học kỳ',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const params: any = { schoolYear, semester };
      if (selectedClassId) params.classId = selectedClassId;
      if (selectedGrade) params.grade = selectedGrade;

      const res = await gradesApi.getStatistics(params);
      if (res.success && res.data) {
        setStatistics(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching statistics:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải thống kê điểm số',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schoolYear && semester) {
      fetchStatistics();
    }
  }, [schoolYear, semester, selectedGrade, selectedClassId]);

  // Prepare chart data
  const overallChartData = statistics ? [
    { name: 'Giỏi', value: statistics.overall.excellent, color: '#22c55e' },
    { name: 'Khá', value: statistics.overall.good, color: '#3b82f6' },
    { name: 'Trung bình', value: statistics.overall.average, color: '#f59e0b' },
    { name: 'Yếu', value: statistics.overall.weak, color: '#ef4444' },
  ].filter(item => item.value > 0) : [];

  const byGradeChartData = statistics ? Object.entries(statistics.byGrade).map(([grade, data]) => ({
    grade: `Khối ${grade}`,
    excellent: data.excellent,
    good: data.good,
    average: data.average,
    weak: data.weak,
    averageGPA: data.averageGPA,
  })) : [];

  const byClassChartData = statistics ? Object.entries(statistics.byClass)
    .slice(0, 10) // Top 10 classes
    .map(([className, data]) => ({
      className,
      excellent: data.excellent,
      good: data.good,
      average: data.average,
      weak: data.weak,
      averageGPA: data.averageGPA,
    })) : [];

  const totalStudents = statistics?.overall.total || 0;
  const excellentRate = totalStudents > 0 
    ? ((statistics?.overall.excellent || 0) / totalStudents * 100).toFixed(1) 
    : '0';
  const goodRate = totalStudents > 0 
    ? ((statistics?.overall.good || 0) / totalStudents * 100).toFixed(1) 
    : '0';
  const averageRate = totalStudents > 0 
    ? ((statistics?.overall.average || 0) / totalStudents * 100).toFixed(1) 
    : '0';
  const weakRate = totalStudents > 0 
    ? ((statistics?.overall.weak || 0) / totalStudents * 100).toFixed(1) 
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Thống kê điểm số
          </h1>
          <p className="text-muted-foreground">
            Thống kê và phân tích điểm số học sinh theo lớp, khối và toàn trường
          </p>
        </div>
        <Button variant="outline" onClick={fetchStatistics} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Đang tải...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Tải lại
            </>
          )}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
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
              <Select value={selectedGrade || 'all'} onValueChange={(v) => {
                setSelectedGrade(v === 'all' ? '' : v);
                setSelectedClassId('');
              }}>
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
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Đang tải thống kê...</span>
        </div>
      ) : statistics ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700 mb-1">🟢 Giỏi</p>
                    <p className="text-3xl font-bold text-green-700">
                      {statistics.overall.excellent}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {excellentRate}% ({totalStudents > 0 ? Math.round(statistics.overall.excellent / totalStudents * 100) : 0}%)
                    </p>
                  </div>
                  <Award className="h-12 w-12 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700 mb-1">🔵 Khá</p>
                    <p className="text-3xl font-bold text-blue-700">
                      {statistics.overall.good}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {goodRate}% ({totalStudents > 0 ? Math.round(statistics.overall.good / totalStudents * 100) : 0}%)
                    </p>
                  </div>
                  <TrendingUp className="h-12 w-12 text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-700 mb-1">🟡 Trung bình</p>
                    <p className="text-3xl font-bold text-orange-700">
                      {statistics.overall.average}
                    </p>
                    <p className="text-xs text-orange-600 mt-1">
                      {averageRate}% ({totalStudents > 0 ? Math.round(statistics.overall.average / totalStudents * 100) : 0}%)
                    </p>
                  </div>
                  <Users className="h-12 w-12 text-orange-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-700 mb-1">🔴 Yếu</p>
                    <p className="text-3xl font-bold text-red-700">
                      {statistics.overall.weak}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      {weakRate}% ({totalStudents > 0 ? Math.round(statistics.overall.weak / totalStudents * 100) : 0}%)
                    </p>
                  </div>
                  <AlertCircle className="h-12 w-12 text-red-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pie Chart - Overall Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Phân bổ học lực toàn trường</CardTitle>
                <CardDescription>Tỷ lệ học sinh theo học lực</CardDescription>
              </CardHeader>
              <CardContent>
                {overallChartData.length > 0 ? (
                  <ChartContainer
                    config={{
                      excellent: { label: 'Giỏi', color: '#22c55e' },
                      good: { label: 'Khá', color: '#3b82f6' },
                      average: { label: 'Trung bình', color: '#f59e0b' },
                      weak: { label: 'Yếu', color: '#ef4444' },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer>
                      <RechartsPieChart>
                        <Pie
                          data={overallChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {overallChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
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

            {/* Bar Chart - By Grade */}
            <Card>
              <CardHeader>
                <CardTitle>Thống kê theo khối</CardTitle>
                <CardDescription>Phân bổ học lực theo từng khối</CardDescription>
              </CardHeader>
              <CardContent>
                {byGradeChartData.length > 0 ? (
                  <ChartContainer
                    config={{
                      excellent: { label: 'Giỏi', color: '#22c55e' },
                      good: { label: 'Khá', color: '#3b82f6' },
                      average: { label: 'Trung bình', color: '#f59e0b' },
                      weak: { label: 'Yếu', color: '#ef4444' },
                    }}
                    className="h-[300px]"
                  >
                    <BarChart data={byGradeChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="grade" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="excellent" stackId="a" fill="#22c55e" name="Giỏi" />
                      <Bar dataKey="good" stackId="a" fill="#3b82f6" name="Khá" />
                      <Bar dataKey="average" stackId="a" fill="#f59e0b" name="Trung bình" />
                      <Bar dataKey="weak" stackId="a" fill="#ef4444" name="Yếu" />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Statistics Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Grade Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <School className="h-5 w-5" />
                  Thống kê theo khối
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(statistics.byGrade).length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Khối</TableHead>
                          <TableHead className="text-center">Giỏi</TableHead>
                          <TableHead className="text-center">Khá</TableHead>
                          <TableHead className="text-center">TB</TableHead>
                          <TableHead className="text-center">Yếu</TableHead>
                          <TableHead className="text-center">Tổng</TableHead>
                          <TableHead className="text-center">ĐTB</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(statistics.byGrade)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([grade, data]) => (
                            <TableRow key={grade}>
                              <TableCell className="font-medium">Khối {grade}</TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-green-600">{data.excellent}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-blue-600">{data.good}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-orange-600">{data.average}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="destructive">{data.weak}</Badge>
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                {data.total}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">
                                  {data.averageGPA ? data.averageGPA.toFixed(2) : '-'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By Class Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Thống kê theo lớp (Top 10)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(statistics.byClass).length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lớp</TableHead>
                          <TableHead className="text-center">Giỏi</TableHead>
                          <TableHead className="text-center">Khá</TableHead>
                          <TableHead className="text-center">TB</TableHead>
                          <TableHead className="text-center">Yếu</TableHead>
                          <TableHead className="text-center">Tổng</TableHead>
                          <TableHead className="text-center">ĐTB</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(statistics.byClass)
                          .sort(([, a], [, b]) => (b.averageGPA || 0) - (a.averageGPA || 0))
                          .slice(0, 10)
                          .map(([className, data]) => (
                            <TableRow key={className}>
                              <TableCell className="font-medium">{className}</TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-green-600">{data.excellent}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-blue-600">{data.good}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-orange-600">{data.average}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="destructive">{data.weak}</Badge>
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                {data.total}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">
                                  {data.averageGPA ? data.averageGPA.toFixed(2) : '-'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Chưa có dữ liệu thống kê</p>
              <p className="text-sm mt-2">Vui lòng chọn năm học và học kỳ để xem thống kê</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GradesStatisticsPage;

