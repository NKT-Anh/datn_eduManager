import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock } from "lucide-react";
import { getScheduleConfig, saveScheduleConfig } from "@/services/scheduleConfigApi";
import { subjectApi } from "@/services/subjectApi";
import { Subject } from "@/types/class";
import { useToast } from "@/components/ui/use-toast";
import { ScheduleConfig } from "@/types/schedule";

// --- Zod schema đồng bộ backend ---
const dayScheduleSchema = z.object({
  totalPeriods: z.number().min(0),
  morningPeriods: z.number().min(0),
  afternoonPeriods: z.number().min(0),
});

const configSchema = z.object({
  defaultStartTimeMorning: z.string().default("07:00"),
  defaultStartTimeAfternoon: z.string().default("13:00"),
  minutesPerPeriod: z.number().min(30).max(60),
  defaultBreakMinutes: z.number().min(5).max(30),
  recessBreakMinutes: z.number().min(10).max(60),
  breaksBetweenPeriods: z.record(z.number()).optional(),
  days: z.record(dayScheduleSchema),
  subjectHours: z.record(z.number()).optional(),
  specialSubjects: z.array(z.string()).optional(),
});
function generatePeriodTimes(
  startTime: string,
  periods: number,
  minutesPerPeriod: number,
  breaks: number[] // breaks[i] = nghỉ sau tiết i
) {
  const times: string[] = [];
  let [hour, minute] = startTime.split(":").map(Number);

  for (let i = 0; i < periods; i++) {
    const start = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    minute += minutesPerPeriod;
    hour += Math.floor(minute / 60);
    minute %= 60;
    const end = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    times.push(`${start} - ${end}`);

    // thêm nghỉ giữa tiết
    minute += breaks[i] || 0;
    hour += Math.floor(minute / 60);
    minute %= 60;
  }

  return times;
}

type FormData = z.infer<typeof configSchema>;

const weekdays = [
  { key: "2", label: "Thứ 2" },
  { key: "3", label: "Thứ 3" },
  { key: "4", label: "Thứ 4" },
  { key: "5", label: "Thứ 5" },
  { key: "6", label: "Thứ 6" },
  { key: "7", label: "Thứ 7" },
];
function generateCustomPeriodTimes(
  startTime: string,
  totalPeriods: number,
  minutesPerPeriod: number,
  defaultBreakMinutes: number,
  specialBreaks: Record<number, number> = {} // {2: 25} = nghỉ 25p sau tiết 2
) {
  const times: string[] = [];
  let [hour, minute] = startTime.split(":").map(Number);

  for (let i = 1; i <= totalPeriods; i++) {
    const startHour = hour;
    const startMinute = minute;

    // kết thúc tiết
    let endMinute = startMinute + minutesPerPeriod;
    let endHour = startHour + Math.floor(endMinute / 60);
    endMinute %= 60;

    times.push(
      `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")} - ` +
      `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`
    );

    // cộng thời gian nghỉ: ưu tiên specialBreaks
    const breakMinutes = specialBreaks[i] ?? defaultBreakMinutes;
    endMinute += breakMinutes;
    endHour += Math.floor(endMinute / 60);
    minute = endMinute % 60;
    hour = endHour;
  }

  return times;
}

interface ScheduleConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleConfigDialog({ open, onOpenChange }: ScheduleConfigDialogProps) {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [specialBreakMinutes, setSpecialBreakMinutes] = useState(25); // mặc định 25 phút
  const [specialPeriods, setSpecialPeriods] = useState<number[]>([]); // ví dụ [2, 3]

  

