import { useEffect, useState } from "react";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { examApi } from "@/services/exams/examApi";
import { Loader2 } from "lucide-react";

export function ExamStatsDialog({ exam }: { exam: any }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const loadStats = async () => {
      const res = await examApi.getStats(exam._id);
      setStats(res);
    };
    loadStats();
  }, [exam]);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Thống kê kỳ thi: {exam.name}</DialogTitle>
      </DialogHeader>
      {!stats ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 p-4">
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-500">Tổng khối lớp</p>
            <p className="text-lg font-semibold">{stats.classes}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-500">Lịch thi</p>
            <p className="text-lg font-semibold">{stats.schedules}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-500">Phòng thi</p>
            <p className="text-lg font-semibold">{stats.rooms}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-500">Điểm thi</p>
            <p className="text-lg font-semibold">{stats.grades}</p>
          </div>
        </div>
      )}
    </DialogContent>
  );
}
