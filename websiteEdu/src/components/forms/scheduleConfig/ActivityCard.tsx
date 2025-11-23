import React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Activity as ActivityIcon } from "lucide-react";
import type { Activity } from "@/types/class";

interface ActivityCardProps {
  activity: Activity;
  activityIndex: number;
  grade: "10" | "11" | "12";
}

const DAYS_OF_WEEK = [
  { value: "Monday", label: "Thứ 2" },
  { value: "Tuesday", label: "Thứ 3" },
  { value: "Wednesday", label: "Thứ 4" },
  { value: "Thursday", label: "Thứ 5" },
  { value: "Friday", label: "Thứ 6" },
  { value: "Saturday", label: "Thứ 7" },
];

const TIME_SLOTS = [
  { value: "1", label: "Tiết 1" },
  { value: "2", label: "Tiết 2" },
  { value: "3", label: "Tiết 3" },
  { value: "4", label: "Tiết 4" },
  { value: "5", label: "Tiết 5" },
];

export function ActivityCard({ activity, activityIndex, grade }: ActivityCardProps) {
  const { watch, setValue } = useFormContext();
  const { remove } = useFieldArray({ name: "activities" });
  
  const activities = watch("activities") || [];
  const activityData = activities[activityIndex] || {};
  
  const periodsPerWeek = typeof activityData.periodsPerWeek === 'object' && activityData.periodsPerWeek !== null
    ? activityData.periodsPerWeek
    : { "10": 2, "11": 2, "12": 2 };
  
  const gradeConfig = activityData.gradeConfigs?.[grade] || {
    maxPeriodsPerDay: 1,
    allowConsecutive: false,
    session: "main",
    dayOfWeek: undefined,
    timeSlot: undefined,
  };

  return (
    <Card className="p-4 space-y-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-5 w-5 text-primary" />
          <div className="font-semibold text-base">{activity.name}</div>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => remove(activityIndex)}
        >
          Xóa hoạt động
        </Button>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        {/* Số tiết / tuần */}
        <div className="space-y-2">
          <Label htmlFor={`activity-${activityIndex}-periods-${grade}`} className="text-sm font-medium">
            Số tiết / tuần (Khối {grade})
          </Label>
          <Input
            id={`activity-${activityIndex}-periods-${grade}`}
            type="number"
            min={0}
            value={periodsPerWeek[grade] || 0}
            onChange={(e) => {
              const newValue = Number(e.target.value) || 0;
              const updated = { ...periodsPerWeek, [grade]: newValue };
              setValue(`activities.${activityIndex}.periodsPerWeek`, updated, { shouldValidate: true, shouldDirty: true });
            }}
            className="w-full"
          />
        </div>

        {/* Ngày trong tuần */}
        <div className="space-y-2">
          <Label htmlFor={`activity-${activityIndex}-day-${grade}`} className="text-sm font-medium">
            Ngày trong tuần (Khối {grade})
          </Label>
          <Select
            value={gradeConfig.dayOfWeek || "none"}
            onValueChange={(value) => {
              const updated = {
                ...gradeConfig,
                dayOfWeek: value === "none" ? undefined : value,
              };
              setValue(`activities.${activityIndex}.gradeConfigs.${grade}`, updated, { shouldValidate: true, shouldDirty: true });
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

        {/* Tiết học / Khung giờ */}
        <div className="space-y-2">
          <Label htmlFor={`activity-${activityIndex}-time-${grade}`} className="text-sm font-medium">
            Tiết học / Khung giờ (Khối {grade})
          </Label>
          <Input
            id={`activity-${activityIndex}-time-${grade}`}
            type="text"
            placeholder="VD: 1, 2, 07:00 - 07:4"
            value={gradeConfig.timeSlot || ""}
            onChange={(e) => {
              const updated = {
                ...gradeConfig,
                timeSlot: e.target.value || undefined,
              };
              setValue(`activities.${activityIndex}.gradeConfigs.${grade}`, updated, { shouldValidate: true, shouldDirty: true });
            }}
            className="w-full"
          />
        </div>
      </div>
    </Card>
  );
}








