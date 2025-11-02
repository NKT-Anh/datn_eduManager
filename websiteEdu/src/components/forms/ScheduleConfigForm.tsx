import React, { useEffect, useState } from "react";
import { useForm, Controller, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getScheduleConfig, saveScheduleConfig } from "@/services/scheduleConfigApi";
import { subjectApi } from "@/services/subjectApi";
import { activityApi } from "@/services/activityApi";
import type { Subject, Activity } from "@/types/class";
import type { ScheduleConfig,ActivitySlot } from "@/types/schedule";

/**
 * Schema (zod) cho form - lưu ý dùng dạng array cho days để dễ render theo thứ tự
 */
const schema = z.object({
  defaultStartTimeMorning: z.string(),
  defaultStartTimeAfternoon: z.string(),
  minutesPerPeriod: z.number().min(1),
  defaultBreakMinutes: z.number().min(0),
  specialBreaks: z
    .array(
      z.object({
        period: z.number().min(1),
        minutes: z.number().min(0),
        session: z.enum(["morning", "afternoon"]),
      })
    )
    .optional(),
  // subjectHours: key = subject.name (or id) -> object
  subjectHours: z
    .record(
      z.string(),
      z.object({
        periodsPerWeek: z.number().min(0),
        maxPeriodsPerDay: z.number().min(1),
        allowConsecutive: z.boolean(),
        session: z.enum(["main", "extra"]),
      })
    )
    .optional(),
  // days as array of day-configs (Mon..Fri or user-defined)
  days: z
    .array(
      z.object({
        dayKey: z.string(),
        label: z.string(),
        morningPeriods: z.number().min(0),
        afternoonPeriods: z.number().min(0),
        totalPeriods: z.number().min(0),
      })
    )
    .optional(),
  gradeSessionRules: z
    .array(
      z.object({
        grade: z.enum(["10", "11", "12"]),
        session: z.enum(["morning", "afternoon", "both"]),
      })
    )
    .optional(),
  activities: z
    .array(
      z.object({
        activityId: z.string(),
        periodsPerWeek: z.number(),
        session: z.enum(["main", "extra"]),
      })
    )
    .optional(),
});

const WEEKDAYS = [
  { key: "Monday", label: "Thứ 2" },
  { key: "Tuesday", label: "Thứ 3" },
  { key: "Wednesday", label: "Thứ 4" },
  { key: "Thursday", label: "Thứ 5" },
  { key: "Friday", label: "Thứ 6" },
   { key: "Saturday", label: "Thứ 7" },
];

