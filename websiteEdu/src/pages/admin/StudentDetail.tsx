import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  Calendar,
  MapPin,
  User,
  BookOpen,
  Users,
  GraduationCap,
  School,
  Hash,
  IdCard,
  Globe,
  Home,
  FileText,
} from "lucide-react";
import { useStudent } from "@/hooks/auth/useStudents";
import { useStudentGrades } from "@/hooks/grades/useStudentGrades";
import settingApi from "@/services/settingApi";

/* =========================================================
   📘 COMPONENT
========================================================= */
const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: student, isLoading: loadingStudent } = useStudent(id);
  const { data: grades = [], isLoading: loadingGrades } = useStudentGrades(id);

  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState<string>("");

  // 🧩 Lấy niên khóa hiện tại
  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const settings = await settingApi.getSettings();
        setCurrentYear(settings?.currentSchoolYear || "");
      } catch (err) {
        console.error("Lỗi lấy niên khóa hiện tại:", err);
      }
    };
    fetchSetting();
  }, []);

  // 📘 Gom điểm theo niên khóa
  const groupedGrades = useMemo(() => {
    if (!grades || grades.length === 0) return {};
    return grades.reduce((acc: any, g: any) => {
      const year = g.schoolYear || "Khác";
      if (!acc[year]) acc[year] = [];
      acc[year].push(g);
      return acc;
    }, {});
  }, [grades]);

  // Mặc định chọn niên khóa hiện tại
  useEffect(() => {
    if (currentYear) setSelectedYear(currentYear);
    else if (!selectedYear && Object.keys(groupedGrades).length > 0) {
      const sorted = Object.keys(groupedGrades).sort().reverse();
      setSelectedYear(sorted[0]);
    }
  }, [groupedGrades, currentYear, selectedYear]);

  // 🔢 Hàm tính điểm TB năm & xếp loại
