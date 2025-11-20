import React from "react";
import { useFormContext } from "react-hook-form";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  name: string;
  label: string;
  placeholder?: string;
}

export function DatePicker({ name, label, placeholder = "Chọn ngày" }: DatePickerProps) {
  const { watch, setValue } = useFormContext();
  const value = watch(name);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(new Date(value), "dd/MM/yyyy", { locale: vi }) : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={(date) => {
              setValue(name, date ? format(date, "yyyy-MM-dd") : null, { shouldValidate: true, shouldDirty: true });
            }}
            initialFocus
            locale={vi}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}







