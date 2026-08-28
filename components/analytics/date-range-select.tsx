"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DATE_RANGE_LABELS,
  type DateRangePreset,
} from "@/lib/state/analytics-state";

const PRESETS: DateRangePreset[] = ["all", "7d", "30d"];

interface DateRangeSelectProps {
  value: DateRangePreset;
  onChange: (value: DateRangePreset) => void;
}

/**
 * The dashboard's reporting window.
 *
 * Always visible, and defaulted to "All time". The analytics endpoints
 * deliberately ship no default window so a dashboard cannot silently report a
 * rolling 30 days as if it were the whole history — the label on screen is
 * what keeps that promise on the client side.
 */
export function DateRangeSelect({ value, onChange }: DateRangeSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DateRangePreset)}>
      <SelectTrigger aria-label="Reporting window">
        <SelectValue placeholder="Reporting window" />
      </SelectTrigger>
      <SelectContent>
        {PRESETS.map((preset) => (
          <SelectItem key={preset} value={preset}>
            {DATE_RANGE_LABELS[preset]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
