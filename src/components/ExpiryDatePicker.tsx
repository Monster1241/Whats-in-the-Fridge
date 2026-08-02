import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

function parseIsoDate(value: string | null | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toIsoDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type ExpiryDatePickerProps = {
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
  id?: string;
};

/**
 * Expiry date picker backed by shadcn Calendar (react-day-picker).
 * Value is always YYYY-MM-DD to match inventory storage.
 */
export function ExpiryDatePicker({ value, onChange, className, id }: ExpiryDatePickerProps) {
  const selected = parseIsoDate(value);

  return (
    <div id={id} className={cn('flex flex-col items-center', className)}>
      <Calendar
        mode="single"
        selected={selected}
        onSelect={(date) => {
          if (date) onChange(toIsoDateOnly(date));
        }}
        defaultMonth={selected}
        className="rounded-lg border border-border bg-background p-2 shadow-sm"
      />
      <p className="mt-2 text-center text-xs text-muted-foreground" role="status" aria-live="polite">
        {selected
          ? `Use by ${selected.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}`
          : 'Pick a use-by date'}
      </p>
    </div>
  );
}
