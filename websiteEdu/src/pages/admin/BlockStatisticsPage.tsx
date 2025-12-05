import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui";
import { getConductBlockStatistics } from "@/services/conductApi";
import { schoolYearApi } from "@/services/schoolYearApi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ================= TYPE =======================
type StatItem = {
  type: string;
  label: string;
  count: number;
  percent: number;
};

type BlockItem = {
  grade: number;
  classCount: number;
  studentCount: number;
  stats: StatItem[];
};

export default function BlockStatisticsPage() {
  const [blockStats, setBlockStats] = useState<BlockItem[]>([]);
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const [schoolYears, setSchoolYears] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ⭐ Xác định kỳ hiện tại
  const getCurrentSemester = () => {
    const m = new Date().getMonth() + 1;
    if (m >= 8 && m <= 12) return "HK1";
    if (m >= 1 && m <= 5) return "HK2";
    return "CN";
  };

  // ⭐ Load danh sách năm học
  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        const years = await schoolYearApi.getAll();
        setSchoolYears(years);

        const active = years.find((y) => y.isActive) || years[0];
        if (active) setYear(active.code);

        setSemester(getCurrentSemester());
      } catch (err) {
        setError("Không thể tải danh sách năm học");
      }
    };

    fetchSchoolYears();
  }, []);

  // ⭐ Load thống kê
  useEffect(() => {
    if (!year || !semester) return;

    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await getConductBlockStatistics({ year, semester });

        // API trả về { data: [...] }
        const raw = Array.isArray(res?.data) ? res.data : [];

        const converted: BlockItem[] = raw.map((b) => {
          const statsArr: StatItem[] = [
            { type: "TOT", label: "Tốt", count: b.stats?.TOT || 0, percent: 0 },
            { type: "KHA", label: "Khá", count: b.stats?.KHA || 0, percent: 0 },
            { type: "TB", label: "Trung bình", count: b.stats?.TB || 0, percent: 0 },
            { type: "YEU", label: "Yếu", count: b.stats?.YEU || 0, percent: 0 },
          ];

          statsArr.forEach((s) => {
            s.percent =
              b.studentCount > 0
                ? Math.round((s.count / b.studentCount) * 100)
                : 0;
          });

          return {
            grade: b.grade,
            classCount: b.classCount,
            studentCount: b.studentCount,
            stats: statsArr,
          };
        });

        setBlockStats(converted);
      } catch (err) {
        console.error(err);
        setBlockStats([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [year, semester]);

  return (
    <Card className="p-4">
      {/* ===== BỘ LỌC ===== */}
      <div className="flex gap-4 mb-6">
        {/* Năm học */}
        <div className="w-48">
          <label className="text-sm font-semibold mb-1 block">Năm học</label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn năm học" />
            </SelectTrigger>
            <SelectContent>
              {schoolYears.map((y) => (
                <SelectItem key={y.code} value={y.code}>
                  {y.name || y.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Học kỳ */}
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

      {/* ===== BODY ===== */}
      {loading && <p className="text-gray-600 italic">Đang tải...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && blockStats.length === 0 && !error && (
        <p className="text-gray-500 italic">Không có dữ liệu.</p>
      )}

      <div className="flex gap-4 overflow-x-auto">
        {blockStats.map((block, idx) => (
          <div
            key={idx}
            className="bg-white rounded-lg shadow p-6 min-w-[320px]"
          >
            <h3 className="text-lg font-bold mb-1">Khối {block.grade}</h3>
            <p className="text-sm text-gray-500 mb-3">
              {block.classCount} lớp – {block.studentCount} học sinh
            </p>

            {block.stats.map((item) => (
              <div key={item.type} className="flex items-center mb-2">
                <span className="w-20 text-sm">{item.label}</span>

                <ProgressBar
                  value={item.count}
                  max={block.studentCount}
                  className="flex-1 mx-2"
                />

                <span className="w-16 text-right text-sm">
                  {item.count} ({item.percent}%)
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
