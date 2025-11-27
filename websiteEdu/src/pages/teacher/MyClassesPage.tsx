import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { assignmentApi } from '@/services/assignmentApi';
import studentApi from '@/services/studentApi';
import { classApi } from '@/services/classApi';
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSchoolYears } from '@/hooks';
import {
  School,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { TeachingAssignment } from '@/types/class';

interface ClassWithSubjects {
  classId: string;
  className: string;
  classCode?: string;
  grade: string;
  year?: string;
  studentCount?: number;
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    assignmentId: string;
  }>;
}

const MyClassesPage = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [classes, setClasses] = useState<ClassWithSubjects[]>([]);
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [loading, setLoading] = useState(true);

  // ✅ Lấy năm học hiện tại từ hooks (ưu tiên năm học có isActive: true)
  const { schoolYears: allSchoolYears, currentYear, currentYearData } = useSchoolYears();
  useEffect(() => {
    if (currentYearData) {
      // Ưu tiên năm học hiện tại (isActive: true) - dùng code thay vì name
      const yearCode = currentYearData.code || currentYearData.name;
      if (yearCode) {
        setSchoolYear(yearCode);
      }
    } else if (allSchoolYears.length > 0) {
      // Nếu không có năm học active, lấy năm học cuối cùng - ưu tiên code
      const lastYear = allSchoolYears[allSchoolYears.length - 1];
      const yearCode = lastYear.code || lastYear.name;
      if (yearCode) {
        setSchoolYear(yearCode);
      }
    } else {
      // Fallback: tính toán năm học từ ngày hiện tại
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      setSchoolYear(currentYear);
    }
  }, [allSchoolYears, currentYearData]);

  // Lấy danh sách phân công giảng dạy
  useEffect(() => {
    const fetchAssignments = async () => {
      // ✅ Sử dụng teacherId thay vì _id (accountId)
      const teacherId = backendUser?.teacherId || backendUser?._id;
      if (!teacherId || !schoolYear) return;
      try {
        setLoading(true);
        // ✅ Đảm bảo year là code (format: "2027-2028") không phải name ("Năm học 2027 - 2028")
        const yearCode = schoolYear;
        const res = await assignmentApi.getByTeacher(teacherId, {
          year: yearCode,
          semester,
        });
        const assignmentList = Array.isArray(res) ? res : [];
        setAssignments(assignmentList);

        // Nhóm theo lớp
        const classMap = new Map<string, ClassWithSubjects>();

        assignmentList.forEach((assignment: TeachingAssignment) => {
          const classId = assignment.classId._id;
          const className = assignment.classId.className;
          const classCode = assignment.classId.classCode;
          const grade = assignment.classId.grade;

          if (!classMap.has(classId)) {
            classMap.set(classId, {
              classId,
              className,
              classCode,
              grade,
              year: assignment.classId.year || schoolYear,
              subjects: [],
            });
          }

          const classItem = classMap.get(classId)!;
          classItem.subjects.push({
            subjectId: assignment.subjectId._id,
            subjectName: assignment.subjectId.name,
            assignmentId: assignment._id,
          });
        });

        const classesList = Array.from(classMap.values()).sort((a, b) => {
          // Sắp xếp theo khối rồi tên lớp
          if (a.grade !== b.grade) {
            return a.grade.localeCompare(b.grade);
          }
          return a.className.localeCompare(b.className);
        });

        // ✅ Lấy số học sinh chính xác theo niên khóa và lớp
        const classesWithStudentCount = await Promise.all(
          classesList.map(async (classItem) => {
            try {
              // Lấy thông tin lớp để có currentSize hoặc lấy từ API
              const classInfo = await classApi.getById(classItem.classId);
              let studentCount = classInfo.currentSize || 0;

              // ✅ Nếu currentSize không có hoặc không chính xác, đếm từ Student API theo niên khóa
              if (!studentCount || studentCount === 0) {
                const students = await studentApi.getAll({
                  classId: classItem.classId,
                  status: 'active',
                  currentYear: classItem.year || schoolYear,
                });
                studentCount = Array.isArray(students) ? students.length : 0;
              }

              return {
                ...classItem,
                studentCount,
              };
            } catch (err) {
              console.error(`Error fetching student count for class ${classItem.classId}:`, err);
              return {
                ...classItem,
                studentCount: 0,
              };
            }
          })
        );

        setClasses(classesWithStudentCount);
      } catch (err: any) {
        console.error('Error fetching assignments:', err);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải danh sách lớp giảng dạy',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, [backendUser, schoolYear, semester]);

  // Thống kê
  const totalClasses = classes.length;
  const totalSubjects = new Set(assignments.map((a) => a.subjectId._id)).size;

  if (!backendUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Không có quyền truy cập</h2>
          <p className="text-muted-foreground mt-2">Bạn không có quyền truy cập trang này.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Lớp giảng dạy của tôi</h1>
          <p className="text-muted-foreground">
            Xem danh sách các lớp bạn đang giảng dạy
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Năm học</label>
              <Select value={schoolYear} onValueChange={setSchoolYear}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {allSchoolYears
                    .filter((year) => (year.code || year.name) && (year.code || year.name).trim() !== "")
                    .map((year) => {
                      const yearValue = year.code || year.name;
                      return (
                        <SelectItem key={year._id} value={yearValue}>
                          {year.name} {year.isActive && "(Năm học hiện tại)"}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Học kỳ</label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Học kỳ 1</SelectItem>
                  <SelectItem value="2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">Năm học:</span> {schoolYear || "Chưa chọn"} | 
              <span className="font-semibold ml-2">Học kỳ:</span> {semester === "1" ? "Học kỳ 1" : "Học kỳ 2"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <School className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{totalClasses}</p>
            <p className="text-sm text-muted-foreground">Lớp giảng dạy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="h-8 w-8 text-success mx-auto mb-2" />
            <p className="text-2xl font-bold">{totalSubjects}</p>
            <p className="text-sm text-muted-foreground">Môn học</p>
          </CardContent>
        </Card>
      </div>

      {/* Classes List */}
      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Đang tải danh sách lớp...</p>
          </CardContent>
        </Card>
      ) : classes.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">STT</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>Khối</TableHead>
                  <TableHead>Môn học</TableHead>
                  <TableHead>Năm học</TableHead>
                  <TableHead>Học kỳ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((classItem, index) => (
                  <TableRow key={classItem.classId}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <School className="h-4 w-4 text-primary" />
                        <div>
                          <div className="font-medium">{classItem.className}</div>
                          {classItem.classCode && (
                            <div className="text-sm text-muted-foreground">
                              ({classItem.classCode})
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Khối {classItem.grade}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {classItem.subjects.map((subject) => (
                          <Badge key={subject.subjectId} variant="secondary" className="text-xs">
                            {subject.subjectName}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{classItem.year || schoolYear}</div>
                        {classItem.studentCount !== undefined && (
                          <div className="text-sm text-muted-foreground">
                            {classItem.studentCount} học sinh
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>Học kỳ {semester}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <School className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Chưa có lớp giảng dạy</h3>
            <p className="text-muted-foreground">
              Bạn chưa được phân công giảng dạy lớp nào trong năm học {schoolYear} học kỳ {semester}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MyClassesPage;

