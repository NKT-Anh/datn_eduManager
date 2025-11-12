import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import attendanceApi from '@/services/attendanceApi';
import schoolConfigApi from '@/services/schoolConfigApi';
import {
  School,
  Users,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  Hash,
} from 'lucide-react';
import { TeachingAssignment } from '@/types/class';

interface Student {
  _id: string;
  name: string;
  studentCode?: string;
}

interface ClassWithSubjects {
  classId: string;
  className: string;
  classCode?: string;
  grade: string;
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    assignmentId: string;
  }>;
  students?: Student[];
  isExpanded?: boolean;
  loadingStudents?: boolean;
}

const MyClassesPage = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [classes, setClasses] = useState<ClassWithSubjects[]>([]);
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [loading, setLoading] = useState(true);

  // Lấy năm học hiện tại
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await schoolConfigApi.getSchoolYears();
        if (res.data && res.data.length > 0) {
          setSchoolYear(res.data[res.data.length - 1].code);
        } else {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
          setSchoolYear(currentYear);
        }
      } catch (err: any) {
        console.error('Error fetching school year:', err);
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
        setSchoolYear(currentYear);
      }
    };
    fetchSettings();
  }, []);

  // Lấy danh sách phân công giảng dạy
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!backendUser?._id || !schoolYear) return;
      try {
        setLoading(true);
        const res = await assignmentApi.getByTeacher(backendUser._id, {
          year: schoolYear,
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
              subjects: [],
              isExpanded: false,
              loadingStudents: false,
            });
          }

          const classItem = classMap.get(classId)!;
          classItem.subjects.push({
            subjectId: assignment.subjectId._id,
            subjectName: assignment.subjectId.name,
            assignmentId: assignment._id,
          });
        });

        setClasses(Array.from(classMap.values()).sort((a, b) => {
          // Sắp xếp theo khối rồi tên lớp
          if (a.grade !== b.grade) {
            return a.grade.localeCompare(b.grade);
          }
          return a.className.localeCompare(b.className);
        }));
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

  // Lấy danh sách học sinh khi expand
  const fetchStudentsForClass = async (classId: string) => {
    const classIndex = classes.findIndex((c) => c.classId === classId);
    if (classIndex === -1) return;

    // Đánh dấu đang load
    setClasses((prev) =>
      prev.map((c, idx) => (idx === classIndex ? { ...c, loadingStudents: true } : c))
    );

    try {
      const res = await attendanceApi.getStudentsForAttendance(classId);
      if (res.success && res.data) {
        setClasses((prev) =>
          prev.map((c, idx) =>
            idx === classIndex ? { ...c, students: res.data, loadingStudents: false } : c
          )
        );
      }
    } catch (err: any) {
      console.error('Error fetching students:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách học sinh',
        variant: 'destructive',
      });
      setClasses((prev) =>
        prev.map((c, idx) => (idx === classIndex ? { ...c, loadingStudents: false } : c))
      );
    }
  };

  const toggleExpand = (classId: string) => {
    const classIndex = classes.findIndex((c) => c.classId === classId);
    if (classIndex === -1) return;

    const classItem = classes[classIndex];
    const isExpanding = !classItem.isExpanded;

    setClasses((prev) =>
      prev.map((c, idx) =>
        idx === classIndex ? { ...c, isExpanded: isExpanding } : c
      )
    );

    // Nếu đang expand và chưa có danh sách học sinh, thì load
    if (isExpanding && !classItem.students) {
      fetchStudentsForClass(classId);
    }
  };

  // Thống kê
  const totalClasses = classes.length;
  const totalSubjects = new Set(assignments.map((a) => a.subjectId._id)).size;
  const totalStudents = classes.reduce((sum, c) => sum + (c.students?.length || 0), 0);

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
            Xem danh sách các lớp và học sinh bạn đang giảng dạy
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Năm học</label>
              <Input
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                placeholder="2024-2025"
                className="w-full sm:w-[150px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Học kỳ</label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger className="w-full sm:w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Học kỳ 1</SelectItem>
                  <SelectItem value="2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-8 w-8 text-warning mx-auto mb-2" />
            <p className="text-2xl font-bold">{totalStudents || '-'}</p>
            <p className="text-sm text-muted-foreground">Tổng học sinh</p>
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
        <div className="space-y-4">
          {classes.map((classItem) => (
            <Card key={classItem.classId} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpand(classItem.classId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {classItem.isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-primary" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <School className="h-5 w-5 text-primary" />
                        {classItem.className}
                        {classItem.classCode && (
                          <span className="text-sm font-normal text-muted-foreground">
                            ({classItem.classCode})
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Khối {classItem.grade} • {classItem.subjects.length} môn học
                        {classItem.students && ` • ${classItem.students.length} học sinh`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {classItem.subjects.map((subject) => (
                      <Badge key={subject.subjectId} variant="outline">
                        {subject.subjectName}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>

              {classItem.isExpanded && (
                <CardContent className="border-t">
                  <div className="space-y-4 mt-4">
                    {/* Subjects */}
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Môn học giảng dạy
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {classItem.subjects.map((subject) => (
                          <Badge key={subject.subjectId} variant="default" className="text-sm">
                            {subject.subjectName}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Students */}
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Danh sách học sinh
                        {classItem.students && (
                          <span className="text-sm font-normal text-muted-foreground">
                            ({classItem.students.length} học sinh)
                          </span>
                        )}
                      </h4>
                      {classItem.loadingStudents ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                          <span className="text-muted-foreground">Đang tải danh sách học sinh...</span>
                        </div>
                      ) : classItem.students && classItem.students.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">STT</TableHead>
                                <TableHead>Mã học sinh</TableHead>
                                <TableHead>Họ và tên</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {classItem.students.map((student, index) => (
                                <TableRow key={student._id}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Hash className="h-3 w-3 text-muted-foreground" />
                                      {student.studentCode || 'Chưa có mã'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">{student.name}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground border rounded-lg">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Chưa có học sinh trong lớp này</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
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

