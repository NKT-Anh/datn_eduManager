import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useStudents } from "@/hooks/auth/useStudents";
import { Eye, Search, School } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * ✅ BGH Students List - Chỉ xem, không tạo/sửa/xóa
 */
export default function BGHStudentsList() {
  const navigate = useNavigate();
  const { students = [], isLoading } = useStudents();
  const [searchTerm, setSearchTerm] = useState("");

  const prefix = "/bgh";

  const filteredStudents = students?.filter((student) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      student.name?.toLowerCase().includes(searchLower) ||
      student.studentCode?.toLowerCase().includes(searchLower) ||
      student.classId?.className?.toLowerCase().includes(searchLower)
    );
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Danh sách học sinh</h1>
          <p className="text-muted-foreground">Xem thông tin học sinh trong trường</p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên, mã học sinh, lớp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      <Card>
        <CardHeader>
          <CardTitle>Tổng số: {filteredStudents.length} học sinh</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Đang tải...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có học sinh nào
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((student) => (
                <div
                  key={student._id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <School className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{student.name}</h3>
                        <Badge variant="outline">{student.studentCode}</Badge>
                        {student.classId && (
                          <Badge variant="secondary">
                            {student.classId.className}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {student.gender === "male" ? "Nam" : student.gender === "female" ? "Nữ" : "Khác"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`${prefix}/students/${student._id}`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Xem chi tiết
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}







