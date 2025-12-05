import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProgressBar } from "@/components/ui";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { schoolYearApi } from "@/services/schoolYearApi";
import { getConductBlockStatisticsByClass } from "@/services/conductApi";

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
  const [schoolYears, setSchoolYears] = useState([]);
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("HK1");
  const [classStats, setClassStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getCurrentSemester = () => {
    const m = new Date().getMonth() + 1;
    if (m >= 8 && m <= 12) return "HK1";
    if (m >= 1 && m <= 5) return "HK2";
    return "CN";
  };

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const years = await schoolYearApi.getAll();
        setSchoolYears(years);
        const active = years.find(y => y.isActive) || years[0];
        if (active) setYear(active.code);
        setSemester(getCurrentSemester());
      } catch (err) {
        console.error(err);
        setError("Không tải được danh sách năm học");
      }
    };
    fetchYears();
  }, []);

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
    <div>
      <h2 className="text-xl font-semibold mb-4">Danh sách lớp học</h2>

      <div className="flex gap-4 mb-4">
        <div className="w-48">
          <label className="text-sm font-semibold mb-1 block">Năm học</label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn năm học" />
            </SelectTrigger>
            <SelectContent>
              {schoolYears.map(y => (
                <SelectItem key={y.code} value={y.code}>{y.name || y.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <label className="text-sm font-semibold mb-1 block">Học kỳ</label>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn học kỳ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HK1">Học kỳ 1</SelectItem>
              <SelectItem value="HK2">Học kỳ 2</SelectItem>
              <SelectItem value="CN">Cuối năm</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && <p className="text-gray-600 italic">Đang tải...</p>}
      {error && <p className="text-red-500">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}
          </TableRow>
        </TableHeader>

        <TableBody>
          {classStats.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMNS.length} className="text-center py-4">
                Không có dữ liệu
              </TableCell>
            </TableRow>
          ) : classStats.map(row => (
            <TableRow key={row.classId}>
              <TableCell>{row.className}</TableCell>
              <TableCell>{row.teacherName}</TableCell>
              <TableCell>{row.studentCount}</TableCell>
              <TableCell>{row.TOT}</TableCell>
              <TableCell>{row.KHA}</TableCell>
              <TableCell>{row.TB}</TableCell>
              <TableCell>{row.YEU}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <ProgressBar value={row.progress} max={100} />
                  <span className="text-xs text-gray-600">{row.progressText}</span>
                </div>
              </TableCell>
              <TableCell>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    row.status === "Đã hoàn thành" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {row.status}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
