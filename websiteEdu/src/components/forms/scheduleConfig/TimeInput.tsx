import React from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TimeInputProps {
  name: string;
  label: string;
  placeholder?: string;
}

export function TimeInput({ name, label, placeholder = "HH:mm" }: TimeInputProps) {
  const { watch, setValue } = useFormContext();
  const value = watch(name) || "";

  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={name}
        type="time"
        value={value}
        onChange={(e) => {
          setValue(name, e.target.value, { shouldValidate: true, shouldDirty: true });
        }}
        placeholder={placeholder}
        className="w-full"
      />
    </div>
  );
}








