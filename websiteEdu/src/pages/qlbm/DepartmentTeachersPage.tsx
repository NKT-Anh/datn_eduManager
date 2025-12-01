import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { departmentApi } from "@/services/departmentApi";
import { Teacher } from "@/types/auth";
import { useCurrentAcademicYear } from "@/hooks/useCurrentAcademicYear";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Mail, Phone, BookOpen, UserCheck } from "lucide-react";
import { getYearRole } from "@/utils/teacher";

const DepartmentTeachersPage = () => {
  const { backendUser } = useAuth();
  const { currentYearCode } = useCurrentAcademicYear();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDepartmentTeachers = async () => {
      // ✅ Lấy departmentId từ teacherFlags (đã được lấy từ yearRoles)
      const departmentId = backendUser?.teacherFlags?.departmentId;
      
      if (backendUser?.role === "teacher" && 
          backendUser?.teacherFlags?.isDepartmentHead && 
          departmentId && 
          currentYearCode) {
        setLoading(true);
        try {
          // ✅ Lấy giáo viên trong tổ theo năm học hiện tại
          const deptTeachers = await departmentApi.getTeachers(departmentId, { year: currentYearCode });
          setTeachers(deptTeachers);
        } catch (error) {
          console.error("Failed to fetch department teachers", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchDepartmentTeachers();
  }, [backendUser, currentYearCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải danh sách giáo viên...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Danh sách giáo viên trong tổ
          </h1>
          <p className="text-muted-foreground mt-2">
            Quản lý danh sách giáo viên thuộc tổ bộ môn của bạn
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {teachers.length} giáo viên
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin giáo viên</CardTitle>
          <CardDescription>
            Danh sách đầy đủ thông tin của các giáo viên trong tổ bộ môn
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teachers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Chưa có giáo viên nào trong tổ bộ môn</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">STT</TableHead>
                    <TableHead className="w-[120px]">Mã GV</TableHead>
                    <TableHead className="min-w-[200px]">Họ và tên</TableHead>
                    <TableHead className="min-w-[200px]">Email</TableHead>
                    <TableHead className="w-[150px]">Số điện thoại</TableHead>
                    <TableHead className="min-w-[250px]">Môn dạy</TableHead>
                    <TableHead className="w-[150px]">Vai trò</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher, index) => {
                    const yearRole = getYearRole(teacher, currentYearCode || undefined);
                    const isHead = yearRole?.isDepartmentHead || teacher.isDepartmentHead;
                    const isHomeroom = yearRole?.isHomeroom || teacher.isHomeroom;
                    const email = teacher.accountId 
                      ? (typeof teacher.accountId === 'object' ? teacher.accountId.email : null)
                      : null;

                    return (
                      <TableRow key={teacher._id}>
                        <TableCell className="text-center">{index + 1}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {teacher.teacherCode || "-"}
                        </TableCell>
                        <TableCell className="font-medium">{teacher.name || "-"}</TableCell>
                        <TableCell>
                          {email ? (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{email}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {teacher.phone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{teacher.phone}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {teacher.subjects && teacher.subjects.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {teacher.subjects.slice(0, 3).map((sub, idx) => {
                                const subjectName = typeof sub.subjectId === 'object' 
                                  ? sub.subjectId?.name 
                                  : typeof sub === 'object' 
                                    ? sub.name 
                                    : null;
                                return (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    <BookOpen className="h-3 w-3 mr-1" />
                                    {subjectName || "N/A"}
                                  </Badge>
                                );
                              })}
                              {teacher.subjects.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{teacher.subjects.length - 3}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {isHead && (
                              <Badge variant="default" className="text-xs">
                                <UserCheck className="h-3 w-3 mr-1" />
                                Tổ trưởng
                              </Badge>
                            )}
                            {isHomeroom && (
                              <Badge variant="secondary" className="text-xs">
                                GVCN
                              </Badge>
                            )}
                            {!isHead && !isHomeroom && (
                              <Badge variant="outline" className="text-xs">
                                GVBM
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DepartmentTeachersPage;