  const form = useForm<FormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      defaultStartTimeMorning: "07:00",
      defaultStartTimeAfternoon: "13:00",
      minutesPerPeriod: 45,
      defaultBreakMinutes: 5,
      recessBreakMinutes: 20,
      breaksBetweenPeriods: {},
      days: {
        "2": { totalPeriods: 9, morningPeriods: 5, afternoonPeriods: 4 },
        "3": { totalPeriods: 7, morningPeriods: 4, afternoonPeriods: 3 },
        "4": { totalPeriods: 7, morningPeriods: 4, afternoonPeriods: 3 },
        "5": { totalPeriods: 7, morningPeriods: 4, afternoonPeriods: 3 },
        "6": { totalPeriods: 5, morningPeriods: 3, afternoonPeriods: 2 },
        "7": { totalPeriods: 0, morningPeriods: 0, afternoonPeriods: 0 },
      },
      subjectHours: {},
      specialSubjects: [],
    },
  });

  // ✅ Load config + subjects khi mở
  useEffect(() => {
    if (open) {
      Promise.all([getScheduleConfig(), subjectApi.getSubjects()])
        .then(([config, subj]) => {
            if (config) form.reset(config); // reset form với dữ liệu thực tế
          setSubjects(subj);
        })
        .catch(() =>
          toast({
            title: "Lỗi",
            description: "Không thể tải cấu hình hoặc danh sách môn học",
            variant: "destructive",
          })
        );
    }
  }, [open]);

  const handleSubmit = async (data: FormData) => {
    try {
      await saveScheduleConfig(data as ScheduleConfig);
      toast({ title: "Thành công", description: "Cấu hình đã được lưu." });
      onOpenChange(false);
    } catch {
      toast({ title: "Lỗi", description: "Không thể lưu cấu hình", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-primary" />
            <span>Cấu hình thời khóa biểu</span>
          </DialogTitle>
          <DialogDescription>Thiết lập cấu hình lịch học, số tiết, và môn học đặc thù.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">Cấu hình chung</TabsTrigger>
                <TabsTrigger value="days">Lịch từng ngày</TabsTrigger>
                <TabsTrigger value="subjects">Số tiết / tuần</TabsTrigger>
              </TabsList>

              {/* TAB CHUNG */}
              <TabsContent value="general" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="minutesPerPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thời gian 1 tiết học (phút)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultBreakMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thời gian nghỉ giữa tiết (phút)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recessBreakMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Giờ ra choiw (phút)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>
              <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Ngắt giữa các tiết đặc biệt</CardTitle>
                    <CardDescription>Chọn 2 tiết và nhập số phút nghỉ giữa chúng</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 items-end">
                    <FormItem>
                    <FormLabel>Số phút nghỉ đặc biệt</FormLabel>
                    <FormControl>
                        <Input
                        type="number"
                        value={specialBreakMinutes}
                        onChange={(e) => setSpecialBreakMinutes(Number(e.target.value) || 0)}
                        />
                    </FormControl>
                    </FormItem>

                    <FormItem>
                    <FormLabel>Chọn 2 tiết</FormLabel>
                    <FormControl>
                        <div className="flex space-x-2">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((period) => (
                            <Checkbox
                            key={period}
                            checked={specialPeriods.includes(period)}
                            onCheckedChange={(checked) => {
                                const updated = checked
                                ? [...specialPeriods, period].slice(0, 2) // chỉ lấy tối đa 2 tiết
                                : specialPeriods.filter((p) => p !== period);
                                setSpecialPeriods(updated);
                            }}
                            >
                            {period}
                            </Checkbox>
                        ))}
                        </div>
                    </FormControl>
                    </FormItem>
                </CardContent>
                </Card>


              {/* TAB NGÀY */}
              <TabsContent value="days" className="space-y-4 mt-4">
                {weekdays.map((d) => {
                  const morning = form.watch(`days.${d.key}.morningPeriods`);
                  const afternoon = form.watch(`days.${d.key}.afternoonPeriods`);
                  return (
                    <Card key={d.key}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{d.label}</CardTitle>
                        <CardDescription>Tổng: {(morning || 0) + (afternoon || 0)} tiết</CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`days.${d.key}.morningPeriods`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Buổi sáng</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`days.${d.key}.afternoonPeriods`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Buổi chiều</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              {/* TAB SỐ TIẾT / TUẦN + MÔN HỌC ĐẶC THÙ */}
              <TabsContent value="subjects" className="space-y-6 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Số tiết mỗi tuần theo môn</CardTitle>
                    <CardDescription>Điền số tiết / tuần cho từng môn học</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {subjects.map((s) => (
                      <FormField
                        key={s._id}
                        control={form.control}
                        name={`subjectHours.${s._id}`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{s.name}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Môn học đặc thù học buổi chiều</CardTitle>
                    <CardDescription>Chọn các môn học đặc biệt (ví dụ: GDTC, QPAN)</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {subjects.map((s) => (
                      <FormField
                        key={s._id}
                        control={form.control}
                        name="specialSubjects"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <Checkbox
                              checked={field.value?.includes(s._id)}
                              onCheckedChange={(checked) => {
                                const updated = checked
                                  ? [...(field.value || []), s._id]
                                  : field.value?.filter((id) => id !== s._id);
                                field.onChange(updated);
                              }}
                            />
                            <FormLabel>{s.name}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit">Lưu cấu hình</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
