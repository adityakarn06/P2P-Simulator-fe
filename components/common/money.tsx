import { formatCurrencyFromPaise, formatCurrencyCompact } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface MoneyProps {
  /** Integer paise — never a float */
  paise: number;
  /** Render compact notation: ₹1.82L instead of ₹1,820.00 */
  compact?: boolean;
  className?: string;
}

export function Money({ paise, compact = false, className }: MoneyProps) {
  const formatted = compact
    ? formatCurrencyCompact(paise)
    : formatCurrencyFromPaise(paise);

  return (
    <span
      className={cn("tabular-nums", className)}
      title={compact ? formatCurrencyFromPaise(paise) : undefined}
    >
      {formatted}
    </span>
  );
}
