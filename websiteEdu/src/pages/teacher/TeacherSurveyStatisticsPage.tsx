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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, FileText } from 'lucide-react';
import surveyApi from '@/services/surveyApi';
import { useSchoolYears } from '@/hooks';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function TeacherSurveyStatisticsPage() {
  const { toast } = useToast();
  const { schoolYears } = useSchoolYears();
  const { currentYearCode } = useCurrentAcademicYear();

  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('');
  
  // ✅ Set năm học hiện tại khi có dữ liệu
  useEffect(() => {
    if (currentYearCode && !selectedYear) {
      setSelectedYear(currentYearCode);
    }
  }, [currentYearCode, selectedYear]);
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('all');
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    if (selectedYear) {
      loadStatistics();
    }
  }, [selectedYear, selectedSemester, selectedSurveyId]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const data = await surveyApi.getTeacherStatistics({
        year: selectedYear || undefined,
        semester: selectedSemester !== 'all' ? selectedSemester : undefined,
        surveyId: selectedSurveyId !== 'all' ? selectedSurveyId : undefined,
      });
      setStatistics(data);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể tải thống kê',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Prepare data for charts
  const prepareQuestionChartData = (stat: any) => {
    if (!stat.questionStatistics) return [];
    return stat.questionStatistics.map((qStat: any) => ({
      name: `Câu ${qStat.order}`,
      'Điểm trung bình': Number(qStat.averageScore.toFixed(2)),
      'Số phản hồi': qStat.responseCount,
    }));
  };

  const prepareOverallChartData = () => {
    if (!statistics?.statistics) return [];
    return statistics.statistics.map((stat: any) => ({
      name: stat.survey.title.substring(0, 20) + (stat.survey.title.length > 20 ? '...' : ''),
      'Điểm trung bình': Number(stat.overallAverage.toFixed(2)),
    }));
  };

  const prepareDistributionData = () => {
    if (!statistics?.summary) return [];
    const { averageScore } = statistics.summary;
    let rating = 'average';
    if (averageScore >= 4.5) rating = 'excellent';
    else if (averageScore >= 3.5) rating = 'good';
    else if (averageScore >= 2.5) rating = 'average';
    else rating = 'needs_improvement';

    const distribution = [
      { name: 'Xuất sắc (≥4.5)', value: rating === 'excellent' ? 100 : 0 },
      { name: 'Khá (3.5-4.5)', value: rating === 'good' ? 100 : 0 },
      { name: 'Trung bình (2.5-3.5)', value: rating === 'average' ? 100 : 0 },
      { name: 'Cần cải thiện (<2.5)', value: rating === 'needs_improvement' ? 100 : 0 },
    ];
    return distribution;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Thống kê khảo sát</h1>
          <p className="text-muted-foreground">
            Xem điểm đánh giá từ học sinh (ẩn danh)
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Năm học:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Chọn năm học" />
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
            <div className="flex items-center gap-2">
              <Label>Học kỳ:</Label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="1">Học kỳ 1</SelectItem>
                  <SelectItem value="2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {statistics?.statistics && statistics.statistics.length > 0 && (
              <div className="flex items-center gap-2">
                <Label>Khảo sát:</Label>
                <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    {statistics.statistics.map((stat: any) => (
                      <SelectItem key={stat.survey._id} value={stat.survey._id}>
                        {stat.survey.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center">Đang tải...</CardContent>
        </Card>
      ) : !statistics ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Chưa có dữ liệu thống kê</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Điểm trung bình tổng thể
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {statistics.summary?.averageScore?.toFixed(2) || '0.00'}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Tổng số phản hồi: {statistics.summary?.totalResponses || 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Số khảo sát
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {statistics.statistics?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Khảo sát đã tham gia
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Điểm có trọng số
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {statistics.summary?.weightedAverageScore?.toFixed(2) || '0.00'}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Điểm trung bình có trọng số
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          {statistics.statistics && statistics.statistics.length > 0 && (
            <>
              {/* Overall Average Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Điểm trung bình theo khảo sát</CardTitle>
                  <CardDescription>
                    So sánh điểm trung bình giữa các khảo sát
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={prepareOverallChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis domain={[0, 5]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Điểm trung bình" fill="#0088FE" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Question Statistics for Selected Survey */}
              {selectedSurveyId !== 'all' && (() => {
                const selectedStat = statistics.statistics.find(
                  (s: any) => s.survey._id === selectedSurveyId
                );
                if (!selectedStat) return null;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Điểm trung bình từng câu hỏi</CardTitle>
                      <CardDescription>
                        Khảo sát: {selectedStat.survey.title}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={prepareQuestionChartData(selectedStat)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis domain={[0, 5]} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="Điểm trung bình" fill="#00C49F" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Rating Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Phân loại đánh giá</CardTitle>
                  <CardDescription>
                    Xếp loại dựa trên điểm trung bình tổng thể
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={prepareDistributionData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => (value > 0 ? name : '')}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {prepareDistributionData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Statistics Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Chi tiết thống kê theo khảo sát</CardTitle>
                  <CardDescription>
                    Điểm trung bình từng câu hỏi trong mỗi khảo sát
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Khảo sát</TableHead>
                        <TableHead>Môn học</TableHead>
                        <TableHead>Số phản hồi</TableHead>
                        <TableHead>Điểm TB tổng thể</TableHead>
                        <TableHead>Điểm TB có trọng số</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statistics.statistics.map((stat: any) => (
                        <TableRow key={stat.survey._id}>
                          <TableCell className="font-medium">{stat.survey.title}</TableCell>
                          <TableCell>{stat.survey.subjectId.name}</TableCell>
                          <TableCell>{stat.responseCount}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {stat.overallAverage.toFixed(2)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {stat.overallWeightedAverage.toFixed(2)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Question Details Table */}
              {selectedSurveyId !== 'all' && (() => {
                const selectedStat = statistics.statistics.find(
                  (s: any) => s.survey._id === selectedSurveyId
                );
                if (!selectedStat || !selectedStat.questionStatistics) return null;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Chi tiết từng câu hỏi</CardTitle>
                      <CardDescription>
                        Khảo sát: {selectedStat.survey.title}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Câu hỏi</TableHead>
                            <TableHead>Điểm trung bình</TableHead>
                            <TableHead>Số phản hồi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedStat.questionStatistics
                            .sort((a: any, b: any) => a.order - b.order)
                            .map((qStat: any) => (
                              <TableRow key={qStat.questionId}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">Câu {qStat.order}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {qStat.question}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {qStat.averageScore.toFixed(2)}
                                  </Badge>
                                </TableCell>
                                <TableCell>{qStat.responseCount}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })()}
            </>
          )}
        </>
      )}
    </div>
  );
}

