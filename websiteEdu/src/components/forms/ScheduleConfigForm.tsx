import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  useForm,
  FormProvider,
  useFormContext,
  Controller,
  useFieldArray,
  useWatch,
} from "react-hook-form";
// Schema removed - not used
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, BookOpen, Activity as ActivityIcon, Clock, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "@/components/ui/sonner";
import { useScheduleConfig } from "@/hooks/schedule/useScheduleConfig";
import { useSubjects, useActivities } from "@/hooks";
import type { Subject, Activity } from "@/types/class";

const GRADES = ["10", "11", "12"] as const;
type Grade = typeof GRADES[number];

const WEEKDAYS = [
  { key: "Monday", label: "Thứ 2" },
  { key: "Tuesday", label: "Thứ 3" },
  { key: "Wednesday", label: "Thứ 4" },
  { key: "Thursday", label: "Thứ 5" },
  { key: "Friday", label: "Thứ 6" },
   { key: "Saturday", label: "Thứ 7" },
];

// Constants
const DEFAULT_SESSION_RULES = {
  "10": "morning",
  "11": "afternoon",
  "12": "both",
} as const;

const DatePicker = ({ name, label }: { name: string; label: string }) => {
  const { control, setValue, watch } = useFormContext();
  const value = watch(name);
  return (
    <div>
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(new Date(value), "dd/MM/yyyy", { locale: vi }) : "Chọn ngày"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={(d) => setValue(name, d ? d.toISOString().split("T")[0] : null)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

// ==================== SUBJECT CARD ====================
const SubjectCard = React.memo(({ subject, grade }: { subject: Subject; grade: Grade }) => {
  const { watch, setValue } = useFormContext<any>();
  const subjectId = subject._id;
  const basePath = `gradeConfigs.${grade}.subjects.${subjectId}`;
  const subjectData = watch(basePath) || {};
  const currentPeriodsPerWeek = typeof subjectData.periodsPerWeek === 'number' ? subjectData.periodsPerWeek : 0;
  const maxPeriodsPerDay = subjectData.maxPeriodsPerDay ?? 0; // ✅ Default 0
  const session = subjectData.session ?? "main";
  const allowConsecutive = subjectData.allowConsecutive ?? false; // ✅ Default false

  return (
    <Card className="p-4 space-y-3">
      <div className="font-semibold flex items-center gap-2">
        <BookOpen className="h-5 w-5" />
        {subject.name}
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <Label>Tiết/tuần</Label>
          <Input
            type="number"
            min={0}
            value={currentPeriodsPerWeek}
            onChange={(e) => {
              const newPeriods = Math.max(0, +e.target.value || 0); // ✅ Min 0, default 0
              const newMaxPerDay = newPeriods > 0 ? Math.ceil(newPeriods / 2) : 0; // ✅ Tự động = 1/2 periodsPerWeek
              setValue(basePath, {
                ...subjectData,
                periodsPerWeek: newPeriods,
                maxPeriodsPerDay: newMaxPerDay, // ✅ Tự động set realtime
              }, { shouldDirty: true });
            }}
          />
        </div>
        <div>
          <Label>Tối đa/buổi</Label>
          <Input
            type="number"
            min={0}
            max={currentPeriodsPerWeek > 0 ? currentPeriodsPerWeek : undefined} // ✅ Không được vượt quá Tiết/tuần (nếu > 0)
            value={maxPeriodsPerDay}
            onChange={(e) => {
              const newMax = Math.max(0, +e.target.value || 0); // ✅ Min 0
              // ✅ Đảm bảo không vượt quá periodsPerWeek (nếu periodsPerWeek > 0)
              const finalMax = currentPeriodsPerWeek > 0 
                ? Math.min(newMax, currentPeriodsPerWeek) 
                : newMax;
              setValue(basePath, {
                ...subjectData,
                maxPeriodsPerDay: finalMax,
              }, { shouldDirty: true });
            }}
          />
        </div>
      </div>
      <Select
        value={session}
        onValueChange={(v) => setValue(basePath, {
          ...subjectData,
          session: v as "main" | "extra",
        }, { shouldDirty: true })}
      >
        <SelectTrigger><SelectValue placeholder="Buổi học" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="main">Buổi chính</SelectItem>
          <SelectItem value="extra">Buổi phụ</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center space-x-2">
        <Checkbox
          checked={allowConsecutive} // ✅ Default false
          onCheckedChange={(c) => setValue(basePath, {
            ...subjectData,
            allowConsecutive: !!c,
          }, { shouldDirty: true })}
        />
        <Label className="text-sm cursor-pointer">Cho phép tiết liên tiếp</Label>
      </div>
    </Card>
  );
});

// ==================== ACTIVITY CARD ====================
const ActivityCard = React.memo(({ index, activity, grade }: { index: number; activity: Activity; grade: Grade }) => {
  const { control, watch, setValue } = useFormContext<any>();
  const { remove } = useFieldArray({ control, name: `gradeConfigs.${grade}.activities` });

  const DAYS_OF_WEEK = useMemo(() => [
    { value: "Monday", label: "Thứ 2" },
    { value: "Tuesday", label: "Thứ 3" },
    { value: "Wednesday", label: "Thứ 4" },
    { value: "Thursday", label: "Thứ 5" },
    { value: "Friday", label: "Thứ 6" },
    { value: "Saturday", label: "Thứ 7" },
  ], []);

  const basePath = `gradeConfigs.${grade}.activities.${index}`;
  const currentActivity = watch(basePath);
  const activityId = currentActivity?.activityId || activity._id;
  
  // ✅ Đảm bảo activityId luôn được set
  React.useEffect(() => {
    if (!currentActivity?.activityId && activity._id) {
      setValue(`${basePath}.activityId`, activity._id, { shouldDirty: false });
    }
  }, [currentActivity?.activityId, activity._id, basePath, setValue]);
  
  // ✅ Lấy gradeConfig từ gradeConfigs (nếu có) hoặc dùng default
  const currentPeriodsPerWeek = typeof currentActivity?.periodsPerWeek === 'number' ? currentActivity.periodsPerWeek : 0;
  const gradeConfig = watch(`${basePath}.gradeConfigs.${grade}`) || {
    maxPeriodsPerDay: 0, // ✅ Default 0
    allowConsecutive: false, // ✅ Default false
    session: "main",
  };
  const maxPeriodsPerDay = gradeConfig.maxPeriodsPerDay ?? 0; // ✅ Default 0

  return (
    <Card className="p-5 space-y-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 font-semibold">
          <ActivityIcon className="h-5 w-5 text-primary" />
          {activity.name}
        </div>
        <Button variant="destructive" size="sm" onClick={() => remove(index)}>Xóa</Button>
      </div>
      <Separator />
      
      {/* Số tiết / tuần cho khối hiện tại - Number, không phải Map */}
      <div>
        <Label className="font-semibold mb-2">Số tiết / tuần (Khối {grade})</Label>
              <Input
                type="number"
                min={0}
          value={currentPeriodsPerWeek}
          onChange={e => {
            const newPeriods = Math.max(0, +e.target.value || 0); // ✅ Min 0, default 0
            const newMaxPerDay = newPeriods > 0 ? Math.ceil(newPeriods / 2) : 0; // ✅ Tự động = 1/2 periodsPerWeek
            // ✅ Đảm bảo activityId luôn được giữ lại
            const currentAct = watch(basePath) || {};
            const currentGradeConfigs = currentAct.gradeConfigs || {};
            setValue(basePath, {
              ...currentAct,
              activityId: currentAct.activityId || activityId, // ✅ Giữ activityId
              periodsPerWeek: newPeriods,
              gradeConfigs: {
                ...currentGradeConfigs,
                [grade]: {
                  ...(currentGradeConfigs[grade] || {}),
                  maxPeriodsPerDay: newMaxPerDay, // ✅ Tự động set realtime
                },
              },
            }, { shouldDirty: true });
          }}
        />
      </div>

      {/* Buổi học */}
      <div>
        <Label className="font-semibold mb-2">Buổi học</Label>
        <Select
          value={gradeConfig.session ?? "main"}
          onValueChange={(v) => {
            const currentAct = watch(basePath) || {};
            const currentGradeConfigs = currentAct.gradeConfigs || {};
            setValue(basePath, {
              ...currentAct,
              activityId: currentAct.activityId || activityId, // ✅ Giữ activityId
              gradeConfigs: {
                ...currentGradeConfigs,
                [grade]: {
                  ...(currentGradeConfigs[grade] || {}),
                  session: v as "main" | "extra",
                },
              },
            }, { shouldDirty: true });
          }}
        >
              <SelectTrigger><SelectValue placeholder="Buổi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Buổi chính</SelectItem>
                <SelectItem value="extra">Buổi phụ</SelectItem>
              </SelectContent>
            </Select>
      </div>

      {/* Tối đa tiết/buổi và Cho phép liên tiếp */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm">Tối đa/buổi</Label>
          <Input
            type="number"
            min={0}
            max={currentPeriodsPerWeek > 0 ? currentPeriodsPerWeek : undefined} // ✅ Không được vượt quá Tiết/tuần (nếu > 0)
            value={maxPeriodsPerDay}
            onChange={(e) => {
              const newMax = Math.max(0, +e.target.value || 0); // ✅ Min 0
              // ✅ Đảm bảo không vượt quá periodsPerWeek (nếu periodsPerWeek > 0)
              const finalMax = currentPeriodsPerWeek > 0 
                ? Math.min(newMax, currentPeriodsPerWeek) 
                : newMax;
              const currentAct = watch(basePath) || {};
              const currentGradeConfigs = currentAct.gradeConfigs || {};
              setValue(basePath, {
                ...currentAct,
                activityId: currentAct.activityId || activityId, // ✅ Giữ activityId
                gradeConfigs: {
                  ...currentGradeConfigs,
                  [grade]: {
                    ...(currentGradeConfigs[grade] || {}),
                    maxPeriodsPerDay: finalMax,
                  },
                },
              }, { shouldDirty: true });
            }}
          />
        </div>
        <div className="flex items-center space-x-2 pt-6">
          <Checkbox
            checked={gradeConfig.allowConsecutive ?? false} // ✅ Default false
            onCheckedChange={(c) => {
              const currentAct = watch(basePath) || {};
              const currentGradeConfigs = currentAct.gradeConfigs || {};
              setValue(basePath, {
                ...currentAct,
                activityId: currentAct.activityId || activityId, // ✅ Giữ activityId
                gradeConfigs: {
                  ...currentGradeConfigs,
                  [grade]: {
                    ...(currentGradeConfigs[grade] || {}),
                    allowConsecutive: !!c,
                  },
                },
              }, { shouldDirty: true });
            }}
          />
          <Label className="text-sm cursor-pointer">Cho phép tiết liên tiếp</Label>
        </div>
      </div>

      {/* Hoạt động vĩnh viễn */}
      <div>
        <Controller
          name={`${basePath}.isPermanent`}
          control={control}
          render={({ field }) => (
            <div className="flex items-center space-x-2">
              <Checkbox checked={field.value ?? true} onCheckedChange={field.onChange} />
              <Label className="cursor-pointer">Hoạt động vĩnh viễn</Label>
            </div>
          )}
        />
      </div>

      {/* Ngày bắt đầu và kết thúc (chỉ khi không vĩnh viễn) */}
      {!watch(`${basePath}.isPermanent`) && (
        <div className="grid grid-cols-2 gap-4">
          <DatePicker name={`${basePath}.startDate`} label="Từ ngày" />
          <DatePicker name={`${basePath}.endDate`} label="Đến ngày" />
        </div>
      )}

      <Separator />

      {/* Cấu hình cố định cho khối này - Sử dụng fixedSlots */}
      <div>
        <Label className="font-semibold mb-3">Cấu hình cố định (Khối {grade})</Label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Ngày trong tuần */}
                  <div>
                    <Label className="text-sm">Ngày trong tuần</Label>
                    <Select
              value={currentActivity?.fixedSlots?.dayOfWeek || "none"}
                      onValueChange={(value) => {
                const currentAct = watch(basePath) || {};
                const newFixedSlots = value === "none" 
                  ? null 
                  : {
                      dayOfWeek: value,
                      period: currentAct.fixedSlots?.period || 1,
                    };
                setValue(basePath, {
                  ...currentAct,
                  activityId: currentAct.activityId || activityId, // ✅ Giữ activityId
                  fixedSlots: newFixedSlots,
                }, { shouldDirty: true });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn ngày" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Không chọn</SelectItem>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day.value} value={day.value}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

          {/* Tiết học */}
                  <div>
            <Label className="text-sm">Tiết học</Label>
                    <Input
              type="number"
              min={1}
              max={10}
              placeholder="VD: 1"
              value={currentActivity?.fixedSlots?.period || ""}
                      onChange={(e) => {
                const currentAct = watch(basePath) || {};
                const period = e.target.value ? Number(e.target.value) : undefined;
                const newFixedSlots = currentAct.fixedSlots?.dayOfWeek && period
                  ? {
                      dayOfWeek: currentAct.fixedSlots.dayOfWeek,
                      period: period,
                    }
                  : null;
                setValue(basePath, {
                  ...currentAct,
                  activityId: currentAct.activityId || activityId, // ✅ Giữ activityId
                  fixedSlots: newFixedSlots,
                }, { shouldDirty: true });
                      }}
                    />
                  </div>
        </div>
      </div>
    </Card>
  );
});

// ==================== MAIN FORM ====================
function ScheduleConfigForm() {
  // Sử dụng hooks thay vì gọi API trực tiếp
  const { scheduleConfig: configData } = useScheduleConfig();
  const { subjects = [] } = useSubjects();
  const { activities = [] } = useActivities();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedActId, setSelectedActId] = useState("");
  const [dialogGrade, setDialogGrade] = useState<"10" | "11" | "12">("10"); // ✅ Lưu khối khi mở dialog
  const [specialBreaksState, setSpecialBreaksState] = useState<
    { period: number; minutes: number; session: "morning" | "afternoon" }[]
  >([]);

  const form = useForm<any>({
    // Bỏ validation để có thể lưu được
    // resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      defaultStartTimeMorning: "07:00",
      defaultStartTimeAfternoon: "13:30",
      minutesPerPeriod: 45,
      defaultBreakMinutes: 5,
      days: WEEKDAYS.map(d => ({ ...d, morningPeriods: 5, afternoonPeriods: 5 })),
      gradeSessionRules: GRADES.map(grade => ({
        grade: grade as "10" | "11" | "12",
        session: DEFAULT_SESSION_RULES[grade as keyof typeof DEFAULT_SESSION_RULES],
      })),
      gradeConfigs: Object.fromEntries(
        GRADES.map(grade => [
          grade,
          {
            subjects: {},
      activities: [],
            rules: {
              grade: grade as "10" | "11" | "12",
              session: DEFAULT_SESSION_RULES[grade as keyof typeof DEFAULT_SESSION_RULES],
            },
          },
        ])
      ),
      currentGradeTab: "10",
    },
  });

  const { control, handleSubmit, reset, watch, setValue, formState } = form;
  
  // Field arrays cho từng khối
  const grade10Fields = useFieldArray({ control, name: "gradeConfigs.10.activities" });
  const grade11Fields = useFieldArray({ control, name: "gradeConfigs.11.activities" });
  const grade12Fields = useFieldArray({ control, name: "gradeConfigs.12.activities" });
  
  const getFieldArrayForGrade = useCallback((grade: string) => {
    switch(grade) {
      case "10": return grade10Fields;
      case "11": return grade11Fields;
      case "12": return grade12Fields;
      default: return grade10Fields;
    }
  }, [grade10Fields, grade11Fields, grade12Fields]);

  // Load data từ hooks
  useEffect(() => {
    if (configData) {
      const config = configData;
          const normalizedDays = Array.isArray(config.days)
            ? config.days
            : WEEKDAYS.map((d) => ({
                dayKey: d.key,
                label: d.label,
                morningPeriods: config.days?.[d.key]?.morningPeriods ?? 5,
                afternoonPeriods: config.days?.[d.key]?.afternoonPeriods ?? 0,
                totalPeriods: (config.days?.[d.key]?.morningPeriods ?? 5) + (config.days?.[d.key]?.afternoonPeriods ?? 0),
              }));
          
          // ✅ Normalize gradeConfigs (cấu trúc mới) - CHỈ LẤY "10", "11", "12"
          const normalizedGradeConfigs: Record<string, any> = {};
          const configWithGradeConfigs = config as any; // Type assertion để hỗ trợ gradeConfigs
          if (configWithGradeConfigs.gradeConfigs) {
            const gradeConfigsObj = configWithGradeConfigs.gradeConfigs instanceof Map
              ? Object.fromEntries(configWithGradeConfigs.gradeConfigs)
              : configWithGradeConfigs.gradeConfigs;

            // ✅ CHỈ LẤY keys "10", "11", "12" - BỎ QUA CÁC KEYS KHÁC
            GRADES.forEach(grade => {
              // Skip nếu không phải "10", "11", "12"
              if (!GRADES.includes(grade)) {
                console.warn(`⚠️ Bỏ qua gradeConfigs key không hợp lệ: ${grade}`);
                return;
              }
              const gradeConfig = gradeConfigsObj[grade] || {};
              
              // Normalize subjects
              const subjectsObj: Record<string, any> = {};
              if (gradeConfig.subjects) {
                const subjectsMap = gradeConfig.subjects instanceof Map
                  ? Object.fromEntries(gradeConfig.subjects)
                  : gradeConfig.subjects;
                
                Object.entries(subjectsMap || {}).forEach(([key, sub]: [string, any]) => {
                  const periodsPerWeek = Math.max(0, typeof sub.periodsPerWeek === 'number' 
                    ? sub.periodsPerWeek 
                    : (sub.periodsPerWeek?.[grade] ?? 0)); // ✅ Default 0
                  const normalized: any = {
                    periodsPerWeek: periodsPerWeek,
                    session: sub.session || "main",
                    maxPeriodsPerDay: sub.maxPeriodsPerDay ?? 0, // ✅ Default 0
                    allowConsecutive: sub.allowConsecutive ?? false, // ✅ Default false
                  };

                  // ✅ Xử lý fixedSlots (format: { dayOfWeek, periods: [1, 2] })
                  if (sub.fixedSlots && typeof sub.fixedSlots === 'object' && !Array.isArray(sub.fixedSlots)) {
                    normalized.fixedSlots = sub.fixedSlots;
                  }

                  subjectsObj[key] = normalized;
                });
              }

              // Normalize activities
              const normalizedActivities: any[] = [];
              if (gradeConfig.activities && Array.isArray(gradeConfig.activities)) {
                gradeConfig.activities.forEach((act: any) => {
                  // ✅ Validate activityId tồn tại
                  if (!act.activityId) {
                    console.warn(`⚠️ Activity trong gradeConfigs[${grade}] thiếu activityId, bỏ qua`);
                    return; // Skip activity không có activityId
                  }
                  
                  const periodsPerWeek = Math.max(0, typeof act.periodsPerWeek === 'number' 
                    ? act.periodsPerWeek 
                    : (act.periodsPerWeek?.[grade] ?? 0)); // ✅ Default 0
            const normalized: any = {
              activityId: act.activityId,
                    periodsPerWeek: periodsPerWeek,
              session: act.session || "main",
              isPermanent: act.isPermanent ?? true,
              startDate: act.startDate || null,
              endDate: act.endDate || null,
            };

                  // ✅ Đảm bảo gradeConfig có maxPeriodsPerDay và allowConsecutive đúng
                  if (!normalized.gradeConfigs) {
                    normalized.gradeConfigs = {};
                  }
                  if (!normalized.gradeConfigs[grade]) {
                    normalized.gradeConfigs[grade] = {};
                  }
                  normalized.gradeConfigs[grade].maxPeriodsPerDay = act.gradeConfigs?.[grade]?.maxPeriodsPerDay ?? 0; // ✅ Default 0
                  normalized.gradeConfigs[grade].allowConsecutive = act.gradeConfigs?.[grade]?.allowConsecutive ?? false; // ✅ Default false

                  // ✅ Xử lý fixedSlots (format: { dayOfWeek, period })
                  if (act.fixedSlots && typeof act.fixedSlots === 'object' && !Array.isArray(act.fixedSlots)) {
                    normalized.fixedSlots = act.fixedSlots;
                  }

                  normalizedActivities.push(normalized);
                });
              }

              // ✅ Load rules từ gradeConfig.rules (backend) hoặc fallback từ gradeSessionRules
              let rulesForGrade = gradeConfig.rules || null;
              
              // ✅ Nếu rules trong gradeConfigs là null, thử lấy từ gradeSessionRules
              if (!rulesForGrade && config.gradeSessionRules && Array.isArray(config.gradeSessionRules)) {
                const sessionRule = config.gradeSessionRules.find((r: any) => r?.grade === grade);
                if (sessionRule && sessionRule.session) {
                  rulesForGrade = { grade: grade, session: sessionRule.session };
                }
              }
              
              normalizedGradeConfigs[grade] = {
                subjects: subjectsObj,
                activities: normalizedActivities,
                rules: rulesForGrade,
              };
            });
                } else {
            // Khởi tạo rỗng nếu chưa có
            GRADES.forEach(grade => {
              // ✅ Nếu có gradeSessionRules, dùng nó để set rules
              let rulesForGrade = null;
              if (config.gradeSessionRules && Array.isArray(config.gradeSessionRules)) {
                const sessionRule = config.gradeSessionRules.find((r: any) => r?.grade === grade);
                if (sessionRule && sessionRule.session) {
                  rulesForGrade = { grade: grade, session: sessionRule.session };
                }
              }
              
              normalizedGradeConfigs[grade] = {
                subjects: {},
                activities: [],
                rules: rulesForGrade,
              };
            });
          }

          // ✅ Load gradeSessionRules từ rules trong gradeConfigs (ưu tiên) hoặc từ gradeSessionRules (fallback)
          const normalizedGradeSessionRules: any[] = [];
          GRADES.forEach((grade, index) => {
            // ✅ Ưu tiên lấy từ gradeConfigs[grade].rules
            const rulesFromGradeConfig = normalizedGradeConfigs[grade]?.rules;
            if (rulesFromGradeConfig && rulesFromGradeConfig.grade && rulesFromGradeConfig.session) {
              normalizedGradeSessionRules[index] = {
                grade: rulesFromGradeConfig.grade,
                session: rulesFromGradeConfig.session,
              };
            } else {
              // ✅ Fallback: lấy từ gradeSessionRules (legacy)
              const sessionRule = config.gradeSessionRules && Array.isArray(config.gradeSessionRules)
                ? config.gradeSessionRules.find((r: any) => r?.grade === grade)
                : null;
              if (sessionRule && sessionRule.session) {
                normalizedGradeSessionRules[index] = {
                  grade: grade,
                  session: sessionRule.session,
                };
              } else {
                // ✅ Default values nếu không có
                normalizedGradeSessionRules[index] = {
                  grade: grade,
                  session: DEFAULT_SESSION_RULES[grade as keyof typeof DEFAULT_SESSION_RULES],
                };
              }
            }
          });

          reset({ 
            ...config, 
            days: normalizedDays,
            gradeConfigs: normalizedGradeConfigs,
            gradeSessionRules: normalizedGradeSessionRules,
          });
          if (config.specialBreaks) setSpecialBreaksState(config.specialBreaks);
        }
  }, [configData, reset]);

  // Special breaks handlers
  const addSpecialBreak = (session: "morning" | "afternoon" = "morning") => {
    const newBreak = { period: 1, minutes: 25, session };
    const newBreaks = [...specialBreaksState, newBreak];
    setSpecialBreaksState(newBreaks);
    setValue("specialBreaks", newBreaks);
  };

  const removeSpecialBreak = (idx: number) => {
    const newBreaks = specialBreaksState.filter((_, i) => i !== idx);
    setSpecialBreaksState(newBreaks);
    setValue("specialBreaks", newBreaks.length ? newBreaks : undefined);
  };

  const updateSpecialBreak = (idx: number, field: "period" | "minutes" | "session", value: any) => {
    const newBreaks = [...specialBreaksState];
    (newBreaks[idx] as any)[field] = value;
    setSpecialBreaksState(newBreaks);
    setValue("specialBreaks", newBreaks);
  };

  // Preview thời gian tiết học - memoized
    const minutesPerPeriod = watch("minutesPerPeriod") || 45;
    const defaultBreakMinutes = watch("defaultBreakMinutes") || 5;
  
  const calculateScheduleTimes = useCallback((startTime: string, totalPeriods: number, session: "morning" | "afternoon") => {
    const times: string[] = [];
    let [hour, minute] = startTime.split(":").map(Number);

    for (let i = 1; i <= totalPeriods; i++) {
      const start = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      minute += minutesPerPeriod;
      if (minute >= 60) { hour += Math.floor(minute / 60); minute %= 60; }
      const end = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      times.push(`Tiết ${i}: ${start} - ${end}`);

      const specialBreak = specialBreaksState.find(b => b.period === i && b.session === session);
      const breakMin = specialBreak ? specialBreak.minutes : defaultBreakMinutes;
      minute += breakMin;
      if (minute >= 60) { hour += Math.floor(minute / 60); minute %= 60; }
    }
    return times;
  }, [minutesPerPeriod, defaultBreakMinutes, specialBreaksState]);
  
  // ✅ Sử dụng useWatch để subscribe realtime vào các field
  const days = useWatch({ control, name: "days" }) || [];
  const currentGrade = useWatch({ control, name: "currentGradeTab" }) || "10";
  const gradeSessionRules = useWatch({ control, name: "gradeSessionRules" }) || [];
  const gradeConfigs = useWatch({ control, name: "gradeConfigs" }) || {};
  
  // ✅ Tự động sync gradeSessionRules với gradeConfigs[grade].rules - chỉ khi user thay đổi
  // Removed auto-sync useEffect - sync được xử lý trực tiếp trong onValueChange handler
  
  // ✅ Kiểm tra validation trước khi lưu - Định nghĩa trước để sử dụng trong useMemo
  const validateBeforeSave = useCallback((values: any) => {
    const warnings: string[] = [];
    
    // Tính toán periodStats tương tự như useMemo
    const daysData = values.days || [];
    let totalMorning = 0;
    let totalAfternoon = 0;
    daysData.forEach((d: any) => {
      totalMorning += d.morningPeriods || 0;
      totalAfternoon += d.afternoonPeriods || 0;
    });
    
    const gradeSessionRulesData = values.gradeSessionRules || [];
    const gradeConfigsData = values.gradeConfigs || {};
    
    // Check từng khối
    GRADES.forEach(grade => {
      const gradeRule = gradeSessionRulesData.find((r: any) => r?.grade === grade);
      let maxMainPeriodsForGrade = totalMorning + totalAfternoon;
      let maxExtraPeriodsForGrade = 0;
      
      if (gradeRule?.session) {
        if (gradeRule.session === "morning") {
          maxMainPeriodsForGrade = totalMorning;
          maxExtraPeriodsForGrade = totalAfternoon;
        } else if (gradeRule.session === "afternoon") {
          maxMainPeriodsForGrade = totalAfternoon;
          maxExtraPeriodsForGrade = totalMorning;
        } else if (gradeRule.session === "both") {
          maxMainPeriodsForGrade = totalMorning + totalAfternoon;
          maxExtraPeriodsForGrade = 0;
        }
      }
      
      const gradeConfig = gradeConfigsData[grade] || {};
      let totalMainPeriods = 0;
      let totalExtraPeriods = 0;
      
      // Tính tiết chính/phụ từ subjects
      if (gradeConfig.subjects) {
        Object.values(gradeConfig.subjects).forEach((sub: any) => {
          if (sub?.periodsPerWeek) {
            const periods = typeof sub.periodsPerWeek === 'number' ? sub.periodsPerWeek : 0;
            const session = sub.session || "main";
            if (session === "main") {
              totalMainPeriods += periods;
            } else if (session === "extra") {
              totalExtraPeriods += periods;
            }
          }
        });
      }
      
      // Tính tiết chính/phụ từ activities
      if (gradeConfig.activities && Array.isArray(gradeConfig.activities)) {
        gradeConfig.activities.forEach((act: any) => {
          if (act?.periodsPerWeek) {
            const periods = typeof act.periodsPerWeek === 'number' ? act.periodsPerWeek : 0;
            const session = act.session || "main";
            if (session === "main") {
              totalMainPeriods += periods;
            } else if (session === "extra") {
              totalExtraPeriods += periods;
            }
          }
        });
      }
      
      // Check và thêm cảnh báo
      if (totalMainPeriods > maxMainPeriodsForGrade) {
        warnings.push(`Khối ${grade}: Tiết chính (${totalMainPeriods}) vượt quá số tiết buổi chính (${maxMainPeriodsForGrade})`);
      }
      if (maxExtraPeriodsForGrade > 0 && totalExtraPeriods > maxExtraPeriodsForGrade) {
        warnings.push(`Khối ${grade}: Tiết phụ (${totalExtraPeriods}) vượt quá số tiết buổi phụ (${maxExtraPeriodsForGrade})`);
      }
    });
    
    return warnings;
  }, []);
  
  // ✅ Tính warnings realtime để hiển thị cảnh báo màu vàng
  const saveWarnings = useMemo(() => {
    return validateBeforeSave({
      days,
      gradeSessionRules,
      gradeConfigs,
    });
  }, [days, gradeSessionRules, gradeConfigs, validateBeforeSave]);

  // ✅ Filter hoạt động theo khối được chọn trong dialog (dialogGrade)
  // Mỗi khối có thể có cùng một hoạt động (ví dụ: khối 10, 11, 12 đều có thể có hoạt động A)
  const availableActivities = useMemo(() => {
    // ✅ Lấy danh sách hoạt động đã được gán cho khối trong dialog
    const dialogGradeActivities = gradeConfigs[dialogGrade]?.activities || [];
    const assignedActivityIds = new Set(
      dialogGradeActivities
        .filter((act: any) => act?.activityId)
        .map((act: any) => String(act.activityId)) // ✅ Convert sang string để so sánh
    );
    
    // ✅ Chỉ hiển thị các hoạt động chưa được gán cho khối trong dialog
    return activities.filter(a => !assignedActivityIds.has(String(a._id)));
  }, [activities, dialogGrade, gradeConfigs]);

  // Tính tổng tiết có sẵn và đã sử dụng (theo khối được chọn)
  const periodStats = useMemo(() => {
    // Tổng tiết có sẵn
    let totalMorning = 0;
    let totalAfternoon = 0;
    days.forEach((d: any) => {
      totalMorning += d.morningPeriods || 0;
      totalAfternoon += d.afternoonPeriods || 0;
    });
    const totalAvailable = totalMorning + totalAfternoon;

    // ✅ Tính số tiết buổi chính và buổi phụ tối đa của khối (dựa trên gradeSessionRules)
    let maxMainPeriodsForGrade = totalAvailable; // Mặc định = tổng tiết
    let maxExtraPeriodsForGrade = 0; // Số tiết buổi phụ tối đa
    const gradeRule = gradeSessionRules.find((r: any) => r?.grade === currentGrade);
    if (gradeRule?.session) {
      if (gradeRule.session === "morning") {
        maxMainPeriodsForGrade = totalMorning; // Buổi chính = sáng
        maxExtraPeriodsForGrade = totalAfternoon; // Buổi phụ = chiều
      } else if (gradeRule.session === "afternoon") {
        maxMainPeriodsForGrade = totalAfternoon; // Buổi chính = chiều
        maxExtraPeriodsForGrade = totalMorning; // Buổi phụ = sáng
      } else if (gradeRule.session === "both") {
        maxMainPeriodsForGrade = totalMorning + totalAfternoon; // Buổi chính = cả ngày
        maxExtraPeriodsForGrade = 0; // Không có buổi phụ khi cả hai buổi
      }
    }

    // Tổng tiết đã sử dụng (môn học & hoạt động) - chỉ tính cho khối được chọn
    // ✅ Ưu tiên sử dụng gradeConfigs (cấu trúc mới)
    const currentGradeConfig = gradeConfigs[currentGrade];
    let totalSubjectPeriods = 0;
    let totalActivityPeriods = 0;
    let totalMainPeriods = 0; // ✅ Tiết chính (main)
    let totalExtraPeriods = 0; // ✅ Tiết phụ (extra)
    
    if (currentGradeConfig?.subjects) {
      Object.values(currentGradeConfig.subjects).forEach((sub: any) => {
      if (sub.periodsPerWeek) {
          // periodsPerWeek là number, không phải Map
          const periods = typeof sub.periodsPerWeek === 'number' 
          ? sub.periodsPerWeek
            : 0;
        totalSubjectPeriods += periods;
          // ✅ Phân biệt tiết chính/phụ
          const session = sub.session || "main";
          if (session === "main") {
            totalMainPeriods += periods;
          } else if (session === "extra") {
            totalExtraPeriods += periods;
          }
        }
      });
    }

    // Tổng tiết đã sử dụng (hoạt động) - chỉ tính cho khối được chọn
    if (currentGradeConfig?.activities && Array.isArray(currentGradeConfig.activities)) {
      currentGradeConfig.activities.forEach((act: any) => {
      if (act.periodsPerWeek) {
          // periodsPerWeek là number, không phải Map
          const periods = typeof act.periodsPerWeek === 'number' 
          ? act.periodsPerWeek
            : 0;
        totalActivityPeriods += periods;
          // ✅ Phân biệt tiết chính/phụ
          const session = act.session || "main";
          if (session === "main") {
            totalMainPeriods += periods;
          } else if (session === "extra") {
            totalExtraPeriods += periods;
          }
        }
      });
    }

    const totalUsed = totalSubjectPeriods + totalActivityPeriods;

    return {
      totalAvailable,
      totalMorning,
      totalAfternoon,
      totalUsed,
      totalSubjectPeriods,
      totalActivityPeriods,
      totalMainPeriods, // ✅ Tiết chính
      totalExtraPeriods, // ✅ Tiết phụ
      maxMainPeriodsForGrade, // ✅ Số tiết buổi chính tối đa của khối
      maxExtraPeriodsForGrade, // ✅ Số tiết buổi phụ tối đa của khối
      currentGrade,
    };
  }, [days, gradeConfigs, currentGrade, gradeSessionRules]);

  const { save: saveScheduleConfig } = useScheduleConfig();

  // Helper: Normalize periodsPerWeek
  const normalizePeriodsPerWeek = useCallback((value: any, grade: string): number => {
    return Math.max(0, typeof value === 'number' ? value : (value?.[grade] ?? 0));
  }, []);

  // Helper: Validate fixedSlots format
  const isValidSubjectFixedSlots = useCallback((fixedSlots: any): boolean => {
    return fixedSlots && 
           typeof fixedSlots === 'object' && 
           !Array.isArray(fixedSlots) && 
           fixedSlots.dayOfWeek && 
           Array.isArray(fixedSlots.periods);
  }, []);

  const isValidActivityFixedSlots = useCallback((fixedSlots: any): boolean => {
    return fixedSlots && 
           typeof fixedSlots === 'object' && 
           !Array.isArray(fixedSlots) && 
           fixedSlots.dayOfWeek && 
           typeof fixedSlots.period === 'number';
  }, []);

  // Hàm lưu chung để tái sử dụng - memoized
  const preparePayload = useCallback((values: any) => {
    const daysRecord: Record<string, any> = {};
    (values.days || []).forEach((d: any) => {
      daysRecord[d.dayKey] = {
        morningPeriods: d.morningPeriods,
        afternoonPeriods: d.afternoonPeriods,
        totalPeriods: d.totalPeriods,
      };
    });
    
    // ✅ Chỉ convert days và filter gradeConfigs keys - Backend sẽ xử lý normalize
    const preparedValues: any = { ...values };
    
    // ✅ Xóa subjectHours và activities (legacy) - chỉ dùng gradeConfigs
    delete preparedValues.subjectHours;
    delete preparedValues.activities;
    
    preparedValues.days = daysRecord;
    
    if (preparedValues.gradeConfigs) {
      // ✅ Chỉ giữ keys "10", "11", "12" - Backend sẽ xử lý phần còn lại
      const cleanedGradeConfigs: Record<string, any> = {};
      GRADES.forEach(grade => {
        if (preparedValues.gradeConfigs[grade]) {
          const gradeConfig = { ...preparedValues.gradeConfigs[grade] };
          
          // ✅ Cleanup subjects - đảm bảo periodsPerWeek là number và chỉ giữ môn học thuộc khối này
          if (gradeConfig.subjects && typeof gradeConfig.subjects === 'object') {
            const cleanedSubjects: Record<string, any> = {};
            Object.entries(gradeConfig.subjects).forEach(([subjectId, subData]: [string, any]) => {
              // ✅ Kiểm tra môn học có thuộc khối này không
              const subject = subjects.find(s => String(s._id) === subjectId);
              if (!subject) {
                // Môn học không tồn tại, bỏ qua
                console.warn(`⚠️ Môn học với id ${subjectId} không tồn tại, tự động xóa khỏi gradeConfigs[${grade}].subjects`);
                return;
              }
              
              // ✅ Kiểm tra môn học có trong danh sách grades của subject không
              if (!subject.grades || !Array.isArray(subject.grades) || !subject.grades.includes(grade)) {
                // Môn học không thuộc khối này, bỏ qua (tự động xóa)
                console.warn(`⚠️ Môn học "${subject.name}" (id: ${subjectId}) không thuộc khối ${grade}, tự động xóa khỏi gradeConfigs[${grade}].subjects`);
                return;
              }
              
              if (subData && typeof subData === 'object') {
                // ✅ Chỉ lưu nếu periodsPerWeek > 0 (môn học đang được sử dụng)
                const periodsPerWeek = normalizePeriodsPerWeek(subData.periodsPerWeek, grade);
                if (periodsPerWeek === 0) {
                  // Môn học không được sử dụng (periodsPerWeek = 0), bỏ qua
                  return;
                }
                
                cleanedSubjects[subjectId] = {
                  periodsPerWeek,
                  session: subData.session || "main",
                  maxPeriodsPerDay: subData.maxPeriodsPerDay ?? 0,
                  allowConsecutive: subData.allowConsecutive ?? false,
                  fixedSlots: isValidSubjectFixedSlots(subData.fixedSlots) ? subData.fixedSlots : null,
                };
              }
            });
            gradeConfig.subjects = cleanedSubjects;
          }
          
          // ✅ Đảm bảo activities có activityId và periodsPerWeek là number
          // ✅ Tự động xóa các activities không tồn tại trong danh sách activities từ API
          if (Array.isArray(gradeConfig.activities)) {
            const validActivityIds = new Set(activities.map(a => String(a._id)));
            gradeConfig.activities = gradeConfig.activities
              .filter((act: any) => {
                // ✅ Filter bỏ null/undefined hoặc thiếu activityId
                if (!act || !act.activityId) {
                  return false;
                }
                // ✅ Filter bỏ các activities không tồn tại trong danh sách từ API
                const actIdStr = String(act.activityId);
                if (!validActivityIds.has(actIdStr)) {
                  console.warn(`⚠️ Tự động xóa activity không tồn tại (id: ${actIdStr}) khỏi gradeConfigs[${grade}].activities`);
                  return false;
                }
                return true;
              })
              .map((act: any) => ({
                ...act,
                periodsPerWeek: normalizePeriodsPerWeek(act.periodsPerWeek, grade),
                fixedSlots: isValidActivityFixedSlots(act.fixedSlots) ? act.fixedSlots : null,
              }));
          }
          cleanedGradeConfigs[grade] = gradeConfig;
        }
      });
      preparedValues.gradeConfigs = cleanedGradeConfigs;
    }
    
    // ✅ Đảm bảo gradeSessionRules có đầy đủ grade và session
    if (preparedValues.gradeSessionRules && Array.isArray(preparedValues.gradeSessionRules)) {
      preparedValues.gradeSessionRules = preparedValues.gradeSessionRules
        .filter((rule: any) => rule && typeof rule === 'object' && rule.session) // Chỉ giữ các rule có session
        .map((rule: any) => ({
          grade: rule.grade || null,
          session: rule.session || null,
        }));
    }
    
    return preparedValues;
  }, [subjects, activities, normalizePeriodsPerWeek, isValidSubjectFixedSlots, isValidActivityFixedSlots]);

  // Lưu toàn bộ cấu hình
  const onSubmit = useCallback(async (values: any) => {
    const warnings = validateBeforeSave(values);
    const payload = preparePayload(values);
    
    try {
      await saveScheduleConfig(payload);
      if (warnings.length > 0) {
        toast.warning(`Đã lưu cấu hình, nhưng có ${warnings.length} cảnh báo: ${warnings.join("; ")}`);
      } else {
      toast.success("Lưu cấu hình thành công!");
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || "Unknown error";
      const errorDetails = err?.response?.data?.error || err?.response?.data?.validationErrors;
      toast.error(`Lưu thất bại: ${errorMessage}${errorDetails ? ` - ${JSON.stringify(errorDetails)}` : ""}`);
    }
  }, [validateBeforeSave, preparePayload, saveScheduleConfig]);

  // Tab payload mapping
  const TAB_PAYLOAD_MAP = useMemo(() => ({
    general: (payload: any) => ({
      minutesPerPeriod: payload.minutesPerPeriod,
      defaultBreakMinutes: payload.defaultBreakMinutes,
      specialBreaks: payload.specialBreaks,
    }),
    daily: (payload: any) => ({
      defaultStartTimeMorning: payload.defaultStartTimeMorning,
      defaultStartTimeAfternoon: payload.defaultStartTimeAfternoon,
      days: payload.days,
    }),
    subjects: (payload: any) => ({
      gradeConfigs: payload.gradeConfigs,
    }),
    sessions: (payload: any) => ({
      gradeSessionRules: payload.gradeSessionRules,
    }),
  }), []);

  const TAB_SUCCESS_MESSAGES = useMemo(() => ({
    general: "chung",
    daily: "giờ học",
    subjects: "môn học & hoạt động",
    sessions: "phân buổi",
  }), []);

  // Lưu riêng từng tab
  const handleSaveTab = useCallback(async (tabName: string) => {
    const values = watch();
    const payload = preparePayload(values);
    const getPartialPayload = TAB_PAYLOAD_MAP[tabName as keyof typeof TAB_PAYLOAD_MAP];
    
    const fullPayload: any = {
      ...configData,
      ...(getPartialPayload ? getPartialPayload(payload) : payload),
    };
    
    delete fullPayload.subjectHours;
    delete fullPayload.activities;

    try {
      await saveScheduleConfig(fullPayload);
      const message = TAB_SUCCESS_MESSAGES[tabName as keyof typeof TAB_SUCCESS_MESSAGES] || "cấu hình";
      toast.success(`Đã lưu cấu hình ${message} thành công!`);
    } catch (err: any) {
      toast.error(`Lưu thất bại: ${err.message || "Unknown error"}`);
    }
  }, [watch, preparePayload, configData, saveScheduleConfig, TAB_PAYLOAD_MAP, TAB_SUCCESS_MESSAGES]);

  const morningStart = watch("defaultStartTimeMorning") || "07:00";
  const afternoonStart = watch("defaultStartTimeAfternoon") || "13:00";
  
  // Tìm ngày có nhiều tiết nhất cho preview - memoized
  const { maxMorningDay, maxAfternoonDay } = useMemo(() => {
    const maxMorning = days.reduce((max: any, d: any) => 
    (d.morningPeriods || 0) > (max.morningPeriods || 0) ? d : max, days[0] || { morningPeriods: 0 }
  );
    const maxAfternoon = days.reduce((max: any, d: any) => 
    (d.afternoonPeriods || 0) > (max.afternoonPeriods || 0) ? d : max, days[0] || { afternoonPeriods: 0 }
  );
    return { maxMorningDay: maxMorning, maxAfternoonDay: maxAfternoon };
  }, [days]);

  const addActivity = useCallback(() => {
    if (!selectedActId) return;
    const fieldArray = getFieldArrayForGrade(dialogGrade);
    
    if (!watch(`gradeConfigs.${dialogGrade}`)) {
      setValue(`gradeConfigs.${dialogGrade}`, {
        subjects: {},
        activities: [],
        rules: null,
      });
    }
    
    fieldArray.append({
      activityId: selectedActId,
      periodsPerWeek: 0,
      session: "main",
      isPermanent: true,
      startDate: null,
      endDate: null,
      fixedSlots: null,
      gradeConfigs: {
        [dialogGrade]: {
          maxPeriodsPerDay: 0,
          allowConsecutive: false,
          session: "main",
        },
      },
    });
    
    setValue("currentGradeTab", dialogGrade);
    setSelectedActId("");
    setDialogOpen(false);
  }, [selectedActId, dialogGrade, getFieldArrayForGrade, watch, setValue]);

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Cấu hình thời khóa biểu (Mở rộng)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Thống kê tổng tiết */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-2 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <Label className="text-base font-semibold">Tổng tiết có sẵn</Label>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {periodStats.totalAvailable} tiết/tuần
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        (Sáng: <span className="font-medium">{periodStats.totalMorning}</span>, 
                        Chiều: <span className="font-medium">{periodStats.totalAfternoon}</span>)
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <Label className="text-base font-semibold">Đã sử dụng</Label>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {periodStats.totalUsed} tiết/tuần
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        (Môn: <span className="font-medium">{periodStats.totalSubjectPeriods}</span>, 
                        Hoạt động: <span className="font-medium">{periodStats.totalActivityPeriods}</span>)
                        <span className="ml-2 text-xs">- Khối {periodStats.currentGrade}</span>
                        <div className="text-xs mt-1">
                          (Tiết chính: <span className="font-medium">{periodStats.totalMainPeriods}</span>, 
                          Tiết phụ: <span className="font-medium">{periodStats.totalExtraPeriods}</span>)
                      </div>
                    </div>
                  </div>
                </div>
                </div>
                {/* ✅ Chỉ check tiết chính/phụ, không check tổng */}
                {periodStats.totalMainPeriods > periodStats.maxMainPeriodsForGrade && (
                  <div className="mt-4 p-3 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-md">
                    <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                      ⚠️ Cảnh báo: Tiết chính ({periodStats.totalMainPeriods}) vượt quá số tiết buổi chính của khối {periodStats.currentGrade} ({periodStats.maxMainPeriodsForGrade})
                    </p>
                  </div>
                )}
                {periodStats.maxExtraPeriodsForGrade > 0 && periodStats.totalExtraPeriods > periodStats.maxExtraPeriodsForGrade && (
                  <div className="mt-4 p-3 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-md">
                    <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                      ⚠️ Cảnh báo: Tiết phụ ({periodStats.totalExtraPeriods}) vượt quá số tiết buổi phụ của khối {periodStats.currentGrade} ({periodStats.maxExtraPeriodsForGrade})
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

        <Tabs defaultValue="general">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">Cấu hình chung</TabsTrigger>
              <TabsTrigger value="daily">Giờ học & Preview</TabsTrigger>
              <TabsTrigger value="subjects">Số tiết / Môn & Hoạt động</TabsTrigger>
              <TabsTrigger value="sessions">Phân buổi học</TabsTrigger>
            </TabsList>
          </div>

              {/* TAB 1 - GIỮ NGUYÊN 100% CỦA BẠN */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="flex justify-end mb-4">
              <Button type="button" onClick={() => handleSaveTab("general")} variant="outline">
                Lưu cấu hình chung
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label>Số phút mỗi tiết</label>
                    <Input type="number" {...form.register("minutesPerPeriod", { valueAsNumber: true })} />
              </div>
              <div>
                <label>Nghỉ giữa tiết (phút)</label>
                    <Input type="number" {...form.register("defaultBreakMinutes", { valueAsNumber: true })} />
              </div>
            </div>
            <h3 className="font-semibold mt-4">Giờ ra chơi đặc biệt</h3>
            {specialBreaksState.map((brk, i) => (
              <div key={i} className="flex items-center gap-3">
                    <Input type="number" value={brk.period} onChange={e => updateSpecialBreak(i, "period", Number(e.target.value))} className="w-20" />
                    <Input type="number" value={brk.minutes} onChange={e => updateSpecialBreak(i, "minutes", Number(e.target.value))} className="w-24" />
                    <select value={brk.session} onChange={e => updateSpecialBreak(i, "session", e.target.value as any)} className="border rounded px-2 py-1">
                  <option value="morning">Sáng</option>
                  <option value="afternoon">Chiều</option>
                </select>
                    <Button variant="destructive" size="sm" onClick={() => removeSpecialBreak(i)}>X</Button>
              </div>
            ))}
                <Button type="button" onClick={() => addSpecialBreak()}>Thêm giờ ra chơi</Button>
          </TabsContent>

              {/* TAB 2 - GIỮ NGUYÊN 100% BẢNG + PREVIEW CỦA BẠN */}
              <TabsContent value="daily" className="space-y-4 mt-4">
                <div className="flex justify-end mb-4">
                  <Button type="button" onClick={() => handleSaveTab("daily")} variant="outline">
                    Lưu cấu hình giờ học
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label>Giờ bắt đầu sáng</label>
                    <Input type="time" {...form.register("defaultStartTimeMorning")} />
                  </div>
                  <div>
                    <label>Giờ bắt đầu chiều</label>
                    <Input type="time" {...form.register("defaultStartTimeAfternoon")} />
                  </div>
                </div>

                <h3 className="font-semibold mt-4">Số tiết theo ngày (Sáng / Chiều)</h3>
                <table className="min-w-full border border-gray-300 text-center text-sm mt-2">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-3 py-2 w-24">Buổi / Thứ</th>
                      {days.map((d: any, idx: number) => (
                        <th key={d.dayKey || `day-${idx}`} className="border px-3 py-2">{d.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border font-medium bg-gray-50 px-3 py-2">Sáng</td>
                      {days.map((d: any, idx: number) => (
                        <td key={`m-${idx}`} className="border px-3 py-2">
                          <Input
                            type="number"
                            className="w-20 mx-auto text-center"
                            value={d.morningPeriods ?? 0}
                            onChange={e => {
                              const val = Number(e.target.value) || 0;
                              setValue(`days.${idx}.morningPeriods`, val);
                              setValue(`days.${idx}.totalPeriods`, val + (d.afternoonPeriods || 0));
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="border font-medium bg-gray-50 px-3 py-2">Chiều</td>
                      {days.map((d: any, idx: number) => (
                        <td key={`a-${idx}`} className="border px-3 py-2">
                          <Input
                            type="number"
                            className="w-20 mx-auto text-center"
                            value={d.afternoonPeriods ?? 0}
                            onChange={e => {
                              const val = Number(e.target.value) || 0;
                              setValue(`days.${idx}.afternoonPeriods`, val);
                              setValue(`days.${idx}.totalPeriods`, val + (d.morningPeriods || 0));
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-gray-50 font-medium">
                      <td className="border px-3 py-2">Tổng</td>
                      {days.map((d: any, idx: number) => (
                        <td key={`t-${idx}-${d.dayKey || idx}`} className="border px-3 py-2">{d.totalPeriods ?? 0}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>

                <div className="grid grid-cols-2 gap-6 mt-6">
                  <div>
                    <h4 className="font-semibold mb-2">Preview Sáng (Tối đa: {maxMorningDay.morningPeriods || 0} tiết)</h4>
                    <ul className="text-sm space-y-1">
                      {calculateScheduleTimes(morningStart, maxMorningDay.morningPeriods || 0, "morning").map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Preview Chiều (Tối đa: {maxAfternoonDay.afternoonPeriods || 0} tiết)</h4>
                    <ul className="text-sm space-y-1">
                      {calculateScheduleTimes(afternoonStart, maxAfternoonDay.afternoonPeriods || 0, "afternoon").map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TabsContent>

          {/* TAB 3: Môn học & Hoạt động */}
          <TabsContent value="subjects" className="space-y-10">
            <div className="flex justify-end mb-4">
              <Button type="button" onClick={() => handleSaveTab("subjects")} variant="outline">
                Lưu cấu hình môn học & hoạt động
              </Button>
            </div>
            <Tabs value={currentGrade} onValueChange={v => setValue("currentGradeTab", v)}>
              <TabsList className="grid w-full grid-cols-3">
                {GRADES.map(g => <TabsTrigger key={g} value={g}>Khối {g}</TabsTrigger>)}
              </TabsList>

              {GRADES.map(grade => (
                <TabsContent key={grade} value={grade} className="space-y-10">
                  <div>
                    <h3 className="text-xl font-bold mb-6">Môn học - Khối {grade}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {subjects
                        .filter(s => {
                          // ✅ Chỉ hiển thị môn học active và thuộc khối này
                          if (s.isActive === false) return false;
                          // ✅ Kiểm tra môn học có trong danh sách grades của subject không
                          return s.grades && Array.isArray(s.grades) && s.grades.includes(grade);
                        })
                        .map(sub => (
                          <SubjectCard key={sub._id} subject={sub} grade={grade as Grade} />
                        ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Hoạt động ngoại khóa - Khối {grade}</h3>
                      <Button type="button" onClick={() => {
                        // ✅ Đảm bảo khi mở dialog, set đúng dialogGrade và reset selectedActId
                        setDialogGrade(grade as "10" | "11" | "12");
                        setValue("currentGradeTab", grade);
                        setSelectedActId("");
                        setDialogOpen(true);
                      }}>+ Thêm hoạt động</Button>
                    </div>
                    <div className="space-y-6">
                      {watch(`gradeConfigs.${grade}.activities`)
                        ?.filter((field: any, idx: number) => {
                          // ✅ Filter bỏ các field không có activityId
                          if (!field?.activityId) {
                            console.warn(`⚠️ Field tại index ${idx} trong gradeConfigs[${grade}].activities thiếu activityId`);
                            return false;
                          }
                          // ✅ So sánh ID dưới dạng string để tránh vấn đề ObjectId
                          const fieldActivityIdStr = String(field.activityId);
                          const act = activities.find(a => String(a._id) === fieldActivityIdStr);
                          if (!act) {
                            console.warn(`⚠️ Không tìm thấy activity với id: ${fieldActivityIdStr}. Activity có thể đã bị xóa.`);
                            return false;
                          }
                          return true;
                        })
                        ?.map((field: any, idx: number) => {
                          const fieldActivityId = String(field.activityId);
                          const act = activities.find(a => String(a._id) === fieldActivityId);
                          if (!act) {
                            // ✅ Nếu vẫn không tìm thấy (trường hợp hiếm), bỏ qua
                            return null;
                          }
                          // ✅ Sử dụng unique key: grade-activityId-index
                          return <ActivityCard key={`${grade}-${fieldActivityId}-${idx}`} index={idx} activity={act} grade={grade as Grade} />;
                        })
                        ?.filter(Boolean) || []}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          {/* TAB 4: Phân buổi theo khối */}
          <TabsContent value="sessions" className="space-y-6">
            <div className="flex justify-end mb-4">
              <Button type="button" onClick={() => handleSaveTab("sessions")} variant="outline">
                Lưu cấu hình phân buổi
              </Button>
            </div>
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6">Phân buổi học theo khối</h2>
              <div className="space-y-6">
                {GRADES.map((g, i) => (
                  <div key={g} className="flex items-center gap-6">
                    <Label className="w-32 font-medium">Khối {g}</Label>
                    <Controller
                      name={`gradeSessionRules.${i}.session`}
                      control={control}
                      render={({ field }) => (
                        <Select 
                          value={field.value} 
                          onValueChange={(value) => {
                            // ✅ Tự động set cả grade khi thay đổi session
                            setValue(`gradeSessionRules.${i}.grade`, g);
                            setValue(`gradeSessionRules.${i}.session`, value);
                            // ✅ Tự động sync với gradeConfigs[grade].rules
                            setValue(`gradeConfigs.${g}.rules`, { grade: g, session: value }, { shouldDirty: true });
                            field.onChange(value);
                          }}
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="morning">Chỉ buổi sáng</SelectItem>
                            <SelectItem value="afternoon">Chỉ buổi chiều</SelectItem>
                            <SelectItem value="both">Cả hai buổi</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
              </div>
            ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog thêm hoạt động */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chọn hoạt động để thêm - Khối {dialogGrade}</DialogTitle>
            </DialogHeader>
            <Select value={selectedActId} onValueChange={setSelectedActId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn hoạt động" />
              </SelectTrigger>
              <SelectContent>
                {availableActivities.length > 0 ? (
                  availableActivities.map(a => (
                  <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Tất cả hoạt động đã được gán cho khối {dialogGrade}
                  </div>
                )}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
              <Button type="button" onClick={addActivity} disabled={!selectedActId}>Thêm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

            {/* ✅ Cảnh báo màu vàng nếu vượt quá giới hạn - Realtime */}
            {saveWarnings.length > 0 && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400 text-lg">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                      Cảnh báo trước khi lưu:
                    </p>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
                      {saveWarnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-6">
              <Button type="submit" size="lg" disabled={formState.isSubmitting}>
                {formState.isSubmitting ? "Đang lưu..." : "Lưu toàn bộ cấu hình"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </FormProvider>
  );
}

export default ScheduleConfigForm;
export { ScheduleConfigForm };