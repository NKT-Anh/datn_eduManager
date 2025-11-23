import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useSchoolYears } from '@/hooks';
import schoolConfigApi from '@/services/schoolConfigApi';
import gradesApi from '@/services/gradesApi';
import { toast } from 'sonner';
import { FileText, BarChart3, Award, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/services/axiosInstance';

export default function HomeroomGradesPage() {
  const { backendUser } = useAuth();
  const { currentYearData, currentYear, schoolYears: allSchoolYears } = useSchoolYears();
  const [loading, setLoading] = useState(true);
  const [homeroomClass, setHomeroomClass] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [semesters, setSemesters] = useState<{ code: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState('all-grades');
  
  // Data states
  const [allGradesData, setAllGradesData] = useState<any[]>([]);
  const [averagesData, setAveragesData] = useState<any[]>([]);
  const [classificationData, setClassificationData] = useState<any>(null);

  // ✅ Lấy lớp chủ nhiệm
  useEffect(() => {
    const fetchHomeroomClass = async () => {
      try {
        setLoading(true);
        const year = selectedYear || currentYearData?.code || currentYear;
        if (!year) return;

        const res = await api.get('/class/homeroom/class', { params: { year } });
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
  }, [selectedYear, currentYearData, currentYear]);

  // ✅ Set năm học mặc định
  useEffect(() => {
    const defaultYear = currentYearData?.code || currentYear || (allSchoolYears.length > 0 ? allSchoolYears[allSchoolYears.length - 1].code : '');
    if (defaultYear && !selectedYear) {
      setSelectedYear(defaultYear);
    }
  }, [currentYearData, currentYear, allSchoolYears, selectedYear]);

  // ✅ Lấy danh sách học kỳ
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const semestersRes = await schoolConfigApi.getSemesters();
        setSemesters(semestersRes.data);
        if (semestersRes.data.length > 0 && !selectedSemester) {
          setSelectedSemester(semestersRes.data[0].code);
        }
      } catch (err) {
        console.error("Load semesters failed", err);
      }
    };
    fetchSemesters();
  }, [selectedSemester]);

  // ✅ Lấy tất cả điểm của lớp chủ nhiệm
  useEffect(() => {
    const fetchAllGrades = async () => {
      if (!homeroomClass?._id || !selectedYear || !selectedSemester || activeTab !== 'all-grades') {
        setAllGradesData([]);
        return;
      }

      try {
        const res = await gradesApi.getHomeroomClassAllGrades({
          classId: homeroomClass._id,
          schoolYear: selectedYear,
          semester: selectedSemester,
        });
        setAllGradesData(res.data || []);
      } catch (err: any) {
        console.error('Error fetching all grades:', err);
        toast.error(err.response?.data?.message || 'Không thể tải bảng điểm');
        setAllGradesData([]);
      }
    };
    fetchAllGrades();
  }, [homeroomClass, selectedYear, selectedSemester, activeTab]);

  // ✅ Lấy điểm trung bình
  useEffect(() => {
    const fetchAverages = async () => {
      if (!homeroomClass?._id || !selectedYear || activeTab !== 'averages') {
        setAveragesData([]);
        return;
      }

      try {
        const res = await gradesApi.getHomeroomClassAverages({
          classId: homeroomClass._id,
          schoolYear: selectedYear,
        });
        setAveragesData(res.data || []);
      } catch (err: any) {
        console.error('Error fetching averages:', err);
        toast.error(err.response?.data?.message || 'Không thể tải điểm trung bình');
        setAveragesData([]);
      }
    };
    fetchAverages();
  }, [homeroomClass, selectedYear, activeTab]);

  // ✅ Lấy kết quả xếp loại
  useEffect(() => {
    const fetchClassification = async () => {
      if (!homeroomClass?._id || !selectedYear || activeTab !== 'classification') {
        setClassificationData(null);
        return;
      }

      try {
        const res = await gradesApi.getHomeroomClassClassification({
          classId: homeroomClass._id,
          schoolYear: selectedYear,
          semester: selectedSemester,
        });
        setClassificationData(res);
      } catch (err: any) {
        console.error('Error fetching classification:', err);
        toast.error(err.response?.data?.message || 'Không thể tải kết quả xếp loại');
        setClassificationData(null);
      }
    };
    fetchClassification();
  }, [homeroomClass, selectedYear, selectedSemester, activeTab]);

  const getConductBadge = (conduct?: string) => {
    if (!conduct) return <Badge variant="outline">Chưa có</Badge>;
    const colors: Record<string, string> = {
      'Tốt': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Khá': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Trung bình': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Yếu': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return (
      <Badge className={colors[conduct] || 'bg-gray-100 text-gray-800'}>
        {conduct}
      </Badge>
    );
  };

  const getAcademicLevelBadge = (level?: string) => {
    if (!level) return <Badge variant="outline">Chưa có</Badge>;
    const colors: Record<string, string> = {
      'Giỏi': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Khá': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Trung bình': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Yếu': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return (
      <Badge className={colors[level] || 'bg-gray-100 text-gray-800'}>
        {level}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!homeroomClass) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
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
          <h1 className="text-3xl font-bold">Bảng điểm lớp chủ nhiệm</h1>
          <p className="text-muted-foreground">
            {homeroomClass.className} - Năm học {allSchoolYears.find(sy => sy.code === selectedYear)?.name || selectedYear}
          </p>
        </div>
      </div>

      {/* Bộ lọc */}
      <Card>
        <CardContent className="p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Năm học</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
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
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn học kỳ" />
                </SelectTrigger>
                <SelectContent>
                  {semesters.map(s => (
                    <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all-grades">
            <FileText className="h-4 w-4 mr-2" />
            Tất cả điểm
          </TabsTrigger>
          <TabsTrigger value="averages">
            <BarChart3 className="h-4 w-4 mr-2" />
            Điểm trung bình
          </TabsTrigger>
          <TabsTrigger value="classification">
            <Award className="h-4 w-4 mr-2" />
            Xếp loại
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Tất cả điểm */}
        <TabsContent value="all-grades" className="space-y-4">
          {allGradesData.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Chưa có dữ liệu điểm số</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  Bảng điểm tất cả môn học - Học kỳ {selectedSemester}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>STT</TableHead>
                        <TableHead>Họ và tên</TableHead>
                        <TableHead>Mã HS</TableHead>
                        {allGradesData[0]?.subjects?.map((subject: any) => (
                          <TableHead key={subject.subject._id} className="text-center">
                            {subject.subject.name}
                          </TableHead>
                        ))}
                        <TableHead className="text-center">ĐTB HK</TableHead>
                        <TableHead className="text-center">Hạnh kiểm</TableHead>
                        <TableHead className="text-center">Học lực</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allGradesData.map((student, index) => (
                        <TableRow key={student._id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>{student.studentCode}</TableCell>
                          {student.subjects?.map((subject: any) => (
                            <TableCell key={subject.subject._id} className="text-center">
                              {subject.average !== null ? subject.average.toFixed(1) : '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-semibold">
                            {student.semesterAverage !== null && student.semesterAverage !== undefined 
                              ? student.semesterAverage.toFixed(2) 
                              : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {getConductBadge(student.conduct)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getAcademicLevelBadge(student.academicLevel)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Điểm trung bình */}
        <TabsContent value="averages" className="space-y-4">
          {averagesData.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Chưa có dữ liệu điểm trung bình</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {averagesData.map((student) => (
                <Card key={student._id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{student.name} - {student.studentCode}</span>
                      <div className="flex gap-2">
                        {getConductBadge(student.conduct.year)}
                        {getAcademicLevelBadge(student.academicLevel.year)}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Điểm trung bình từng môn */}
                      <div>
                        <h3 className="font-semibold mb-2">Điểm trung bình từng môn</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {student.subjectAverages.map((subj: any) => (
                            <div key={subj.subject._id} className="p-2 border rounded">
                              <div className="text-sm font-medium">{subj.subject.name}</div>
                              <div className="text-xs text-muted-foreground">
                                HKI: {subj.hk1 !== null ? subj.hk1.toFixed(1) : '-'} | 
                                HKII: {subj.hk2 !== null ? subj.hk2.toFixed(1) : '-'} | 
                                CN: {subj.year !== null ? subj.year.toFixed(1) : '-'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Điểm trung bình học kỳ/năm */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <div className="text-sm text-muted-foreground">ĐTB HKI</div>
                          <div className="text-2xl font-bold">
                            {student.averages.hk1 !== null ? student.averages.hk1.toFixed(2) : '-'}
                          </div>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded">
                          <div className="text-sm text-muted-foreground">ĐTB HKII</div>
                          <div className="text-2xl font-bold">
                            {student.averages.hk2 !== null ? student.averages.hk2.toFixed(2) : '-'}
                          </div>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
                          <div className="text-sm text-muted-foreground">ĐTB Cả năm</div>
                          <div className="text-2xl font-bold">
                            {student.averages.year !== null ? student.averages.year.toFixed(2) : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Xếp loại */}
        <TabsContent value="classification" className="space-y-4">
          {!classificationData ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Thống kê */}
              {classificationData.statistics && (
                <Card>
                  <CardHeader>
                    <CardTitle>Thống kê xếp loại</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold mb-2">Hạnh kiểm</h3>
                        <div className="space-y-1">
                          {Object.entries(classificationData.statistics.conduct).map(([key, value]: [string, any]) => (
                            <div key={key} className="flex justify-between">
                              <span>{key}:</span>
                              <span className="font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Học lực</h3>
                        <div className="space-y-1">
                          {Object.entries(classificationData.statistics.academicLevel).map(([key, value]: [string, any]) => (
                            <div key={key} className="flex justify-between">
                              <span>{key}:</span>
                              <span className="font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Danh sách học sinh */}
              <Card>
                <CardHeader>
                  <CardTitle>Kết quả xếp loại học tập</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>STT</TableHead>
                          <TableHead>Họ và tên</TableHead>
                          <TableHead>Mã HS</TableHead>
                          <TableHead className="text-center">ĐTB</TableHead>
                          <TableHead className="text-center">Hạnh kiểm</TableHead>
                          <TableHead className="text-center">Học lực</TableHead>
                          <TableHead className="text-center">Xếp hạng</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classificationData.data?.map((student: any, index: number) => (
                          <TableRow key={student._id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.studentCode}</TableCell>
                            <TableCell className="text-center font-semibold">
                              {student.gpa !== null ? student.gpa.toFixed(2) : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {getConductBadge(student.conduct)}
                            </TableCell>
                            <TableCell className="text-center">
                              {getAcademicLevelBadge(student.academicLevel)}
                            </TableCell>
                            <TableCell className="text-center">
                              {student.rank || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