export function ScheduleConfigForm(): JSX.Element {
  // subjects + activities data from API
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activitiesData, setActivitiesData] = useState<Activity[]>([]);
  const [specialBreaksState, setSpecialBreaksState] = useState<
    { period: number; minutes: number; session: "morning" | "afternoon" }[]
  >([]);

  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      defaultStartTimeMorning: "07:00",
      defaultStartTimeAfternoon: "13:00",
      minutesPerPeriod: 45,
      defaultBreakMinutes: 5,
      specialBreaks: [],
      subjectHours: {},
      days: WEEKDAYS.map((d) => ({
        dayKey: d.key,
        label: d.label,
        morningPeriods: 5,
        afternoonPeriods: 0,
        totalPeriods: 5,
      })),
      gradeSessionRules: [
        { grade: "10", session: "morning" },
        { grade: "11", session: "afternoon" },
        { grade: "12", session: "both" },
      ],
      activities: [],
    },
  });

  const { control, register, handleSubmit, reset, setValue, watch } = form;

  // activities field array
  const { fields: activityFields, append, update, remove } = useFieldArray({
  control,
  name: "activities",
}) as unknown as {
  fields: (ActivitySlot & { id: string })[];
  append: (v: ActivitySlot) => void;
  update: (index: number, v: ActivitySlot) => void;
  remove: (index: number) => void;
};


  // watch values needed
  const minutesPerPeriod = useWatch({ control, name: "minutesPerPeriod" }) || 45;
  const defaultBreakMinutes = useWatch({ control, name: "defaultBreakMinutes" }) || 5;
  const subjectHours = useWatch({ control, name: "subjectHours" }) || {};
  const days = useWatch({ control, name: "days" }) || [];

  // load config + subjects + activities
  useEffect(() => {
    Promise.all([getScheduleConfig(), subjectApi.getSubjects(), activityApi.getAll()]).then(
      ([config, subs, acts]) => {
        if (config) {
          // Normalize days to array if server returns record
          const normalized =
            Array.isArray(config.days) && config.days.length > 0
              ? config.days
              : WEEKDAYS.map((d) => {
                  const dayRec = config?.days?.[d.key];
                  return {
                    dayKey: d.key,
                    label: d.label,
                    morningPeriods: dayRec?.morningPeriods ?? 5,
                    afternoonPeriods: dayRec?.afternoonPeriods ?? 0,
                    totalPeriods: (dayRec?.morningPeriods ?? 5) + (dayRec?.afternoonPeriods ?? 0),
                  };
                });

          reset({
            ...config,
            days: normalized,
          });
          if (config.specialBreaks) setSpecialBreaksState(config.specialBreaks);
        }
        if (subs) setSubjects(subs);
        if (acts) setActivitiesData(acts);
      }
    );
  }, [reset]);

  // ----- Special break handlers -----
  const numberDefault = 25;
  const addSpecialBreak = (session: "morning" | "afternoon" = "morning") => {
    const newBreaks = [...specialBreaksState, { period: 1, minutes: numberDefault, session }];
    setSpecialBreaksState(newBreaks);
    setValue("specialBreaks", newBreaks);
  };
  const removeSpecialBreak = (idx: number) => {
    const newBreaks = specialBreaksState.filter((_, i) => i !== idx);
    setSpecialBreaksState(newBreaks);
    setValue("specialBreaks", newBreaks);
  };
  const updateSpecialBreak = (idx: number, field: "period" | "minutes" | "session", value: any) => {
    const newBreaks = [...specialBreaksState];
    // @ts-ignore
    newBreaks[idx][field] = value;
    setSpecialBreaksState(newBreaks);
    setValue("specialBreaks", newBreaks);
  };

  // ----- Calculate schedule times (unchanged) -----
  const calculateScheduleTimes = (startTime: string, totalPeriods: number, session: "morning" | "afternoon") => {
    const times: string[] = [];
    let [hour, minute] = startTime.split(":").map(Number);
    for (let i = 1; i <= totalPeriods; i++) {
      const start = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      minute += minutesPerPeriod;
      if (minute >= 60) {
        hour += Math.floor(minute / 60);
        minute %= 60;
      }
      const end = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      times.push(`Tiết ${i}: ${start} - ${end}`);
      const specialBreak = specialBreaksState.find((b) => b.period === i && b.session === session);
      const breakMin = specialBreak ? specialBreak.minutes : defaultBreakMinutes;
      minute += breakMin;
      if (minute >= 60) {
        hour += Math.floor(minute / 60);
        minute %= 60;
      }
    }
    return times;
  };
  
