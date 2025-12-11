import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProgressBar } from "@/components/ui";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useSchoolYears } from "@/hooks";
import { getConductBlockStatisticsByClass } from "@/services/conductApi";
import { AlertCircle, School, Users, CheckCircle2, XCircle } from "lucide-react";

const COLUMNS = [
  { key: "className", label: "Lớp" },
  { key: "teacherName", label: "GVCN" },
  { key: "studentCount", label: "Sĩ số" },
  { key: "TOT", label: "Tốt" },
  { key: "KHA", label: "Khá" },
  { key: "TB", label: "TB" },
  { key: "YEU", label: "Yếu" },
  { key: "progress", label: "Tiến độ" },
  { key: "status", label: "Trạng thái" },
];

export default function ClassStatisticsPage() {
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const [classStats, setClassStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { schoolYears: allSchoolYears, currentYearData } = useSchoolYears();

  const getCurrentSemester = () => {
    const m = new Date().getMonth() + 1;
    if (m >= 8 && m <= 12) return "HK1";
    if (m >= 1 && m <= 5) return "HK2";
    return "CN";
  };

  // Set năm học mặc định
  useEffect(() => {
    if (currentYearData?.code && !year) {
      setYear(currentYearData.code);
    } else if (allSchoolYears.length > 0 && !year) {
      const active = allSchoolYears.find(y => y.isActive) || allSchoolYears[0];
      if (active) setYear(active.code);
    }
    if (!semester) {
      setSemester(getCurrentSemester());
    }
  }, [currentYearData, allSchoolYears, year, semester]);

  useEffect(() => {
    if (!year || !semester) return;
    const fetchStats = async () => {
      setLoading(true);
      try {
        const data = await getConductBlockStatisticsByClass({ year, semester });
        // Chuẩn hóa dữ liệu từng lớp
        const normalized = data.map(c => {
          const studentCount = c.studentCount || 0;
          const progressPercent = c.progressPercent || c.progress || 0;
          return {
            classId: c.classId || c._id || "",
            className: c.className || "",
            teacherName: c.teacherName || c.teacher || "Chưa có",
            studentCount,
            TOT: c.TOT || 0,
            KHA: c.KHA || 0,
            TB: c.TB || 0,
            YEU: c.YEU || 0,
            progress: progressPercent,
            progressText: `${progressPercent}%`,
            status: progressPercent === 100 ? "Đã hoàn thành" : "Chưa hoàn thành",
          };
        });
        setClassStats(normalized);
      } catch (err) {
        console.error(err);
        setClassStats([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [year, semester]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Thống kê hạnh kiểm theo lớp</h1>
        <p className="text-muted-foreground mt-1">
          Xem chi tiết hạnh kiểm học sinh theo từng lớp học
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <Label>Năm học</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {allSchoolYears.map(y => (
                    <SelectItem key={y.code} value={y.code}>
                      {y.name} {currentYearData?.code === y.code && "(Hiện tại)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Học kỳ</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn học kỳ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HK1">Học kỳ 1</SelectItem>
                  <SelectItem value="HK2">Học kỳ 2</SelectItem>
                  <SelectItem value="CN">Cả năm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5" />
            Danh sách lớp học ({classStats.length})
          </CardTitle>
          <CardDescription>
            Thống kê hạnh kiểm và tiến độ hoàn thành của từng lớp
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 text-destructive p-6">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {COLUMNS.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {classStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={COLUMNS.length} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <School className="h-12 w-12 text-muted-foreground" />
                          <p className="text-lg font-medium text-muted-foreground">Không có dữ liệu</p>
                          <p className="text-sm text-muted-foreground">
                            Vui lòng chọn năm học và học kỳ để xem thống kê
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : classStats.map(row => (
                    <TableRow key={row.classId}>
                      <TableCell className="font-medium">{row.className}</TableCell>
                      <TableCell>{row.teacherName}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{row.studentCount}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {row.TOT}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {row.KHA}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          {row.TB}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          {row.YEU}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <ProgressBar 
                            value={row.progress} 
                            max={100} 
                            className="flex-1"
                          />
                          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                            {row.progressText}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={row.status === "Đã hoàn thành" ? "default" : "secondary"}
                          className={
                            row.status === "Đã hoàn thành"
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                          }
                        >
                          {row.status === "Đã hoàn thành" ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
