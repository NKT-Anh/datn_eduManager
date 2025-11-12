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
import { BookOpen, Users, GraduationCap, Clock } from "lucide-react";
import { subjectApi } from "@/services/subjectApi";
import { teacherApi } from "@/services/teacherApi";
import { assignmentApi } from "@/services/assignmentApi";
import { classApiNoToken } from "@/services/classApi";
import { SubjectDetailResponse } from "@/types/class";
import {getSubjectDetail} from "@/services/getSubjectDetail";
interface SubjectDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId?: string;
}

export const SubjectDetailDialog = ({
  open,
  onOpenChange,
  subjectId,
}: SubjectDetailDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState<SubjectDetailResponse["subject"] | null>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  const dayNames = ["", "", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

useEffect(() => {
  if (!open || !subjectId) return;

  const fetchDetail = async () => {
    setLoading(true);
    setSubject(null);
    setTeachers([]);
    setClasses([]);
    setAssignments([]);
    setSchedules([]);

    try {
      const detail = await getSubjectDetail(subjectId);

      setSubject(detail.subject);
      setTeachers(detail.teachers);
      setClasses(detail.classes);
      setAssignments(detail.assignments);
      setSchedules(detail.schedules);
    } catch (err) {
      console.error("Lỗi khi lấy chi tiết môn học:", err);
    } finally {
      setLoading(false);
    }
  };

  fetchDetail();
}, [open, subjectId]);



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="subject-dialog-description" className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {loading ? (
            <DialogTitle>Đang tải môn học...</DialogTitle>
          ) : subject ? (
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-primary rounded-lg">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl">{subject.name}</DialogTitle>
                <DialogDescription>
                  Mã môn: <Badge variant="outline">{subject.code}</Badge>
                </DialogDescription>
              </div>
            </div>
          ) : (
            <DialogTitle>Không tìm thấy thông tin môn học</DialogTitle>
          )}
        </DialogHeader>

        {loading && <p className="text-center py-6">Đang tải...</p>}

        {!loading && subject && (
          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="teachers">Giáo viên</TabsTrigger>
              <TabsTrigger value="assignments">Phân công</TabsTrigger>
              <TabsTrigger value="schedule">Lịch dạy</TabsTrigger>
            </TabsList>

            {/* Tổng quan */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <GraduationCap className="h-4 w-4 mr-2 text-primary" />
                      Số lớp học
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-primary">{classes.length}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Users className="h-4 w-4 mr-2 text-success" />
                      Số giáo viên
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-success">{teachers.length}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-warning" />
                      Tiết dạy/tuần
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-warning">{schedules.length}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Thông tin chi tiết</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Tên môn học</p>
                      <p className="font-medium">{subject.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Mã môn</p>
                      <p className="font-medium">{subject.code}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Giáo viên */}
            <TabsContent value="teachers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Giáo viên giảng dạy</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Họ và tên</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>SĐT</TableHead>
                        <TableHead>Số lớp dạy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teachers.length > 0 ? (
                        teachers.map((teacher) => {
                          const teacherClasses = assignments.filter(
                            (a) => a.teacherId?._id === teacher._id
                          );
                          return (
                            <TableRow key={teacher._id}>
                              <TableCell className="font-medium">{teacher.name}</TableCell>
                              <TableCell>{teacher.email}</TableCell>
                              <TableCell>{teacher.phone}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{teacherClasses.length} lớp</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Chưa có giáo viên nào được phân công
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Phân công */}
            <TabsContent value="assignments" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Phân công giảng dạy</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lớp học</TableHead>
                        <TableHead>Giáo viên</TableHead>
                        <TableHead>Học kỳ</TableHead>
                        <TableHead>Năm học</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.length > 0 ? (
                        assignments.map((a) => {
                          const teacher = teachers.find((t) => t._id === a.teacherId._id);
                          const classInfo = classes.find((c) => c._id === a.classId._id);
                          return (
                            <TableRow key={a._id}>
                              <TableCell className="font-medium">{classInfo?.className}</TableCell>
                              <TableCell>{teacher?.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">Học kỳ {a.semester}</Badge>
                              </TableCell>
                              <TableCell>{a.year}</TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Chưa có phân công giảng dạy
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Lịch dạy */}
            <TabsContent value="schedule" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Lịch giảng dạy</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Thứ</TableHead>
                        <TableHead>Tiết</TableHead>
                        <TableHead>Lớp</TableHead>
                        <TableHead>Giáo viên</TableHead>
                        <TableHead>Phòng</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.length > 0 ? (
                        schedules.map((s) => {
                          const teacher = teachers.find((t) => t._id === s.teacherId);
                          const classInfo = classes.find((c) => c._id === s.classId);
                          return (
                            <TableRow key={s._id}>
                              <TableCell>
                                <Badge variant="outline">{dayNames[s.dayOfWeek]}</Badge>
                              </TableCell>
                              <TableCell>Tiết {s.period}</TableCell>
                              <TableCell className="font-medium">{classInfo?.name}</TableCell>
                              <TableCell>{teacher?.name}</TableCell>
                              <TableCell>{s.room || "—"}</TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            Chưa có lịch giảng dạy
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};