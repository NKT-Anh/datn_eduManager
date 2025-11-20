import React from "react";
import { useFormContext } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Clock, Settings2 } from "lucide-react";
import type { Subject } from "@/types/class";

interface SubjectCardProps {
  subject: Subject;
  grade: "10" | "11" | "12";
  defaultPeriods: Record<"10" | "11" | "12", number>;
  allowConsecutive: boolean;
}

export function SubjectCard({ subject, grade, defaultPeriods, allowConsecutive }: SubjectCardProps) {
  const { watch, setValue } = useFormContext();
  const key = subject.name ?? subject._id;
  const subjectHours = watch("subjectHours") || {};
  const rule = subjectHours[key] || {
    periodsPerWeek: defaultPeriods,
    maxPeriodsPerDay: 2,
    allowConsecutive: allowConsecutive,
    session: "main" as "main" | "extra",
    gradeConfigs: {} as Record<"10" | "11" | "12", any>,
  };

  const periodsPerWeekValue = typeof rule.periodsPerWeek === 'number' 
    ? { "10": rule.periodsPerWeek, "11": rule.periodsPerWeek, "12": rule.periodsPerWeek }
    : rule.periodsPerWeek as Record<"10" | "11" | "12", number>;

  const gradeConfig = rule.gradeConfigs?.[grade] || {
    maxPeriodsPerDay: rule.maxPeriodsPerDay || 2,
    allowConsecutive: allowConsecutive,
    session: rule.session || "main",
  };

  return (
    <Card key={subject._id} className="p-4 space-y-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-base">{subject.name}</h4>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        {/* Số tiết / tuần */}
        <div className="space-y-2">
          <Label htmlFor={`${key}-periods-${grade}`} className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Số tiết / tuần
          </Label>
          <Input
            id={`${key}-periods-${grade}`}
            type="number"
            min={0}
            value={periodsPerWeekValue[grade] || 0}
            onChange={(e) => {
              const newValue = Number(e.target.value) || 0;
              const updated = { ...periodsPerWeekValue, [grade]: newValue };
              setValue(`subjectHours.${key}.periodsPerWeek`, updated, { shouldValidate: true, shouldDirty: true });
            }}
            className="w-full"
          />
        </div>

        {/* Tối đa / ngày */}
        <div className="space-y-2">
          <Label htmlFor={`${key}-max-${grade}`} className="text-sm font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            Tối đa / ngày
          </Label>
          <Input
            id={`${key}-max-${grade}`}
            type="number"
            min={1}
            value={gradeConfig.maxPeriodsPerDay || 2}
            onChange={(e) => {
              const newValue = Number(e.target.value) || 1;
              const currentGradeConfigs = rule.gradeConfigs || {};
              setValue(`subjectHours.${key}.gradeConfigs.${grade}.maxPeriodsPerDay`, newValue, { shouldValidate: true, shouldDirty: true });
            }}
            className="w-full"
          />
        </div>
      </div>
    </Card>
  );
}







