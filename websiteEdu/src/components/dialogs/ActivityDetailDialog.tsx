import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Activity } from "@/types/class";
import { ActivitySlot } from "@/types/schedule";
import { activityApi } from "@/services/activityApi";
import { getScheduleConfig } from "@/services/scheduleConfigApi";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Loader2 } from "lucide-react";

const WEEKDAYS: Record<string, string> = {
  Monday: "Thứ 2",
  Tuesday: "Thứ 3",
  Wednesday: "Thứ 4",
  Thursday: "Thứ 5",
  Friday: "Thứ 6",
  Saturday: "Thứ 7",
  Sunday: "Chủ nhật",
};

interface ActivityDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId?: string;
}

export const ActivityDetailDialog = ({
  open,
  onOpenChange,
  activityId,
}: ActivityDetailDialogProps) => {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!activityId || !open) return;

      setLoading(true);
      try {
        // ✅ Load activity data
        const activityData = await activityApi.getById(activityId);
        setActivity(activityData);

        // ✅ Load schedule config để lấy thông tin cấu hình
        const config = await getScheduleConfig();
        setScheduleConfig(config);
      } catch (error) {
        console.error("Error loading activity detail:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activityId, open]);

  // ✅ Tìm các cấu hình hoạt động từ ScheduleConfig
  const activityConfigs: ActivitySlot[] = scheduleConfig?.activities?.filter(
    (slot: ActivitySlot) =>
      typeof slot.activityId === "string"
        ? slot.activityId === activityId
        : (slot.activityId as any)?._id === activityId ||
          (slot.activityId as any)?.toString() === activityId
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Chi tiết hoạt động</DialogTitle>
          <DialogDescription>
            Thông tin chi tiết và cấu hình thời khóa biểu
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Đang tải...</span>
            </div>
          ) : activity ? (
            <div className="space-y-4">
              {/* ✅ Thông tin cơ bản */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{activity.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activity.code && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Mã hoạt động:
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {activity.code}
                      </Badge>
                    </div>
                  )}

                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Loại:
                    </span>
                    <Badge
                      variant={activity.type === "weekly" ? "default" : "secondary"}
                      className="ml-2"
                    >
                      {activity.type === "weekly"
                        ? "Hàng tuần"
                        : "Đặc biệt"}
                    </Badge>
                  </div>

                  {activity.description && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Mô tả:
                      </span>
                      <p className="text-sm mt-1">{activity.description}</p>
                    </div>
                  )}

                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Khối áp dụng:
                    </span>
                    <div className="flex gap-2 mt-1">
                      {activity.grades && activity.grades.length > 0 ? (
                        activity.grades.map((grade) => (
                          <Badge key={grade} variant="secondary">
                            Khối {grade}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Chưa cấu hình
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Trạng thái:
                    </span>
                    <Badge
                      variant={activity.isActive ? "default" : "secondary"}
                      className="ml-2"
                    >
                      {activity.isActive ? "Đang hoạt động" : "Tạm ngưng"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* ✅ Cấu hình thời khóa biểu */}
              {activityConfigs.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Cấu hình thời khóa biểu
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* ✅ Hiển thị theo từng khối */}
                    {(["10", "11", "12"] as const).map((grade) => {
                      // Tìm config cho khối này
                      const config = activityConfigs[0]; // Lấy config đầu tiên (có thể có nhiều config)
                      if (!config) return null;

                      const periodsPerWeek =
                        typeof config.periodsPerWeek === "object" &&
                        !Array.isArray(config.periodsPerWeek)
                          ? config.periodsPerWeek
                          : { "10": 0, "11": 0, "12": 0 };

                      const gradeConfig = config.gradeConfigs?.[grade];
                      const periods = periodsPerWeek[grade] || 0;

                      // Chỉ hiển thị nếu có cấu hình cho khối này
                      if (!gradeConfig && periods === 0) return null;

                      return (
                        <div key={grade} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-base">Khối {grade}</h4>
                            <Badge variant="outline">
                              {config.session === "main" ? "Buổi chính" : "Buổi phụ"}
                            </Badge>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-3">
                            {/* Số tiết/tuần */}
                            <div>
                              <span className="text-xs font-medium text-muted-foreground block mb-1">
                                Số tiết/tuần:
                              </span>
                              <Badge variant="secondary" className="text-sm">
                                {periods} tiết
                              </Badge>
                            </div>

                            {/* Ngày trong tuần */}
                            {gradeConfig?.dayOfWeek && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground block mb-1">
                                  Ngày trong tuần:
                                </span>
                                <Badge variant="outline" className="text-sm">
                                  {WEEKDAYS[gradeConfig.dayOfWeek] || gradeConfig.dayOfWeek}
                                </Badge>
                              </div>
                            )}

                            {/* Tiết học / Khung giờ */}
                            {gradeConfig?.timeSlot && (
                              <div className="col-span-2">
                                <span className="text-xs font-medium text-muted-foreground block mb-1">
                                  Tiết học / Khung giờ:
                                </span>
                                <Badge variant="outline" className="text-sm">
                                  {gradeConfig.timeSlot}
                                </Badge>
                              </div>
                            )}
                          </div>

                          {/* Fixed Slots cho khối này (nếu có) */}
                          {config.fixedSlots &&
                            config.fixedSlots.length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground block mb-1">
                                  Slot cố định:
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {config.fixedSlots.map((slot, slotIdx) => (
                                    <Badge key={slotIdx} variant="outline" className="text-xs">
                                      {WEEKDAYS[slot.day] || slot.day} - Tiết{" "}
                                      {slot.periods.join(", ")}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      );
                    })}

                    {/* Thời gian áp dụng (chung cho tất cả khối) */}
                    {activityConfigs[0] && (
                      <div className="pt-2 border-t">
                        <span className="text-sm font-medium text-muted-foreground">
                          Thời gian áp dụng:
                        </span>
                        {activityConfigs[0].isPermanent ? (
                          <Badge variant="default" className="ml-2">
                            Vĩnh viễn
                          </Badge>
                        ) : (
                          <div className="mt-1 space-y-1">
                            {activityConfigs[0].startDate && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Từ:</span>{" "}
                                {format(
                                  new Date(activityConfigs[0].startDate),
                                  "dd/MM/yyyy",
                                  { locale: vi }
                                )}
                              </div>
                            )}
                            {activityConfigs[0].endDate && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Đến:</span>{" "}
                                {format(
                                  new Date(activityConfigs[0].endDate),
                                  "dd/MM/yyyy",
                                  { locale: vi }
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Chưa có cấu hình thời khóa biểu cho hoạt động này.
                      <br />
                      Vui lòng cấu hình trong{" "}
                      <span className="font-medium">Cấu hình thời khóa biểu</span>
                      .
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Không tìm thấy thông tin hoạt động
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

