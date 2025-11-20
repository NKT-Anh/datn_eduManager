import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { departmentApi } from "@/services/departmentApi";
import { Teacher } from "@/types/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Eye } from "lucide-react";

const DepartmentTeachersPage = () => {
  const { backendUser } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeachers = async () => {
      if (
        backendUser?.role === "teacher" &&
        backendUser?.teacherFlags?.isDepartmentHead &&
        backendUser?.department
      ) {
        setLoading(true);
        setError(null);
        try {
          const deptTeachers = await departmentApi.getTeachers(backendUser.department);
          setTeachers(deptTeachers);
        } catch (err: any) {
          setError("Không thể tải danh sách giáo viên tổ bộ môn.");
        } finally {
          setLoading(false);
        }
      }
    };
    fetchTeachers();
  }, [backendUser]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Danh sách giáo viên tổ bộ môn</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center text-red-600 py-8">{error}</div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có giáo viên nào trong tổ bộ môn này.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachers.map((teacher) => (
                <Card key={teacher._id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{teacher.name}</h4>
                      <p className="text-sm text-muted-foreground">Mã GV: {teacher.teacherCode || "-"}</p>
                      <p className="text-sm text-muted-foreground">SĐT: {teacher.phone || "-"}</p>
                      <p className="text-sm text-muted-foreground">Môn chính: {teacher.mainSubject?.name || "-"}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {teacher.subjects?.map((sub, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {sub.subjectId?.name || "-"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge variant={teacher.status === 'active' ? 'default' : 'secondary'}>
                      {teacher.status === 'active' ? 'Đang làm việc' : 'Đã nghỉ việc'}
                    </Badge>
                  </div>
                  {/* Chỉ xem, không cho sửa/xóa/thêm */}
                  <div className="flex justify-end mt-4">
                    <Button variant="outline" size="sm" title="Xem chi tiết" disabled>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Phân công giảng dạy đề xuất lên admin/BGH */}
      <Card>
        <CardHeader>
          <CardTitle>Phân công giảng dạy (Đề xuất)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">
            Trưởng bộ môn có thể đề xuất phân công giảng dạy cho các giáo viên trong tổ. Đề xuất này sẽ được gửi lên admin hoặc BGH để duyệt.
          </div>
          <div className="mt-4">
            <Button variant="default" disabled>
              Đề xuất phân công giảng dạy (chưa triển khai)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DepartmentTeachersPage;
