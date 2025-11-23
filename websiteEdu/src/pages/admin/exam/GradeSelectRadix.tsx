import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import React from "react";
import "./select.css";

interface GradeSelectRadixProps {
  grades: { code: string; name: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}

export default function GradeSelectRadix({ grades, value, onChange }: GradeSelectRadixProps) {
  const toggleGrade = (code: string) => {
    if (value.includes(code)) onChange(value.filter((v) => v !== code));
    else onChange([...value, code]);
  };

  return (
    <div className="relative">
      <Select.Root>
        <Select.Trigger className="radix-select-trigger">
          <span>{value.length > 0 ? value.join(", ") : "Chọn khối học"}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Select.Trigger>

        <Select.Content className="radix-select-content" position="popper">
          <Select.Viewport>
            <Select.Item
              value="Tất cả"
              className="radix-select-item text-gray-600"
              onClick={() => onChange([])}
            >
              Tất cả khối học
            </Select.Item>
            {grades.map((g) => (
              <Select.Item
                key={g.code}
                value={g.code}
                className="radix-select-item flex justify-between"
                onClick={() => toggleGrade(g.code)}
              >
                <span>Khối {g.name}</span>
                {value.includes(g.code) && (
                  <Check className="h-4 w-4 text-blue-500" />
                )}
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Root>
    </div>
  );
}