const calcYearSummary = (gradesForYear: any[]) => {
  const allSubjects = gradesForYear.filter((g) => g.subject?.includeInAverage);
  if (allSubjects.length === 0) return { avgYear: "-", rank: "—" };

  const avg1 =
    allSubjects
      .filter((g) => g.semester === "1")
      .reduce((sum, g) => sum + (g.average || 0), 0) /
    Math.max(1, allSubjects.filter((g) => g.semester === "1").length);

  const avg2 =
    allSubjects
      .filter((g) => g.semester === "2")
      .reduce((sum, g) => sum + (g.average || 0), 0) /
    Math.max(1, allSubjects.filter((g) => g.semester === "2").length);

  // ✅ Ép kiểu số để tránh lỗi TypeScript
  const rawAvgYear = (avg1 + avg2 * 2) / 3;
  const avgYear = parseFloat(rawAvgYear.toFixed(1)); // number

  // 🎓 Xếp loại học lực
  const rank =
    avgYear >= 8 && allSubjects.every((s) => s.average >= 6.5)
      ? "Giỏi"
      : avgYear >= 6.5 && allSubjects.every((s) => s.average >= 5)
      ? "Khá"
      : avgYear >= 5
      ? "Trung bình"
      : "Yếu";

  return { avgYear, rank };
};


  if (loadingStudent) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Đang tải thông tin học sinh...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Không tìm thấy học sinh</h2>
          <p className="text-muted-foreground mt-2">Học sinh này không tồn tại trong hệ thống.</p>
          <Button className="mt-4" onClick={() => navigate("/admin/students")}>
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  }

  /* =========================================================
     🧱 UI
  ========================================================== */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate("/admin/students")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{student.name}</h1>
            <p className="text-muted-foreground">Chi tiết học sinh • Năm học hiện tại: <b>{currentYear}</b></p>
          </div>
        </div>
        <Button>
          <Edit className="h-4 w-4 mr-2" />
          Chỉnh sửa
        </Button>
      </div>

      {/* Thông tin cá nhân */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Thông tin cá nhân
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Info label="Họ và tên" value={student.name} icon={User} />
          <Info label="Mã học sinh" value={student.studentCode} icon={Hash} />
          <Info label="Giới tính" value={student.gender === "male" ? "Nam" : student.gender === "female" ? "Nữ" : "Khác"} />
          <Info label="Ngày sinh" value={student.dob ? new Date(student.dob).toLocaleDateString("vi-VN") : "—"} icon={Calendar} />
          <Info label="Số điện thoại" value={student.phone} icon={Phone} />
          <Info label="Địa chỉ" value={student.address} icon={MapPin} />
          <Info label="Khối" value={`Khối ${student.grade}`} icon={GraduationCap} />
          <Info label="Lớp" value={(student.classId as any)?.className || "Chưa xếp lớp"} icon={School} />
          <Info label="Dân tộc" value={student.ethnic} icon={Globe} />
          <Info label="Tôn giáo" value={student.religion} icon={Globe} />
          <Info label="Quê quán" value={student.hometown} icon={Home} />
          <Info label="Nơi sinh" value={student.birthPlace} icon={Home} />
          <Info label="Số CCCD" value={student.idNumber} icon={IdCard} />
          <Info label="Ghi chú" value={student.note} icon={FileText} />
        </CardContent>
      </Card>

      {/* Bảng điểm chi tiết */}
      {grades.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Bảng điểm theo niên khóa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingGrades ? (
              <p className="text-muted-foreground">Đang tải điểm...</p>
            ) : (
              <>
                {/* 🔹 Chọn niên khóa */}
                <div className="flex items-center gap-2 mb-4">
                  <label className="text-sm text-muted-foreground">Chọn niên khóa:</label>
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={selectedYear || ""}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    {Object.keys(groupedGrades)
                      .sort()
                      .reverse()
                      .map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                  </select>
                </div>

                {selectedYear && groupedGrades[selectedYear] ? (
                  <>
                    {["1", "2"].map((sem) => {
                      const semesterGrades = groupedGrades[selectedYear].filter((g: any) => g.semester === sem);
                      if (semesterGrades.length === 0) return null;
                      return (
                        <div key={sem} className="mb-6">
                          <h3 className="font-semibold text-lg mb-2">Học kỳ {sem}</h3>
                          <div className="overflow-x-auto border rounded-lg">
                            <table className="min-w-full text-sm">
                              <thead className="bg-muted/40">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium">Môn học</th>
                                  <th className="px-3 py-2 text-left font-medium">Điểm TB</th>
                                  <th className="px-3 py-2 text-left font-medium">Xếp loại</th>
                                </tr>
                              </thead>
                              <tbody>
                                {semesterGrades.map((g: any) => (
                                  <tr key={g._id} className="border-t hover:bg-muted/20 transition">
                                    <td className="px-3 py-2">{g.subject?.name}</td>
                                    <td className="px-3 py-2">{g.average?.toFixed(1) || "-"}</td>
                                    <td className="px-3 py-2">{g.result || "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}

                    {/* 📊 Tổng kết năm */}
                    <div className="border-t pt-4 mt-4">
                      <h3 className="font-semibold mb-2">📊 Tổng kết năm {selectedYear}</h3>
                      {(() => {
                        const { avgYear, rank } = calcYearSummary(groupedGrades[selectedYear]);
                        const conduct = student.conduct?.[selectedYear] || "Chưa cập nhật";
                        return (
                          <div className="space-y-1">
                            <p>Điểm trung bình năm: <b>{avgYear}</b></p>
                            <p>Xếp loại học lực: <b>{rank}</b></p>
                            <p>Hạnh kiểm: <b>{conduct}</b></p>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Không có dữ liệu cho năm này.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/* =========================================================
   🔹 Component con hiển thị info
========================================================= */
const Info = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | number | JSX.Element | null;
  icon?: any;
}) => {
  if (!value) return null;
  return (
    <div>
      <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />} {label}
      </label>
      <p className="text-foreground">{value}</p>
    </div>
  );
};

export default StudentDetail;
