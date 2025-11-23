import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDepartmentManagement } from "@/hooks/departments/useDepartmentManagement";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolYears } from "@/hooks/schoolYear/useSchoolYears";
import { 
  Users, 
  BookOpen, 
  ClipboardList, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

export default function DepartmentManagementDashboard() {
  const { backendUser } = useAuth();
  const navigate = useNavigate();
  const { dashboard, loading, fetchDashboard } = useDepartmentManagement();
  const { schoolYears, currentYear } = useSchoolYears();
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<"1" | "2">("1");

  // Lấy năm học hiện tại từ SchoolYear có isActive: true
  useEffect(() => {
    if (currentYear && !selectedYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, selectedYear]);

  useEffect(() => {
    if (selectedYear) {
      fetchDashboard({ year: selectedYear, semester: selectedSemester });
    }
  }, [selectedYear, selectedSemester, fetchDashboard]);

  if (!backendUser?.teacherFlags?.isDepartmentHead) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Bạn không có quyền truy cập trang này</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Quản lý Bộ Môn</h1>
          <p className="text-muted-foreground">
            Tổng quan về tổ bộ môn {dashboard?.department.name || ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Chọn năm học" />
            </SelectTrigger>
            <SelectContent>
              {schoolYears
                .filter((year) => year.name && year.name.trim() !== "")
                .map((year) => (
                  <SelectItem key={year._id} value={year.name}>
                    {year.name} {year.isActive && "(Hiện tại)"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={selectedSemester} onValueChange={(v) => setSelectedSemester(v as "1" | "2")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Học kỳ 1</SelectItem>
              <SelectItem value="2">Học kỳ 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : dashboard ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tổng giáo viên
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">{dashboard.stats.teachers.total}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dashboard.stats.teachers.homeroom} GVCN, {dashboard.stats.teachers.regular} GVBM
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Môn học
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">{dashboard.stats.subjects.total}</p>
                    <p className="text-xs text-muted-foreground mt-1">Môn trong tổ</p>
                  </div>
                  <BookOpen className="h-8 w-8 text-success" />
                </div>
              </CardContent>
            </Card>

            {dashboard.stats.assignments && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Phân công
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold">{dashboard.stats.assignments.totalAssignments}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dashboard.stats.assignments.uniqueClasses} lớp, {dashboard.stats.assignments.uniqueTeachers} GV
                      </p>
                    </div>
                    <ClipboardList className="h-8 w-8 text-warning" />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Đề xuất phân công
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">
                      {dashboard.stats.proposals.pending + dashboard.stats.proposals.approved}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dashboard.stats.proposals.pending} chờ duyệt, {dashboard.stats.proposals.approved} đã duyệt
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-info" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Proposal Status */}
          <Card>
            <CardHeader>
              <CardTitle>Trạng thái đề xuất phân công</CardTitle>
              <CardDescription>Thống kê các đề xuất phân công của tổ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-2xl font-bold">{dashboard.stats.proposals.pending}</p>
                    <p className="text-xs text-muted-foreground">Chờ duyệt</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{dashboard.stats.proposals.approved}</p>
                    <p className="text-xs text-muted-foreground">Đã duyệt</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{dashboard.stats.proposals.applied}</p>
                    <p className="text-xs text-muted-foreground">Đã áp dụng</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold">{dashboard.stats.proposals.rejected}</p>
                    <p className="text-xs text-muted-foreground">Bị từ chối</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto py-4"
              onClick={() => navigate("/qlbm/teachers")}
            >
              <Users className="h-5 w-5 mr-2" />
              <div className="text-left">
                <p className="font-semibold">Quản lý giáo viên</p>
                <p className="text-xs text-muted-foreground">Xem và quản lý giáo viên trong tổ</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4"
              onClick={() => navigate("/qlbm/proposals")}
            >
              <ClipboardList className="h-5 w-5 mr-2" />
              <div className="text-left">
                <p className="font-semibold">Đề xuất phân công</p>
                <p className="text-xs text-muted-foreground">Tạo và quản lý đề xuất phân công</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4"
              onClick={() => navigate("/qlbm/teaching-assignments")}
            >
              <BookOpen className="h-5 w-5 mr-2" />
              <div className="text-left">
                <p className="font-semibold">Phân công giảng dạy</p>
                <p className="text-xs text-muted-foreground">Xem phân công hiện tại</p>
              </div>
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Không có dữ liệu</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

