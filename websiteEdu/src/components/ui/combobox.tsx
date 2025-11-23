"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ComboboxOption {
  label: string
  value: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string[]
  onChange: (values: string[]) => void
}

export function Combobox({ options, value, onChange }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  // ✅ Lấy labels từ value (IDs)
  const selectedLabels = value
    .map((id) => options.find((opt) => opt.value === id)?.label)
    .filter(Boolean) as string[];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedLabels.length > 0 ? selectedLabels.join(", ") : "Chọn lớp..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Tìm lớp..." className="h-9" />
          <CommandList>
            <CommandEmpty>Không tìm thấy lớp nào.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = value.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => {
                      const newValue = isSelected
                        ? value.filter((v) => v !== opt.value)
                        : [...value, opt.value]
                      onChange(newValue)
                    }}
                  >
                    {opt.label}
                    <Check className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
