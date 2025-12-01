import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, TrendingUp, TrendingDown, Minus, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { examApi } from '@/services/exams/examApi';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface ExamGradeAnalysis {
  currentExam: {
    _id: string;
    name: string;
    year: string;
    semester: string;
    type: string;
    grades: string[];
  };
  overall: {
    totalStudents: number;
    totalGraded: number;
    overallAverage: number;
    completionRate: number;
    gradeDistribution: {
      excellent: number;
      good: number;
      average: number;
      weak: number;
    };
  };
  bySubject: Array<{
    subjectId: string;
    subjectName: string;
    totalStudents: number;
    gradedStudents: number;
    average: number;
    median: number;
    standardDeviation: number;
    min: number;
    max: number;
    passRate: number;
    previousYear?: {
      average: number | null;
      totalStudents: number;
      gradedStudents: number;
      trend: number | null;
      trendPercentage: number | null;
    };
  }>;
  previousYearComparison: {
    examId: string;
    examName: string;
    year: string;
    semester: string;
    comparison: Array<{
      subjectId: string;
      subjectName: string;
      average: number;
      previousYear: {
        average: number | null;
        trend: number | null;
        trendPercentage: number | null;
      };
    }>;
  } | null;
}

export default function ExamGradeAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExamGradeAnalysis | null>(null);
  const [compareWithPreviousYear, setCompareWithPreviousYear] = useState(true);

  useEffect(() => {
    if (id) {
      loadAnalysis();
    }
  }, [id, compareWithPreviousYear]);

  const loadAnalysis = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await examApi.getGradeAnalysis(id, compareWithPreviousYear);
      setData(result);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.error || 'Không thể tải dữ liệu phân tích',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Prepare data for charts
  const prepareSubjectChartData = () => {
    if (!data?.bySubject) return [];
    return data.bySubject.map((subject) => ({
      name: subject.subjectName.length > 15 
        ? subject.subjectName.substring(0, 15) + '...' 
        : subject.subjectName,
      fullName: subject.subjectName,
      'Điểm TB': subject.average,
      'Trung vị': subject.median,
      'Độ lệch chuẩn': subject.standardDeviation,
      'Tỷ lệ đạt': subject.passRate,
    }));
  };

  const prepareComparisonChartData = () => {
    if (!data?.previousYearComparison) return [];
    return data.previousYearComparison.comparison.map((item) => ({
      name: item.subjectName.length > 15 
        ? item.subjectName.substring(0, 15) + '...' 
        : item.subjectName,
      fullName: item.subjectName,
      'Năm hiện tại': item.average,
      'Năm trước': item.previousYear.average || 0,
    }));
  };

  const prepareGradeDistributionData = () => {
    if (!data?.overall) return [];
    return [
      { name: 'Xuất sắc (9-10)', value: data.overall.gradeDistribution.excellent, color: '#00C49F' },
      { name: 'Giỏi (7-8.9)', value: data.overall.gradeDistribution.good, color: '#0088FE' },
      { name: 'Khá (5-6.9)', value: data.overall.gradeDistribution.average, color: '#FFBB28' },
      { name: 'Yếu (<5)', value: data.overall.gradeDistribution.weak, color: '#FF8042' },
    ].filter(item => item.value > 0);
  };

  const getTrendIcon = (trend: number | null) => {
    if (trend === null) return <Minus className="h-4 w-4 text-gray-400" />;
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getTrendColor = (trend: number | null) => {
    if (trend === null) return 'text-gray-500';
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Không có dữ liệu phân tích</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Phân tích điểm thi</h1>
            <p className="text-muted-foreground">
              {data.currentExam.name} - {data.currentExam.year} - Học kỳ {data.currentExam.semester}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="compare">So sánh với năm trước</Label>
            <Select
              value={compareWithPreviousYear ? 'true' : 'false'}
              onValueChange={(value) => setCompareWithPreviousYear(value === 'true')}
            >
              <SelectTrigger id="compare" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Có</SelectItem>
                <SelectItem value="false">Không</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tổng số học sinh</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overall.totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Đã chấm: {data.overall.totalGraded} ({data.overall.completionRate}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Điểm trung bình tổng</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overall.overallAverage.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Trên thang điểm 10</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tỷ lệ hoàn thành</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overall.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.overall.totalGraded}/{data.overall.totalStudents} học sinh
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Phân loại điểm</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Xuất sắc:</span>
                <span className="font-semibold">{data.overall.gradeDistribution.excellent}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Giỏi:</span>
                <span className="font-semibold">{data.overall.gradeDistribution.good}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Khá:</span>
                <span className="font-semibold">{data.overall.gradeDistribution.average}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Yếu:</span>
                <span className="font-semibold">{data.overall.gradeDistribution.weak}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Phân bố điểm
            </CardTitle>
            <CardDescription>Phân loại điểm theo mức độ</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={prepareGradeDistributionData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => 
                    value > 0 ? `${name}\n${value} (${(percent * 100).toFixed(1)}%)` : ''
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {prepareGradeDistributionData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subject Average Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Điểm trung bình theo môn
            </CardTitle>
            <CardDescription>So sánh điểm trung bình các môn học</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={prepareSubjectChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                />
                <YAxis domain={[0, 10]} />
                <Tooltip 
                  formatter={(value: any) => value.toFixed(2)}
                  labelFormatter={(label, payload) => 
                    payload && payload[0] ? payload[0].payload.fullName : label
                  }
                />
                <Legend />
                <Bar dataKey="Điểm TB" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Comparison with Previous Year */}
      {data.previousYearComparison && (
        <Card>
          <CardHeader>
            <CardTitle>So sánh với năm trước</CardTitle>
            <CardDescription>
              {data.previousYearComparison.examName} - {data.previousYearComparison.year} - Học kỳ {data.previousYearComparison.semester}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={prepareComparisonChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                />
                <YAxis domain={[0, 10]} />
                <Tooltip 
                  formatter={(value: any) => value.toFixed(2)}
                  labelFormatter={(label, payload) => 
                    payload && payload[0] ? payload[0].payload.fullName : label
                  }
                />
                <Legend />
                <Bar dataKey="Năm hiện tại" fill="#0088FE" />
                <Bar dataKey="Năm trước" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detailed Subject Statistics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Chi tiết theo môn học</CardTitle>
          <CardDescription>Thống kê chi tiết điểm thi từng môn</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Môn học</TableHead>
                  <TableHead className="text-right">Đã chấm</TableHead>
                  <TableHead className="text-right">Điểm TB</TableHead>
                  <TableHead className="text-right">Trung vị</TableHead>
                  <TableHead className="text-right">Độ lệch chuẩn</TableHead>
                  <TableHead className="text-right">Tỷ lệ đạt</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Max</TableHead>
                  {data.previousYearComparison && (
                    <>
                      <TableHead className="text-right">Năm trước</TableHead>
                      <TableHead className="text-right">Xu hướng</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bySubject.map((subject) => (
                  <TableRow key={subject.subjectId}>
                    <TableCell className="font-medium">{subject.subjectName}</TableCell>
                    <TableCell className="text-right">
                      {subject.gradedStudents}/{subject.totalStudents}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {subject.average.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{subject.median.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{subject.standardDeviation.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{subject.passRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{subject.min.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{subject.max.toFixed(1)}</TableCell>
                    {data.previousYearComparison && (
                      <>
                        <TableCell className="text-right">
                          {subject.previousYear?.average !== null && subject.previousYear?.average !== undefined
                            ? subject.previousYear.average.toFixed(2)
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          {subject.previousYear?.trend !== null && subject.previousYear?.trend !== undefined ? (
                            <div className="flex items-center justify-end gap-1">
                              {getTrendIcon(subject.previousYear.trend)}
                              <span className={getTrendColor(subject.previousYear.trend)}>
                                {subject.previousYear.trend > 0 ? '+' : ''}
                                {subject.previousYear.trend.toFixed(2)}
                              </span>
                              {subject.previousYear.trendPercentage !== null && (
                                <span className={`text-xs ${getTrendColor(subject.previousYear.trend)}`}>
                                  ({subject.previousYear.trendPercentage > 0 ? '+' : ''}
                                  {subject.previousYear.trendPercentage.toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

