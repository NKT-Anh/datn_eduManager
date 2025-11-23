import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSchoolYears } from '@/hooks';
import api from '@/services/axiosInstance';
import { toast } from 'sonner';
import { 
  Users, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Award, 
  AlertCircle,
  FileText,
  BookOpen
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Student {
  _id: string;
  name: string;
  studentCode: string;
  dob?: string;
  gender?: string;
  avatarUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  classId?: {
    _id: string;
    className: string;
    grade: string;
    year: string;
  };
  parents?: Array<{
    _id: string;
    name: string;
    phone?: string;
    relation?: string;
  }>;
  yearRecords?: {
    hk1?: any;
    hk2?: any;
    year?: any;
  };
  grades?: {
    hk1: any[];
    hk2: any[];
    hk1Average: number | null;
    hk2Average: number | null;
    yearAverage: number | null;
  };
  conduct?: string;
  academicLevel?: string;
}

interface GradeTableData {
  students: Array<{
    stt: number;
    studentId: string;
    name: string;
    studentCode: string;
    subjectGrades: Record<string, { hk1: number | null; hk2: number | null; year: number | null }>;
    hk1Average: number | null;
    hk2Average: number | null;
    yearAverage: number | null;
    academicLevel: string | null;
    conduct: string | null;
    overallClassification: string | null;
  }>;
  subjects: Array<{ _id: string; name: string; code: string }>;
  classId: string;
  schoolYear: string;
}

export default function HomeroomClassPage() {
  const { backendUser } = useAuth();
  const { currentYearData, currentYear, schoolYears: allSchoolYears } = useSchoolYears();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [gradeTable, setGradeTable] = useState<GradeTableData | null>(null);
  const [homeroomClass, setHomeroomClass] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('students');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [allHomeroomClasses, setAllHomeroomClasses] = useState<Array<{ schoolYear: string; class: any }>>([]);
  const [yearSearchOpen, setYearSearchOpen] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  // ✅ Lấy tất cả lớp chủ nhiệm qua các năm học
  useEffect(() => {
    const fetchAllHomeroomClasses = async () => {
      try {
        setLoading(true);
        const res = await api.get('/class/homeroom/classes');
        if (res.data.success) {
          setAllHomeroomClasses(res.data.data || []);
          
          // ✅ Tự động chọn năm học hiện tại nếu có
          const currentYearCode = currentYearData?.code || currentYear;
          if (currentYearCode) {
            setSelectedYear(currentYearCode);
          } else if (res.data.data && res.data.data.length > 0) {
            // Nếu không có năm hiện tại, chọn năm đầu tiên
            setSelectedYear(res.data.data[0].schoolYear);
          }
        }
      } catch (err: any) {
        console.error('Error fetching all homeroom classes:', err);
        toast.error(err.response?.data?.message || 'Không thể tải danh sách lớp chủ nhiệm');
      } finally {
        setLoading(false);
      }
    };
    fetchAllHomeroomClasses();
  }, [currentYearData, currentYear]);

  // ✅ Lấy lớp chủ nhiệm theo năm học đã chọn
  useEffect(() => {
    const fetchHomeroomClass = async () => {
      if (!selectedYear) {
        setHomeroomClass(null);
        setStudents([]);
        setGradeTable(null);
        return;
      }

      try {
        const res = await api.get('/class/homeroom/class', { params: { year: selectedYear } });
        if (res.data.success && res.data.data) {
          setHomeroomClass(res.data.data);
        } else {
          setHomeroomClass(null);
          setStudents([]);
          setGradeTable(null);
        }
      } catch (err: any) {
        console.error('Error fetching homeroom class:', err);
        setHomeroomClass(null);
        setStudents([]);
        setGradeTable(null);
      }
    };
    fetchHomeroomClass();
  }, [selectedYear]);

  // ✅ Lấy danh sách học sinh
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedYear || !homeroomClass) {
        setStudents([]);
        return;
      }

      try {
        const res = await api.get('/class/homeroom/students', { params: { year: selectedYear } });
        if (res.data.success) {
          setStudents(res.data.data || []);
        }
      } catch (err: any) {
        console.error('Error fetching students:', err);
        toast.error(err.response?.data?.message || 'Không thể tải danh sách học sinh');
        setStudents([]);
      }
    };
    fetchStudents();
  }, [homeroomClass, selectedYear]);

  // ✅ Lấy bảng điểm
  useEffect(() => {
    const fetchGrades = async () => {
      if (!selectedYear || !homeroomClass || activeTab !== 'grades') {
        setGradeTable(null);
        return;
      }

      try {
        const res = await api.get('/class/homeroom/grades', { params: { year: selectedYear } });
        if (res.data.success) {
          setGradeTable(res.data.data);
        }
      } catch (err: any) {
        console.error('Error fetching grades:', err);
        toast.error(err.response?.data?.message || 'Không thể tải bảng điểm');
        setGradeTable(null);
      }
    };
    fetchGrades();
  }, [homeroomClass, activeTab, selectedYear]);

  const getGenderLabel = (gender?: string) => {
    if (gender === 'male') return 'Nam';
    if (gender === 'female') return 'Nữ';
    return 'Khác';
  };

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

  // ✅ Lấy danh sách năm học có lớp chủ nhiệm
  const availableYears = Array.from(new Set(allHomeroomClasses.map(item => item.schoolYear)))
    .sort()
    .reverse(); // Mới nhất trước

  // ✅ Filter học sinh theo từ khóa tìm kiếm
  const filteredStudents = students.filter(student => {
    if (!studentSearchTerm) return true;
    const searchLower = studentSearchTerm.toLowerCase();
    return (
      student.name.toLowerCase().includes(searchLower) ||
      student.studentCode.toLowerCase().includes(searchLower) ||
      (student.email && student.email.toLowerCase().includes(searchLower)) ||
      (student.phone && student.phone.includes(searchLower)) ||
      (student.classId?.className && student.classId.className.toLowerCase().includes(searchLower))
    );
  });

  // ✅ Nếu không có lớp chủ nhiệm nào
  if (allHomeroomClasses.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Chưa có lớp chủ nhiệm</h3>
          <p className="text-muted-foreground">
            Thầy/cô chưa được phân công làm giáo viên chủ nhiệm lớp nào trong các năm học
          </p>
        </CardContent>
      </Card>
    );
  }

  // ✅ Nếu năm học đã chọn không có lớp chủ nhiệm
  if (selectedYear && !homeroomClass) {
    return (
      <div className="space-y-6">
        {/* Header với dropdown chọn năm học */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Lớp chủ nhiệm</h1>
            <p className="text-muted-foreground">Xem thông tin lớp chủ nhiệm qua các năm học</p>
          </div>
          <div className="flex items-center gap-4">
            <Label>Năm học:</Label>
            <Popover open={yearSearchOpen} onOpenChange={setYearSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={yearSearchOpen}
                  className="w-[250px] justify-between"
                >
                  {selectedYear
                    ? (allSchoolYears.find(sy => sy.code === selectedYear)?.name || selectedYear)
                    : "Chọn năm học..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0">
                <Command>
                  <CommandInput placeholder="Tìm kiếm năm học..." />
                  <CommandList>
                    <CommandEmpty>Không tìm thấy năm học nào.</CommandEmpty>
                    <CommandGroup>
                      {availableYears.map((year) => {
                        const yearName = allSchoolYears.find(sy => sy.code === year)?.name || year;
                        return (
                          <CommandItem
                            key={year}
                            value={`${year} ${yearName}`}
                            onSelect={() => {
                              setSelectedYear(year);
                              setYearSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedYear === year ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {yearName}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nhiệm kỳ này thầy/cô không có lớp chủ nhiệm</h3>
            <p className="text-muted-foreground">
              Năm học {allSchoolYears.find(sy => sy.code === selectedYear)?.name || selectedYear}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!homeroomClass) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header với dropdown chọn năm học */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Lớp chủ nhiệm</h1>
            <p className="text-muted-foreground">
              {homeroomClass.className} - Năm học {allSchoolYears.find(sy => sy.code === selectedYear)?.name || selectedYear}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Label>Năm học:</Label>
            <Popover open={yearSearchOpen} onOpenChange={setYearSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={yearSearchOpen}
                  className="w-[250px] justify-between"
                >
                  {selectedYear
                    ? (allSchoolYears.find(sy => sy.code === selectedYear)?.name || selectedYear)
                    : "Chọn năm học..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0">
                <Command>
                  <CommandInput placeholder="Tìm kiếm năm học..." />
                  <CommandList>
                    <CommandEmpty>Không tìm thấy năm học nào.</CommandEmpty>
                    <CommandGroup>
                      {availableYears.map((year) => {
                        const yearName = allSchoolYears.find(sy => sy.code === year)?.name || year;
                        return (
                          <CommandItem
                            key={year}
                            value={`${year} ${yearName}`}
                            onSelect={() => {
                              setSelectedYear(year);
                              setYearSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedYear === year ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {yearName}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="students">
            <Users className="h-4 w-4 mr-2" />
            Thông tin học sinh
          </TabsTrigger>
          <TabsTrigger value="grades">
            <FileText className="h-4 w-4 mr-2" />
            Bảng điểm
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Thông tin học sinh */}
        <TabsContent value="students" className="space-y-4">
          {students.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Chưa có học sinh nào trong lớp</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ✅ Ô tìm kiếm học sinh */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Tìm kiếm học sinh theo tên, mã HS, email, SĐT, lớp..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="max-w-md"
                    />
                    {studentSearchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStudentSearchTerm('')}
                      >
                        Xóa
                      </Button>
                    )}
                  </div>
                  {studentSearchTerm && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Tìm thấy {filteredStudents.length} học sinh
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4">
                {filteredStudents.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">
                        Không tìm thấy học sinh nào với từ khóa "{studentSearchTerm}"
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredStudents.map((student) => (
                <Card key={student._id}>
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={student.avatarUrl} alt={student.name} />
                        <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-xl">{student.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Mã HS: {student.studentCode}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {student.academicLevel && getAcademicLevelBadge(student.academicLevel)}
                        {student.conduct && getConductBadge(student.conduct)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Thông tin cá nhân */}
                      <div className="space-y-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Thông tin cá nhân
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Ngày sinh:</span>
                            <span>{student.dob ? new Date(student.dob).toLocaleDateString('vi-VN') : 'Chưa có'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Giới tính:</span>
                            <span>{getGenderLabel(student.gender)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Mã học sinh:</span>
                            <span className="font-medium">{student.studentCode}</span>
                          </div>
                        </div>
                      </div>

                      {/* Thông tin liên lạc */}
                      <div className="space-y-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Thông tin liên lạc
                        </h3>
                        <div className="space-y-2 text-sm">
                          {student.address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <span className="text-muted-foreground">Địa chỉ: </span>
                                <span>{student.address}</span>
                              </div>
                            </div>
                          )}
                          {student.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">SĐT học sinh: </span>
                              <span>{student.phone}</span>
                            </div>
                          )}
                          {student.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Email: </span>
                              <span>{student.email}</span>
                            </div>
                          )}
                          {student.parents && student.parents.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Phụ huynh:</span>
                              {student.parents.map((parent, idx) => (
                                <div key={parent._id || idx} className="flex items-center gap-2 ml-4">
                                  <span className="text-sm">
                                    {parent.name} {parent.relation && `(${parent.relation})`}
                                    {parent.phone && ` - ${parent.phone}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Thông tin học tập */}
                      <div className="space-y-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Thông tin học tập
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Lớp hiện tại: </span>
                            <span className="font-medium">
                              {student.classId?.className || 'Chưa có'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Năm học: </span>
                            <span>{student.classId?.year || currentYearData?.name || currentYear}</span>
                          </div>
                          {student.grades && (
                            <div className="space-y-1">
                              <div>
                                <span className="text-muted-foreground">ĐTB HKI: </span>
                                <span className="font-medium">
                                  {student.grades.hk1Average !== null 
                                    ? student.grades.hk1Average.toFixed(2) 
                                    : 'Chưa có'}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">ĐTB HKII: </span>
                                <span className="font-medium">
                                  {student.grades.hk2Average !== null 
                                    ? student.grades.hk2Average.toFixed(2) 
                                    : 'Chưa có'}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">ĐTB cả năm: </span>
                                <span className="font-medium">
                                  {student.grades.yearAverage !== null 
                                    ? student.grades.yearAverage.toFixed(2) 
                                    : 'Chưa có'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Khen thưởng - Kỷ luật */}
                      <div className="space-y-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Award className="h-4 w-4" />
                          Khen thưởng - Kỷ luật
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Học lực: </span>
                            {student.academicLevel ? getAcademicLevelBadge(student.academicLevel) : <span>Chưa có</span>}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Hạnh kiểm: </span>
                            {student.conduct ? getConductBadge(student.conduct) : <span>Chưa có</span>}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            (Thông tin khen thưởng và kỷ luật chi tiết sẽ được bổ sung sau)
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                  ))
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab 2: Bảng điểm */}
        <TabsContent value="grades" className="space-y-4">
          {!gradeTable ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : gradeTable.students.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Chưa có dữ liệu điểm số</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Bảng điểm lớp {homeroomClass.className} - Năm học {gradeTable.schoolYear}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10">STT</TableHead>
                        <TableHead className="sticky left-12 bg-background z-10 min-w-[150px]">Họ và tên</TableHead>
                        <TableHead className="sticky left-[200px] bg-background z-10">Mã HS</TableHead>
                        {gradeTable.subjects.map((subject) => (
                          <TableHead key={subject._id} className="text-center min-w-[80px]">
                            {subject.name}
                          </TableHead>
                        ))}
                        <TableHead className="text-center">ĐTB HKI</TableHead>
                        <TableHead className="text-center">ĐTB HKII</TableHead>
                        <TableHead className="text-center">ĐTB CN</TableHead>
                        <TableHead className="text-center">Học lực</TableHead>
                        <TableHead className="text-center">Hạnh kiểm</TableHead>
                        <TableHead className="text-center">Xếp loại</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gradeTable.students.map((student) => (
                        <TableRow key={student.studentId}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium">
                            {student.stt}
                          </TableCell>
                          <TableCell className="sticky left-12 bg-background z-10 font-medium">
                            {student.name}
                          </TableCell>
                          <TableCell className="sticky left-[200px] bg-background z-10">
                            {student.studentCode}
                          </TableCell>
                          {gradeTable.subjects.map((subject) => {
                            const grades = student.subjectGrades[subject._id] || { hk1: null, hk2: null, year: null };
                            return (
                              <TableCell key={subject._id} className="text-center">
                                {grades.year !== null ? grades.year.toFixed(1) : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-medium">
                            {student.hk1Average !== null ? student.hk1Average.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {student.hk2Average !== null ? student.hk2Average.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {student.yearAverage !== null ? student.yearAverage.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {student.academicLevel ? getAcademicLevelBadge(student.academicLevel) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {student.conduct ? getConductBadge(student.conduct) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {student.overallClassification ? (
                              <Badge className={
                                student.overallClassification === 'Giỏi' ? 'bg-purple-100 text-purple-800' :
                                student.overallClassification === 'Khá' ? 'bg-blue-100 text-blue-800' :
                                student.overallClassification === 'Trung bình' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {student.overallClassification}
                              </Badge>
                            ) : '-'}
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
      </Tabs>
    </div>
  );
}

