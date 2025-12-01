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
import gradeConfigApi from "@/services/gradeConfigApi";
import studentApi from "@/services/studentApi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Award, Clock, CheckCircle, XCircle, AlertCircle, UserCheck, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/services/axiosInstance";

/* =========================================================
   📘 COMPONENT
========================================================= */
const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { backendUser } = useAuth();

  const { data: student, isLoading: loadingStudent } = useStudent(id);
  const { data: grades = [], isLoading: loadingGrades } = useStudentGrades(id);

  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState<string>("");
  const [classificationConfig, setClassificationConfig] = useState<any>(null);
  const [yearDetail, setYearDetail] = useState<any>(null);
  const [loadingYearDetail, setLoadingYearDetail] = useState(false);
  const [availableYears, setAvailableYears] = useState<string[]>([]); // Danh sách năm học GVCN có thể xem

  // 🧩 Lấy niên khóa hiện tại và danh sách năm học GVCN có thể xem
  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const settings = await settingApi.getSettings();
        const currentYearValue = settings?.currentSchoolYear || "";
        setCurrentYear(currentYearValue);

        // ✅ Nếu là GVCN, lấy danh sách năm học mà họ đang làm chủ nhiệm
        const pathname = window.location.pathname;
        if (pathname.startsWith('/gvcn/')) {
          try {
            const res = await api.get('/class/homeroom/classes');
            console.log('📋 Response từ /class/homeroom/classes:', res.data);
            if (res.data.success && res.data.data && Array.isArray(res.data.data)) {
              const years = res.data.data
                .map((item: any) => item.schoolYear || item.year)
                .filter(Boolean);
              const uniqueYears = Array.from(new Set(years)).sort().reverse();
              console.log('📅 Danh sách năm học GVCN:', uniqueYears);
              setAvailableYears(uniqueYears);

              // Nếu năm hiện tại có trong danh sách, chọn nó
              if (uniqueYears.includes(currentYearValue)) {
                setSelectedYear(currentYearValue);
              } else if (uniqueYears.length > 0) {
                // Nếu không, chọn năm đầu tiên trong danh sách
                setSelectedYear(uniqueYears[0]);
              }
            } else {
              console.warn('⚠️ Không có dữ liệu lớp chủ nhiệm:', res.data);
              setAvailableYears([]);
            }
          } catch (err: any) {
            console.error("❌ Lỗi lấy danh sách lớp chủ nhiệm:", err);
            console.error("❌ Error details:", err.response?.data);
            setAvailableYears([]);
          }
        } else {
          // ✅ Admin/BGH: Có thể xem tất cả niên khóa
          setAvailableYears([]); // Không giới hạn, sẽ lấy tất cả từ groupedGrades
        }
      } catch (err) {
        console.error("Lỗi lấy niên khóa hiện tại:", err);
      }
    };
    fetchSetting();
  }, [backendUser]);

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

  // Mặc định chọn niên khóa hiện tại (chỉ khi không phải GVCN hoặc đã có availableYears)
  useEffect(() => {
    const pathname = window.location.pathname;
    // Nếu là GVCN và đã có availableYears, chỉ chọn nếu chưa có selectedYear
    if (pathname.startsWith('/gvcn/')) {
      if (availableYears.length > 0 && !selectedYear) {
        // Nếu năm hiện tại có trong danh sách, chọn nó
        if (currentYear && availableYears.includes(currentYear)) {
          setSelectedYear(currentYear);
        } else {
          // Nếu không, chọn năm đầu tiên trong danh sách
          setSelectedYear(availableYears[0]);
        }
      }
      return;
    }
    
    // Các role khác: chọn năm hiện tại hoặc năm đầu tiên có điểm
    if (currentYear && !selectedYear) {
      setSelectedYear(currentYear);
    } else if (!selectedYear && Object.keys(groupedGrades).length > 0) {
      const sorted = Object.keys(groupedGrades).sort().reverse();
      setSelectedYear(sorted[0]);
    }
  }, [groupedGrades, currentYear, selectedYear, availableYears]);

  // ✅ Lấy thông tin chi tiết theo niên khóa
  useEffect(() => {
    const fetchYearDetail = async () => {
      if (!id || !selectedYear) {
        setYearDetail(null);
        return;
      }
      try {
        setLoadingYearDetail(true);
        const res = await studentApi.getYearDetail(id, selectedYear);
        if (res.success) {
          setYearDetail(res.data);
        }
      } catch (error) {
        console.error("Lỗi lấy thông tin chi tiết niên khóa:", error);
        setYearDetail(null);
      } finally {
        setLoadingYearDetail(false);
      }
    };
    fetchYearDetail();
  }, [id, selectedYear]);

  // ✅ Lấy cấu hình xếp loại từ backend
  useEffect(() => {
    const fetchClassificationConfig = async () => {
      if (!selectedYear) return;
      try {
        // Lấy cấu hình từ học kỳ 2 (học kỳ cuối của năm học)
        const config = await gradeConfigApi.getConfig({ schoolYear: selectedYear, semester: '2' });
        if (config?.classification) {
          setClassificationConfig(config.classification);
        } else {
          // Dùng mặc định nếu không có cấu hình
          setClassificationConfig({
            excellent: { minAverage: 8.0, minSubjectScore: 6.5 },
            good: { minAverage: 6.5, minSubjectScore: 5.0 },
            average: { minAverage: 5.0 },
            weak: { maxAverage: 5.0 },
          });
        }
      } catch (err) {
        console.error('Lỗi lấy cấu hình xếp loại:', err);
        // Dùng mặc định nếu lỗi
        setClassificationConfig({
          excellent: { minAverage: 8.0, minSubjectScore: 6.5 },
          good: { minAverage: 6.5, minSubjectScore: 5.0 },
          average: { minAverage: 5.0 },
          weak: { maxAverage: 5.0 },
        });
      }
    };
    fetchClassificationConfig();
  }, [selectedYear]);

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

    // 🎓 Xếp loại học lực - sử dụng cấu hình từ backend
    const config = classificationConfig || {
      excellent: { minAverage: 8.0, minSubjectScore: 6.5 },
      good: { minAverage: 6.5, minSubjectScore: 5.0 },
      average: { minAverage: 5.0, minSubjectScore: 3.5 },
      weak: { maxAverage: 5.0, maxSubjectScore: 3.5 },
    };

    let rank = "—";
    
    // Kiểm tra Giỏi: Điểm TB năm ≥ minAverage và tất cả môn ≥ minSubjectScore
    if (avgYear >= (config.excellent?.minAverage || 8.0) && 
        allSubjects.every((s) => (s.average || 0) >= (config.excellent?.minSubjectScore || 6.5))) {
      rank = "Giỏi";
    } 
    // Kiểm tra Khá: Điểm TB năm ≥ minAverage và tất cả môn ≥ minSubjectScore
    else if (avgYear >= (config.good?.minAverage || 6.5) && 
             allSubjects.every((s) => (s.average || 0) >= (config.good?.minSubjectScore || 5.0))) {
      rank = "Khá";
    } 
    // Kiểm tra Trung bình: Điểm TB năm ≥ minAverage và tất cả môn > minSubjectScore
    else if (avgYear >= (config.average?.minAverage || 5.0) && 
             allSubjects.every((s) => (s.average || 0) > (config.average?.minSubjectScore || 3.5))) {
      rank = "Trung bình";
    } 
    // Kiểm tra Yếu: Điểm TB năm < maxAverage hoặc có môn < maxSubjectScore
    else if (avgYear < (config.weak?.maxAverage || 5.0) || 
             allSubjects.some((s) => (s.average || 0) < (config.weak?.maxSubjectScore || 3.5))) {
      rank = "Yếu";
    }

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
          <Button className="mt-4" onClick={() => {
            const pathname = window.location.pathname;
            if (pathname.startsWith('/gvcn/')) {
              navigate("/gvcn/homeroom-class");
            } else if (pathname.startsWith('/bgh/')) {
              navigate("/bgh/students");
            } else {
              navigate("/admin/students");
            }
          }}>
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
          <Button variant="ghost" onClick={() => {
            // Kiểm tra role để quay lại đúng trang
            const pathname = window.location.pathname;
            if (pathname.startsWith('/gvcn/')) {
              navigate("/gvcn/homeroom-class");
            } else if (pathname.startsWith('/bgh/')) {
              navigate("/bgh/students");
            } else {
              navigate("/admin/students");
            }
          }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{student.name}</h1>
            <p className="text-muted-foreground">Chi tiết học sinh • Năm học hiện tại: <b>{currentYear}</b></p>
          </div>
        </div>
        {!window.location.pathname.startsWith('/gvcn/') && (
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Chỉnh sửa
          </Button>
        )}
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

      {/* Chọn niên khóa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Chọn niên khóa để xem chi tiết
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Niên khóa:</label>
            <select
              className="border rounded px-3 py-2 text-sm min-w-[200px]"
              value={selectedYear || ""}
              onChange={(e) => setSelectedYear(e.target.value)}
              disabled={window.location.pathname.startsWith('/gvcn/') && availableYears.length === 0}
            >
              <option value="">-- Chọn niên khóa --</option>
              {(() => {
                // ✅ Nếu là GVCN, chỉ hiển thị các năm học mà họ đang làm chủ nhiệm
                const pathname = window.location.pathname;
                if (pathname.startsWith('/gvcn/')) {
                  if (availableYears.length > 0) {
                    return availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ));
                  } else {
                    // Nếu đang load hoặc chưa có dữ liệu, không hiển thị option nào
                    return null;
                  }
                }
                // ✅ Các role khác: hiển thị tất cả năm học có điểm
                return Object.keys(groupedGrades)
                  .sort()
                  .reverse()
                  .map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ));
              })()}
            </select>
            {window.location.pathname.startsWith('/gvcn/') && (
              <>
                {availableYears.length === 0 && (
                  <span className="text-sm text-muted-foreground">(Đang tải...)</span>
                )}
                {availableYears.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ({availableYears.length} niên khóa)
                  </span>
                )}
              </>
            )}

            {(window.location.pathname.startsWith('/admin/') || window.location.pathname.startsWith('/bgh/')) && (
              <span className="text-sm text-blue-600 font-medium">
                👨‍💼 Xem tất cả niên khóa
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Thông tin chi tiết theo niên khóa */}
      {selectedYear && (
        <>
          {loadingYearDetail ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">Đang tải thông tin chi tiết...</p>
              </CardContent>
            </Card>
          ) : yearDetail ? (
            <>
              {/* Thông tin lớp học theo năm */}
              {yearDetail.classInfo && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <School className="h-5 w-5" /> Thông tin lớp học năm {selectedYear}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Info label="Lớp học" value={yearDetail.classInfo.className} icon={School} />
                    <Info label="Khối lớp" value={`Khối ${yearDetail.classInfo.grade}`} icon={GraduationCap} />
                    <Info label="Năm học" value={selectedYear} icon={Calendar} />
                    {yearDetail.homeroomTeacher && (
                      <Info 
                        label="Giáo viên chủ nhiệm" 
                        value={`${yearDetail.homeroomTeacher.name}${yearDetail.homeroomTeacher.teacherCode ? ` (${yearDetail.homeroomTeacher.teacherCode})` : ''}`}
                        icon={Users}
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Bảng điểm chi tiết */}
              {yearDetail.grades && yearDetail.grades.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" /> Bảng điểm các môn học
                    </CardTitle>
                    <CardDescription>Điểm chi tiết theo từng học kỳ</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="hk1" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="hk1">Học kỳ 1</TabsTrigger>
                        <TabsTrigger value="hk2">Học kỳ 2</TabsTrigger>
                      </TabsList>
                      
                      {["hk1", "hk2"].map((hk) => {
                        const semester = hk === "hk1" ? "1" : "2";
                        const semesterData = yearDetail.grades.map((g: any) => ({
                          subject: g.subject,
                          data: hk === "hk1" ? g.hk1 : g.hk2
                        }));

                        return (
                          <TabsContent key={hk} value={hk} className="mt-4">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[50px]">STT</TableHead>
                                    <TableHead>Môn học</TableHead>
                                    <TableHead className="text-center">Hệ số 1<br/>(Miệng, 15 phút)</TableHead>
                                    <TableHead className="text-center">Hệ số 2<br/>(45 phút)</TableHead>
                                    <TableHead className="text-center">Giữa kỳ</TableHead>
                                    <TableHead className="text-center">Cuối kỳ</TableHead>
                                    <TableHead className="text-center">ĐTB môn</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {semesterData.map((item: any, idx: number) => {
                                    const formatScores = (scores: number[]) => {
                                      if (!scores || scores.length === 0) return "-";
                                      return scores.map(s => s.toFixed(1)).join(", ");
                                    };

                                    return (
                                      <TableRow key={item.subject._id}>
                                        <TableCell>{idx + 1}</TableCell>
                                        <TableCell className="font-medium">{item.subject.name}</TableCell>
                                        <TableCell className="text-center">
                                          <div className="space-y-1">
                                            {item.data.coefficient1.oral.length > 0 && (
                                              <div className="text-xs">Miệng: {formatScores(item.data.coefficient1.oral)}</div>
                                            )}
                                            {item.data.coefficient1.quiz15.length > 0 && (
                                              <div className="text-xs">15': {formatScores(item.data.coefficient1.quiz15)}</div>
                                            )}
                                            {item.data.coefficient1.oral.length === 0 && item.data.coefficient1.quiz15.length === 0 && "-"}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {formatScores(item.data.coefficient2.quiz45)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {formatScores(item.data.midterm)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {formatScores(item.data.final)}
                                        </TableCell>
                                        <TableCell className="text-center font-semibold">
                                          {item.data.average ? item.data.average.toFixed(1) : "-"}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </TabsContent>
                        );
                      })}
                    </Tabs>

                    {/* Điểm TB cả năm cho từng môn */}
                    <div className="mt-6 border-t pt-4">
                      <h3 className="font-semibold mb-3">Điểm trung bình cả năm</h3>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>STT</TableHead>
                              <TableHead>Môn học</TableHead>
                              <TableHead className="text-center">ĐTB HK1</TableHead>
                              <TableHead className="text-center">ĐTB HK2</TableHead>
                              <TableHead className="text-center">ĐTB cả năm</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {yearDetail.grades.map((g: any, idx: number) => (
                              <TableRow key={g.subject._id}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell className="font-medium">{g.subject.name}</TableCell>
                                <TableCell className="text-center">
                                  {g.hk1.average ? g.hk1.average.toFixed(1) : "-"}
                                </TableCell>
                                <TableCell className="text-center">
                                  {g.hk2.average ? g.hk2.average.toFixed(1) : "-"}
                                </TableCell>
                                <TableCell className="text-center font-semibold">
                                  {g.yearAverage || "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Học lực và Hạnh kiểm */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" /> Học lực
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Học kỳ 1:</span>
                      <Badge variant={yearDetail.academicLevel?.hk1 === "Giỏi" ? "default" : "secondary"}>
                        {yearDetail.academicLevel?.hk1 || "—"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Học kỳ 2:</span>
                      <Badge variant={yearDetail.academicLevel?.hk2 === "Giỏi" ? "default" : "secondary"}>
                        {yearDetail.academicLevel?.hk2 || "—"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center border-t pt-3">
                      <span className="text-sm font-medium">Cả năm:</span>
                      <Badge variant={yearDetail.academicLevel?.year === "Giỏi" ? "default" : "secondary"} className="text-base">
                        {yearDetail.academicLevel?.year || "—"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5" /> Hạnh kiểm
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Học kỳ 1:</span>
                      <Badge variant={yearDetail.conduct?.hk1 === "Tốt" ? "default" : "secondary"}>
                        {yearDetail.conduct?.hk1 || "—"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Học kỳ 2:</span>
                      <Badge variant={yearDetail.conduct?.hk2 === "Tốt" ? "default" : "secondary"}>
                        {yearDetail.conduct?.hk2 || "—"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center border-t pt-3">
                      <span className="text-sm font-medium">Cả năm:</span>
                      <Badge variant={yearDetail.conduct?.year === "Tốt" ? "default" : "secondary"} className="text-base">
                        {yearDetail.conduct?.year || "—"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Kết quả lên lớp */}
              {yearDetail.promotionResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" /> Kết quả cuối năm
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      {yearDetail.promotionResult === "Tốt nghiệp" && (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      )}
                      {yearDetail.promotionResult === "Lên lớp thẳng" && (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      )}
                      {yearDetail.promotionResult === "Lên lớp có điều kiện" && (
                        <AlertCircle className="h-6 w-6 text-yellow-600" />
                      )}
                      {(yearDetail.promotionResult === "Ở lại lớp" || yearDetail.promotionResult === "Không tốt nghiệp") && (
                        <XCircle className="h-6 w-6 text-red-600" />
                      )}
                      <span className="text-lg font-semibold">{yearDetail.promotionResult}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Thống kê chuyên cần */}
              {yearDetail.attendance && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" /> Thống kê chuyên cần
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Nghỉ có phép</p>
                        <p className="text-2xl font-bold">{yearDetail.attendance.excusedAbsent || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Nghỉ không phép</p>
                        <p className="text-2xl font-bold text-red-600">{yearDetail.attendance.unexcusedAbsent || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Đi học muộn</p>
                        <p className="text-2xl font-bold text-yellow-600">{yearDetail.attendance.totalLate || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Về sớm</p>
                        <p className="text-2xl font-bold text-orange-600">{yearDetail.attendance.earlyLeave || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Nhận xét của GVCN */}
              {(yearDetail.homeroomTeacherNotes?.hk1 || yearDetail.homeroomTeacherNotes?.hk2 || yearDetail.homeroomTeacherNotes?.year) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" /> Nhận xét của giáo viên chủ nhiệm
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {yearDetail.homeroomTeacherNotes?.hk1 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Học kỳ 1:</h4>
                        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{yearDetail.homeroomTeacherNotes.hk1}</p>
                      </div>
                    )}
                    {yearDetail.homeroomTeacherNotes?.hk2 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Học kỳ 2:</h4>
                        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{yearDetail.homeroomTeacherNotes.hk2}</p>
                      </div>
                    )}
                    {yearDetail.homeroomTeacherNotes?.year && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-sm mb-2">Cuối năm:</h4>
                        <p className="text-sm whitespace-pre-wrap">{yearDetail.homeroomTeacherNotes.year}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tổng kết chung */}
              {yearDetail.summary && (
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" /> Tổng kết chung năm {selectedYear}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Điểm trung bình chung</p>
                        <p className="text-3xl font-bold">{yearDetail.summary.overallGPA || "—"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Xếp loại chung</p>
                        <Badge variant="default" className="text-lg px-3 py-1">
                          {yearDetail.summary.overallRank || "—"}
                        </Badge>
                      </div>
                      {yearDetail.summary.title && (
                        <div>
                          <p className="text-sm text-muted-foreground">Danh hiệu</p>
                          <Badge variant="default" className="text-lg px-3 py-1 bg-yellow-500">
                            {yearDetail.summary.title}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">Không có dữ liệu cho niên khóa {selectedYear}</p>
              </CardContent>
            </Card>
          )}
        </>
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
