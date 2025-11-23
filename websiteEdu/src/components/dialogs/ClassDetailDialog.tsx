import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  GraduationCap,
  School,
  Calendar,
  BookOpen,
  User,
  Phone,
  MapPin,
  Eye,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ClassType } from "@/types/class";
import { Student } from "@/types/auth";
import { Teacher } from "@/types/auth";
import { classApi } from "@/services/classApi";
import { scheduleApi } from "@/services/scheduleApi";
import { assignmentApi } from "@/services/assignmentApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudentDetailDialog } from "./StudentDetailDialog";

interface ClassDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classItem: ClassType | null;
  students?: Student[];
  teachers?: Teacher[];
}

export const ClassDetailDialog = ({
  open,
  onOpenChange,
  classItem,
  students = [],
  teachers = [],
}: ClassDetailDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [classDetail, setClassDetail] = useState<ClassType | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>();
  const [isStudentDetailDialogOpen, setIsStudentDetailDialogOpen] = useState(false);
  const { toast } = useToast();

  const dayNames: Record<string, string> = {
    mon: "Thứ 2",
    tue: "Thứ 3",
    wed: "Thứ 4",
    thu: "Thứ 5",
    fri: "Thứ 6",
    sat: "Thứ 7",
  };

  useEffect(() => {
    if (!open || !classItem) return;

    const fetchDetail = async () => {
      setLoading(true);
      setClassDetail(null);
      setClassStudents([]);
      setSchedules([]);
      setAssignments([]);

      try {
        // Lấy thông tin chi tiết lớp (nếu cần, hoặc dùng classItem trực tiếp)
        // const detail = await classApi.getById(classItem._id);
        // setClassDetail(detail);
        setClassDetail(classItem);

        // Lọc học sinh thuộc lớp này
        const filteredStudents = students.filter((s) => {
          if (!s.classId) return false;
          return typeof s.classId === "string"
            ? s.classId === classItem._id
            : s.classId._id === classItem._id;
        });
        setClassStudents(filteredStudents);

        // Lấy thời khóa biểu (nếu có năm học và học kỳ)
        if (classItem.year) {
          try {
            // Thử lấy TKB học kỳ 1
            const schedule1 = await scheduleApi.getScheduleByClass(
              classItem._id,
              classItem.year,
              "1"
            );
            if (schedule1) {
              setSchedules((prev) => [...prev, schedule1]);
            }
          } catch (err) {
            // Không có TKB học kỳ 1
          }

          try {
            // Thử lấy TKB học kỳ 2
            const schedule2 = await scheduleApi.getScheduleByClass(
              classItem._id,
              classItem.year,
              "2"
            );
            if (schedule2) {
              setSchedules((prev) => [...prev, schedule2]);
            }
          } catch (err) {
            // Không có TKB học kỳ 2
          }
        }

        // Lấy phân công giảng dạy
        if (classItem._id) {
          try {
            const allAssignments = await assignmentApi.getAll();
            const classAssignments = allAssignments.filter(
              (a) => a.classId._id === classItem._id
            );
            setAssignments(classAssignments);
          } catch (err) {
            console.error("Lỗi khi lấy phân công giảng dạy:", err);
          }
        }
      } catch (err) {
        console.error("Lỗi khi lấy chi tiết lớp:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [open, classItem, students]);

  if (!classItem) return null;

  const filteredStudents = classStudents.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTeacherName = (teacherId?: string | Teacher | null) => {
    if (!teacherId) return "Chưa phân công";
    const id = typeof teacherId === "string" ? teacherId : teacherId._id;
    const t = teachers.find((x) => x._id === id);
    return t?.name || "Chưa phân công";
  };

  const handleViewStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentDetailDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <School className="h-6 w-6 text-primary" />
              Chi tiết lớp học - {classItem.className}
            </DialogTitle>
            <DialogDescription>
              {classDetail?.year && (
                <span className="text-sm">
                  Năm học: {classDetail.year} | Khối: {classDetail.grade}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <p className="text-muted-foreground">Đang tải...</p>
          </div>
        )}

        {!loading && classDetail && (
          <Tabs defaultValue="overview" className="mt-4 flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="students">Học sinh ({classStudents.length})</TabsTrigger>
              <TabsTrigger value="schedule">Thời khóa biểu</TabsTrigger>
              <TabsTrigger value="assignments">Phân công giảng dạy</TabsTrigger>
            </TabsList>

            {/* Tổng quan */}
            <TabsContent value="overview" className="space-y-4 mt-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Users className="h-4 w-4 mr-2 text-primary" />
                      Sĩ số
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-primary">
                      {classDetail.currentSize || 0}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      / {classDetail.capacity} học sinh
                    </p>
                    <div className="mt-2">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{
                            width: `${
                              ((classDetail.currentSize || 0) / classDetail.capacity) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <GraduationCap className="h-4 w-4 mr-2 text-success" />
                      Giáo viên chủ nhiệm
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {classDetail.teacherId ? (
                      <div>
                        <p className="text-lg font-semibold">
                          {getTeacherName(classDetail.teacherId)}
                        </p>
                        {typeof classDetail.teacherId === "object" &&
                          classDetail.teacherId.teacherCode && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {classDetail.teacherId.teacherCode}
                            </p>
                          )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Chưa phân công</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <School className="h-4 w-4 mr-2 text-warning" />
                      Phòng học
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {classDetail.roomId ? (
                      <div>
                        <p className="text-lg font-semibold">
                          {typeof classDetail.roomId === "object"
                            ? classDetail.roomId.roomCode
                            : classDetail.roomId}
                        </p>
                        {typeof classDetail.roomId === "object" &&
                          classDetail.roomId.name && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {classDetail.roomId.name}
                            </p>
                          )}
                        {typeof classDetail.roomId === "object" &&
                          classDetail.roomId.type && (
                            <Badge variant="outline" className="mt-2">
                              {classDetail.roomId.type === "normal"
                                ? "Phòng học"
                                : classDetail.roomId.type === "lab"
                                ? "Phòng thí nghiệm"
                                : "Phòng máy"}
                            </Badge>
                          )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Chưa có phòng học</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Thông tin chi tiết */}
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin lớp học</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Mã lớp</p>
                      <p className="font-medium">{classDetail.classCode}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tên lớp</p>
                      <p className="font-medium">{classDetail.className}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Khối</p>
                      <Badge variant="outline">Khối {classDetail.grade}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Năm học</p>
                      <p className="font-medium">{classDetail.year || "Chưa có"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Học sinh */}
            <TabsContent value="students" className="mt-4 flex-1 overflow-hidden flex flex-col">
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                {/* Tìm kiếm */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm học sinh..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Danh sách học sinh */}
                <div className="flex-1 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <div className="text-center py-8">
                      <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {searchTerm
                          ? "Không tìm thấy học sinh"
                          : "Lớp này chưa có học sinh"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredStudents.map((student) => (
                        <Card key={student._id} className="hover:bg-muted/50 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <h3 className="font-semibold">{student.name}</h3>
                                  {student.studentCode && (
                                    <Badge variant="outline" className="text-xs">
                                      {student.studentCode}
                                    </Badge>
                                  )}
                                  {student.status === "inactive" && (
                                    <Badge variant="destructive" className="text-xs">
                                      Nghỉ học
                                    </Badge>
                                  )}
                                </div>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                  {student.dob && (
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-3 w-3" />
                                      <span>
                                        {new Date(student.dob).toLocaleDateString("vi-VN")}
                                      </span>
                                    </div>
                                  )}
                                  {student.phone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="h-3 w-3" />
                                      <span>{student.phone}</span>
                                    </div>
                                  )}
                                  {student.address && (
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-3 w-3 text-primary" />
                                      <span className="truncate max-w-[220px]" title={student.address}>
                                        {student.address}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewStudent(student._id)}
                                className="ml-2"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Thời khóa biểu */}
            <TabsContent value="schedule" className="mt-4 flex-1 overflow-y-auto">
              {schedules.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Chưa có thời khóa biểu</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {schedules.map((schedule, idx) => (
                    <Card key={idx}>
                      <CardHeader>
                        <CardTitle>
                          Học kỳ {schedule.semester} - {schedule.year}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {schedule.timetable && schedule.timetable.length > 0 ? (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Thứ</TableHead>
                                  <TableHead>Tiết 1</TableHead>
                                  <TableHead>Tiết 2</TableHead>
                                  <TableHead>Tiết 3</TableHead>
                                  <TableHead>Tiết 4</TableHead>
                                  <TableHead>Tiết 5</TableHead>
                                  <TableHead>Tiết 6</TableHead>
                                  <TableHead>Tiết 7</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {schedule.timetable.map((day: any, dayIdx: number) => (
                                  <TableRow key={dayIdx}>
                                    <TableCell className="font-medium">
                                      {dayNames[day.day] || day.day}
                                    </TableCell>
                                    {Array.from({ length: 7 }).map((_, periodIdx) => {
                                      const period = day.periods?.[periodIdx];
                                      return (
                                        <TableCell key={periodIdx}>
                                          {period?.subject ? (
                                            <div>
                                              <div className="font-medium">{period.subject}</div>
                                              {period.teacher && (
                                                <div className="text-xs text-muted-foreground">
                                                  {period.teacher}
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground">-</span>
                                          )}
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">Chưa có lịch học</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Phân công giảng dạy */}
            <TabsContent value="assignments" className="mt-4 flex-1 overflow-y-auto">
              {assignments.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Chưa có phân công giảng dạy</p>
                </div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Danh sách phân công giảng dạy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Môn học</TableHead>
                          <TableHead>Giáo viên</TableHead>
                          <TableHead>Năm học</TableHead>
                          <TableHead>Học kỳ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map((assignment) => (
                          <TableRow key={assignment._id}>
                            <TableCell className="font-medium">
                              {typeof assignment.subjectId === "object"
                                ? assignment.subjectId.name
                                : assignment.subjectId}
                            </TableCell>
                            <TableCell>
                              {typeof assignment.teacherId === "object"
                                ? assignment.teacherId.name
                                : assignment.teacherId}
                            </TableCell>
                            <TableCell>{assignment.year}</TableCell>
                            <TableCell>
                              <Badge variant="outline">Học kỳ {assignment.semester}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
        </DialogContent>
      </Dialog>

      {/* Dialog chi tiết học sinh - đặt bên ngoài để tránh conflict */}
      <StudentDetailDialog
        open={isStudentDetailDialogOpen}
        onOpenChange={setIsStudentDetailDialogOpen}
        studentId={selectedStudentId}
      />
    </>
  );
};

