import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getConductBlockStatistics } from "@/services/conductApi";
import { schoolYearApi } from "@/services/schoolYearApi";
import { useSchoolYears } from "@/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, TrendingUp, Users, GraduationCap } from "lucide-react";

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
  const { schoolYears: allSchoolYears, currentYearData } = useSchoolYears();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ⭐ Xác định kỳ hiện tại
  const getCurrentSemester = () => {
    const m = new Date().getMonth() + 1;
    if (m >= 8 && m <= 12) return "HK1";
    if (m >= 1 && m <= 5) return "HK2";
    return "CN";
  };

  // ⭐ Set năm học mặc định
  useEffect(() => {
    if (currentYearData?.code && !year) {
      setYear(currentYearData.code);
    } else if (allSchoolYears.length > 0 && !year) {
      const active = allSchoolYears.find((y) => y.isActive) || allSchoolYears[0];
      if (active) setYear(active.code);
    }
    if (!semester) {
      setSemester(getCurrentSemester());
    }
  }, [currentYearData, allSchoolYears, year, semester]);

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

  // Màu sắc cho từng loại hạnh kiểm
  const getConductColor = (type: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      TOT: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
      KHA: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
      TB: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
      YEU: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    };
    return colorMap[type] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Thống kê hạnh kiểm theo khối</h1>
        <p className="text-muted-foreground mt-1">
          Xem tổng quan hạnh kiểm học sinh theo từng khối lớp
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
                  {allSchoolYears.map((y) => (
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

      {/* Statistics Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : blockStats.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Không có dữ liệu</p>
            <p className="text-sm text-muted-foreground mt-2">
              Vui lòng chọn năm học và học kỳ để xem thống kê
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {blockStats.map((block, idx) => {
            const totalConduct = block.stats.reduce((sum, s) => sum + s.count, 0);
            const completionRate = block.studentCount > 0 
              ? Math.round((totalConduct / block.studentCount) * 100) 
              : 0;

            return (
              <Card key={idx} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-primary" />
                      Khối {block.grade}
                    </CardTitle>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{block.studentCount}</span>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      {block.classCount} lớp
                    </span>
                    <span className={`text-sm font-medium ${
                      completionRate === 100 ? "text-green-600" : 
                      completionRate >= 80 ? "text-yellow-600" : 
                      "text-red-600"
                    }`}>
                      Hoàn thành: {completionRate}%
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {block.stats.map((item) => {
                    const colors = getConductColor(item.type);
                    return (
                      <div key={item.type} className="space-y-1">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className={`font-medium ${colors.text}`}>{item.label}</span>
                          <span className={`font-semibold ${colors.text}`}>
                            {item.count} ({item.percent}%)
                          </span>
                        </div>
                        <div className="relative">
                          <ProgressBar
                            value={item.count}
                            max={block.studentCount}
                            className="h-2"
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