// ----- Counting helpers -----
const getPeriodSummary = () => {
  const totalMorning = days.reduce((sum: number, d: any) => sum + (d.morningPeriods || 0), 0);
  const totalAfternoon = days.reduce((sum: number, d: any) => sum + (d.afternoonPeriods || 0), 0);
  const totalAll = totalMorning + totalAfternoon;
  return { totalMorning, totalAfternoon, totalAll };
};
const getWeeklyPeriodTotals = () => {
  // Môn học chính
  const subjectsMain = Object.entries(subjectHours || {}).filter(
    ([, rule]: any) => rule.session === "main"
  );
  const totalSubjectMain = subjectsMain.reduce(
    (sum, [, rule]: any) => sum + (rule.periodsPerWeek || 0),
    0
  );

  // Hoạt động chính
  const activitiesMain = (watch("activities") || []).filter((a: any) => a.session === "main");
  const totalActivityMain = activitiesMain.reduce(
    (sum: number, a: any) => sum + (a.periodsPerWeek || 0),
    0
  );

  // Tổng tất cả
  const totalAll = totalSubjectMain + totalActivityMain;

  return { totalSubjectMain, totalActivityMain, totalAll };
};
const { totalSubjectMain, totalActivityMain, totalAll: totalWeeklyAll } = getWeeklyPeriodTotals();
const { totalMorning, totalAfternoon, totalAll: totalDailyAll } = getPeriodSummary();


  // ----- Activities handlers -----
  const handleActivityAdd = (act: Activity) => {
    const exists = activityFields.find((f) => f.activityId === act._id);
    if (!exists) append({ activityId: act._id, periodsPerWeek: 1, session: "main" });
  };

  // ----- Days handlers -----
  const updateDayField = (idx: number, field: "morningPeriods" | "afternoonPeriods", value: number) => {
    const currentDays = [...(days || [])];
    const day = { ...currentDays[idx] };
    day[field] = Math.max(0, Math.floor(value || 0));
    day.totalPeriods = day.morningPeriods + day.afternoonPeriods;
    currentDays[idx] = day;
    setValue("days", currentDays);
  };

  // ----- Subject handlers -----
  // when user updates periodsPerWeek for a subject, ensure maxPeriodsPerDay <= periodsPerWeek
  const updateSubjectPeriodsPerWeek  = (subjectKey: string, periodsPerWeek: number) => {
    const sh = { ...(subjectHours || {}) };
    const prev = sh[subjectKey] || {
      periodsPerWeek: 0,
      maxPeriodsPerDay: 1,
      allowConsecutive: true,
      session: "main",
    };
    const newTotal = Math.max(0, Math.floor(periodsPerWeek || 0));
    // suggest default maxPeriodsPerDay = min(prev.maxPeriodsPerDay, newTotal) and at least 1 if newTotal>0
    let suggestedMax = prev.maxPeriodsPerDay;
    if (suggestedMax > newTotal) suggestedMax = Math.max(1, newTotal);
    if (newTotal === 0) suggestedMax = 0;
    sh[subjectKey] = {
      ...prev,
      periodsPerWeek: newTotal,
      maxPeriodsPerDay: suggestedMax,
    };
    setValue("subjectHours", sh);
  };

  const updateSubjectMaxPeriodsPerDay  = (subjectKey: string, maxPeriodsPerDay: number) => {
    const sh = { ...(subjectHours || {}) };
    const prev = sh[subjectKey] || {
      periodsPerWeek: 0,
      maxPeriodsPerDay: 1,
      allowConsecutive: true,
      session: "main",
    };
    const newMax = Math.max(0, Math.floor(maxPeriodsPerDay || 0));
    // enforce newMax <= periodsPerWeek
    const allowedMax = prev.periodsPerWeek ? Math.min(newMax, prev.periodsPerWeek) : newMax;
    sh[subjectKey] = {
      ...prev,
      maxPeriodsPerDay: allowedMax,
    };
    setValue("subjectHours", sh);
  };

  // ----- Submit handler -----
  const onSubmit = async (values: any) => {
    // normalize days to record if backend expects record keyed by dayKey
    const daysRecord: Record<string, any> = {};
    (values.days || []).forEach((d: any) => {
      daysRecord[d.dayKey] = {
        morningPeriods: d.morningPeriods,
        afternoonPeriods: d.afternoonPeriods,
        totalPeriods: d.totalPeriods,
      };
    });

    const payload: ScheduleConfig = {
      ...values,
      days: daysRecord as any, // adapt to server shape if needed
    };

    try {
      console.log("🔥 Payload gửi API:", payload);
      await saveScheduleConfig(payload);
      alert("✅ Lưu cấu hình thành công!");
    } catch (err) {
      console.error(err);
      alert("❌ Lưu thất bại, vui lòng thử lại.");
    }
  };

  const morningStart = watch("defaultStartTimeMorning") || "07:00";
  const afternoonStart = watch("defaultStartTimeAfternoon") || "13:00";

  return (
    <Card className="max-h-[90vh] overflow-y-auto">
      <CardHeader>
        <CardTitle>Cấu hình thời khóa biểu (Mở rộng)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">Cấu hình chung</TabsTrigger>
            <TabsTrigger value="daily">Giờ học & Preview</TabsTrigger>
            <TabsTrigger value="subjects">Số tiết / Môn & Hoạt động</TabsTrigger>
            <TabsTrigger value="sessions">Phân buổi học</TabsTrigger>
          </TabsList>

          {/* TAB 1 */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label>Số phút mỗi tiết</label>
                <Input type="number" {...register("minutesPerPeriod", { valueAsNumber: true })} />
              </div>
              <div>
                <label>Nghỉ giữa tiết (phút)</label>
                <Input type="number" {...register("defaultBreakMinutes", { valueAsNumber: true })} />
              </div>
            </div>

            <h3 className="font-semibold mt-4">Giờ ra chơi đặc biệt</h3>
            {specialBreaksState.map((brk, i) => (
              <div key={i} className="flex items-center gap-3">
                <Input
                  type="number"
                  value={brk.period}
                  onChange={(e) => updateSpecialBreak(i, "period", Number(e.target.value))}
                  className="w-20"
                />
                <Input
                  type="number"
                  value={brk.minutes}
                  onChange={(e) => updateSpecialBreak(i, "minutes", Number(e.target.value))}
                  className="w-24"
                />
                <select
                  value={brk.session}
                  onChange={(e) => updateSpecialBreak(i, "session", e.target.value as any)}
                  className="border rounded px-2 py-1"
                >
                  <option value="morning">Sáng</option>
                  <option value="afternoon">Chiều</option>
                </select>
                <Button variant="destructive" onClick={() => removeSpecialBreak(i)}>
                  X
                </Button>
              </div>
            ))}
            <Button onClick={() => addSpecialBreak()}>➕ Thêm giờ ra chơi</Button>
          </TabsContent>

          {/* TAB 2 */}
          <TabsContent value="daily" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label>Giờ bắt đầu sáng</label>
                <Input type="time" {...register("defaultStartTimeMorning")} />
              </div>
              <div>
                <label>Giờ bắt đầu chiều</label>
                <Input type="time" {...register("defaultStartTimeAfternoon")} />
              </div>
            </div>

<h3 className="font-semibold mt-4">Số tiết theo ngày (Sáng / Chiều)</h3>

<table className="min-w-full border border-gray-300 text-center text-sm mt-2">
  <thead>
    <tr className="bg-gray-100">
      <th className="border px-3 py-2 w-24">Buổi / Thứ</th>
      {(days || []).map((d: any, idx: number) => (
        <th key={d?.dayKey ?? idx} className="border px-3 py-2">
          {d?.label ?? `Thứ ${idx + 2}`}
        </th>
      ))}
    </tr>
  </thead>
  <tbody>
    {/* Hàng buổi sáng */}
    <tr>
      <td className="border font-medium bg-gray-50 px-3 py-2">Sáng</td>
      {(days || []).map((d: any, idx: number) => (
        <td key={`morning-${idx}`} className="border px-3 py-2">
          <Input
            type="number"
            value={d?.morningPeriods ?? 0}
            onChange={(e) =>
              updateDayField(idx, "morningPeriods", Number(e.target.value))
            }
            className="w-20 mx-auto text-center"
          />
        </td>
      ))}
    </tr>

    {/* Hàng buổi chiều */}
    <tr>
      <td className="border font-medium bg-gray-50 px-3 py-2">Chiều</td>
      {(days || []).map((d: any, idx: number) => (
        <td key={`afternoon-${idx}`} className="border px-3 py-2">
          <Input
            type="number"
            value={d?.afternoonPeriods ?? 0}
            onChange={(e) =>
              updateDayField(idx, "afternoonPeriods", Number(e.target.value))
            }
            className="w-20 mx-auto text-center"
          />
        </td>
      ))}
    </tr>

    {/* Hàng tổng tiết */}
    <tr className="bg-gray-50 font-medium">
      <td className="border px-3 py-2">Tổng</td>
      {(days || []).map((d: any, idx: number) => (
        <td key={`total-${idx}`} className="border px-3 py-2">
          {d?.totalPeriods ?? 0}
        </td>
      ))}
    </tr>
  </tbody>
</table>

            

            <div className="grid grid-cols-2 gap-6 mt-4">
              <div>
                <h4 className="font-semibold mb-2">Preview Sáng</h4>
                <ul className="text-sm">
                  {calculateScheduleTimes(morningStart, (days?.[0]?.morningPeriods) ?? 5, "morning").map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Preview Chiều</h4>
                <ul className="text-sm">
                  {calculateScheduleTimes(afternoonStart, (days?.[0]?.afternoonPeriods) ?? 0, "afternoon").map(
                    (t, i) => (
                      <li key={i}>{t}</li>
                    )
                  )}
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3 */}
          <TabsContent value="subjects" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {subjects.map((sub) => {
  const key = sub.name ?? sub._id;
  const rule = (subjectHours && subjectHours[key]) || {
    periodsPerWeek: 4,
    maxPeriodsPerDay: 2,
    allowConsecutive: true,
    session: "main" as "main" | "extra",
  };

  return (
    <Card key={sub._id} className="p-4 space-y-2">
      <h4 className="font-medium">{sub.name}</h4>

      <div className="flex gap-2 items-center">
        <label className="w-36">Tổng tiết / tuần</label>
        <Input
          type="number"
          value={rule.periodsPerWeek}
          onChange={(e) => updateSubjectPeriodsPerWeek(key, Number(e.target.value))}
          className="w-28"
        />
      </div>

      <div className="flex gap-2 items-center mt-2">
        <label className="w-36">Tối đa / ngày</label>
        <Input
          type="number"
          value={rule.maxPeriodsPerDay}
          onChange={(e) => updateSubjectMaxPeriodsPerDay(key, Number(e.target.value))}
          className="w-28"
        />
        <span className="text-sm"> (≤ tổng/tuần)</span>
      </div>

      <div className="flex gap-2 items-center mt-2">
        <label className="w-36">Buổi</label>
        <select
          value={rule.session}
          onChange={(e) =>
            setValue(`subjectHours.${key}.session`, e.target.value === "extra" ? "extra" : "main")
          }
          className="border rounded px-2 py-1"
        >
          <option value="main">Buổi chính</option>
          <option value="extra">Buổi phụ</option>
        </select>
      </div>

      <div className="flex gap-2 items-center mt-2">
        <label className="w-36">Cho phép tiết liên tiếp</label>
        <input
          type="checkbox"
          checked={!!rule.allowConsecutive}
          onChange={(e) =>
            setValue(`subjectHours.${key}.allowConsecutive`, e.target.checked)
          }
        />
      </div>
    </Card>
  );
})}


              {/* Activities block */}
              <div className="col-span-1 md:col-span-2">
                <h4 className="font-semibold">Hoạt động</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {activitiesData.map((act) => {
                    const idx = activityFields.findIndex((f) => f.activityId === act._id);
                    if (idx === -1) {
                      return (
                        <Button key={act._id} onClick={() => handleActivityAdd(act)}>
                          Thêm {act.name}
                        </Button>
                      );
                    }
                    const field = activityFields[idx];
                    return (
                      <Card key={field.id} className="p-3 space-y-2">
                        <div className="font-medium">{act.name}</div>
                        <Controller
                          control={control}
                          name={`activities.${idx}.periodsPerWeek`}
                           render={({ field }) => (
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            value={field.value ?? ""} // ✅ đảm bảo không undefined
                            onChange={(e) => field.onChange(Number(e.target.value) || 0)} // ✅ convert sang number
                          />
                        )}
                        />
                        <Controller
                          control={control}
                          name={`activities.${idx}.session`}
                          render={({ field }) => (
                            <select {...field}>
                               <option value="main">Buổi chính</option>
                                <option value="extra">Buổi phụ</option>
                            </select>
                          )}
                        />
                        <div className="flex gap-2">
                          <Button variant="destructive" onClick={() => remove(idx)}>
                            Xóa
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* <div>
  <p>Tổng tiết trong tuần (theo môn + hoạt động): {totalDailyAll}</p>
  <p>Tổng tiết theo ngày (sáng + chiều): {totalDailyAll}</p>
</div> */}
<div className="mt-4 p-3 border rounded bg-gray-50 text-sm">
  <p><strong>Tổng tiết môn chính:</strong> {totalSubjectMain}</p>
  <p><strong>Tổng tiết hoạt động chính:</strong> {totalActivityMain}</p>
  {/* <p><strong>Tổng cộng:</strong> {totalDailyAll} tiết / tuần</p> */}
</div>

<tr className="bg-green-50 font-medium">
  <td className="border px-3 py-2">Tổng cộng</td>
  <td colSpan={days.length} className="border px-3 py-2 text-left">
    Sáng: {totalMorning} tiết | Chiều: {totalAfternoon} tiết | Tiết ( chính ): {totalWeeklyAll} tiết / tuần
  </td>
</tr>
          </TabsContent>

          {/* TAB 4 */}
          <TabsContent value="sessions" className="space-y-4 mt-4">
            {(watch("gradeSessionRules") || []).map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-4">
                <span className="font-medium">Khối {r.grade}</span>
                <select
                  value={r.session}
                  onChange={(e) => {
                    const newRules = [...(watch("gradeSessionRules") || [])];
                    newRules[i] = { ...newRules[i], session: e.target.value };
                    setValue("gradeSessionRules", newRules);
                  }}
                >
                  <option value="morning">Buổi sáng</option>
                  <option value="afternoon">Buổi chiều</option>
                  <option value="both">Cả hai</option>
                </select>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={handleSubmit(onSubmit)}>💾 Lưu cấu hình</Button>
        </div>
      </CardContent>
    </Card>
  );
}
