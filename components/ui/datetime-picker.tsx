"use client";

import * as React from "react";
import {
  format,
  addMonths,
  subMonths,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  startOfDay,
} from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value?: string; // Expects "YYYY-MM-DDTHH:mm" format or ""
  onChange: (value: string) => void;
  min?: string; // "YYYY-MM-DDTHH:mm"
  max?: string; // "YYYY-MM-DDTHH:mm"
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({
  value = "",
  onChange,
  min = "",
  max = "",
  placeholder = "Select Date & Time",
  className,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Parse current value or use safe defaults
  const parsedValue = React.useMemo(() => {
    if (!value) return null;
    try {
      return new Date(value);
    } catch {
      return null;
    }
  }, [value]);

  const [currentMonth, setCurrentMonth] = React.useState(
    parsedValue || new Date()
  );
  
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(
    parsedValue
  );

  // Time states: separate inputs to format "HH:mm"
  const [selectedHour, setSelectedHour] = React.useState<string>(
    parsedValue ? format(parsedValue, "hh") : "12"
  );
  const [selectedMinute, setSelectedMinute] = React.useState<string>(
    parsedValue ? format(parsedValue, "mm") : "00"
  );
  const [selectedAmPm, setSelectedAmPm] = React.useState<"AM" | "PM">(
    parsedValue ? (format(parsedValue, "a") as "AM" | "PM") : "PM"
  );

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const commitChange = (date: Date | null, h: string, m: string, ampm: "AM" | "PM") => {
    if (!date) {
      onChange("");
      return;
    }

    let hour24 = parseInt(h);
    if (ampm === "PM" && hour24 < 12) hour24 += 12;
    if (ampm === "AM" && hour24 === 12) hour24 = 0;

    const newDate = new Date(date);
    newDate.setHours(hour24, parseInt(m), 0, 0);

    // Auto-adjust if selection is in the past (e.g., initialized states)
    const minD = min ? new Date(min) : null;
    let finalDate = newDate;

    if (minD && newDate < minD) {
      finalDate = minD;
      setSelectedHour(format(minD, "hh"));
      setSelectedMinute(format(minD, "mm"));
      setSelectedAmPm(format(minD, "a") as "AM" | "PM");
    }

    const maxD = max ? new Date(max) : null;
    if (maxD && finalDate > maxD) {
      finalDate = maxD;
      setSelectedHour(format(maxD, "hh"));
      setSelectedMinute(format(maxD, "mm"));
      setSelectedAmPm(format(maxD, "a") as "AM" | "PM");
    }

    const year = finalDate.getFullYear();
    const month = String(finalDate.getMonth() + 1).padStart(2, '0');
    const day = String(finalDate.getDate()).padStart(2, '0');
    const hoursStr = String(finalDate.getHours()).padStart(2, '0');
    const minutesStr = String(finalDate.getMinutes()).padStart(2, '0');

    onChange(`${year}-${month}-${day}T${hoursStr}:${minutesStr}`);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    commitChange(date, selectedHour, selectedMinute, selectedAmPm);
  };

  const handleTimeSelect = (type: "h" | "m" | "am", val: string) => {
    let nextH = selectedHour;
    let nextM = selectedMinute;
    let nextAmPm = selectedAmPm;

    if (type === "h") {
      nextH = val;
      setSelectedHour(val);
    } else if (type === "m") {
      nextM = val;
      setSelectedMinute(val);
    } else {
      nextAmPm = val as "AM" | "PM";
      setSelectedAmPm(val as "AM" | "PM");
    }

    if (selectedDate) {
      commitChange(selectedDate, nextH, nextM, nextAmPm);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setSelectedHour(format(now, "hh"));
    setSelectedMinute(format(now, "mm"));
    setSelectedAmPm(format(now, "a") as "AM" | "PM");
    commitChange(now, format(now, "hh"), format(now, "mm"), format(now, "a") as "AM" | "PM");
    setCurrentMonth(now);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedDate(null);
    setSelectedHour("12");
    setSelectedMinute("00");
    setSelectedAmPm("PM");
    onChange("");
    setIsOpen(false);
  };

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")); // Increments of 5

  const minDate = min ? new Date(min) : null;
  const isTodaySelected = selectedDate && minDate && startOfDay(selectedDate).getTime() === startOfDay(minDate).getTime();
  const maxDate = max ? new Date(max) : null;
  const isTodaySelectedMax = selectedDate && maxDate && startOfDay(selectedDate).getTime() === startOfDay(maxDate).getTime();

  const isHourDisabled = (h: string) => {
    let h24 = parseInt(h);
    if (selectedAmPm === "PM" && h24 < 12) h24 += 12;
    if (selectedAmPm === "AM" && h24 === 12) h24 = 0;

    let tooEarly = false;
    let tooLate = false;

    if (isTodaySelected && minDate) {
       tooEarly = h24 < minDate.getHours();
    }
    
    if (isTodaySelectedMax && maxDate) {
       tooLate = h24 > maxDate.getHours();
    }

    return tooEarly || tooLate;
  };

  const isMinuteDisabled = (m: string) => {
    let h24 = parseInt(selectedHour);
    if (selectedAmPm === "PM" && h24 < 12) h24 += 12;
    if (selectedAmPm === "AM" && h24 === 12) h24 = 0;

    let tooEarly = false;
    let tooLate = false;

    if (isTodaySelected && minDate) {
      if (h24 === minDate.getHours()) {
        tooEarly = parseInt(m) < minDate.getMinutes();
      } else if (h24 < minDate.getHours()) {
        tooEarly = true;
      }
    }

    if (isTodaySelectedMax && maxDate) {
      if (h24 === maxDate.getHours()) {
        tooLate = parseInt(m) > maxDate.getMinutes();
      } else if (h24 > maxDate.getHours()) {
        tooLate = true;
      }
    }

    return tooEarly || tooLate;
  };

  const isAmPmDisabled = (ampm: string) => {
    let tooEarly = false;
    let tooLate = false;

    if (isTodaySelected && minDate) {
      if (ampm === "AM" && minDate.getHours() >= 12) tooEarly = true;
    }
    if (isTodaySelectedMax && maxDate) {
      if (ampm === "PM" && maxDate.getHours() < 12) tooLate = true;
    }
    return tooEarly || tooLate;
  };

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-11 w-full items-center justify-between rounded-xl border border-input bg-background px-4 text-sm shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span>
              {selectedDate
                ? format(new Date(value), "dd/MM/yyyy, hh:mm a")
                : placeholder}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={8}
          className="z-50 rounded-2xl border border-border bg-popover/95 text-popover-foreground shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 overflow-hidden w-105"
        >
          <div className="flex divide-x divide-border">
            {/* Calendar Section */}
            <div className="p-4 flex-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold font-heading">
                  {format(currentMonth, "MMMM yyyy")}
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground mb-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <div key={day} className="h-7 flex items-center justify-center">
                    {day}
                  </div>
                ))}
              </div>

              {/* Grid Days */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, idx) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const minDate = min ? new Date(min) : null;
                  const maxDate = max ? new Date(max) : null;
                  const isDisabled = !isCurrentMonth || 
                    (minDate ? startOfDay(day) < startOfDay(minDate) : false) ||
                    (maxDate ? startOfDay(day) > startOfDay(maxDate) : false);

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleDateSelect(day)}
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all",
                        isCurrentMonth ? "hover:bg-accent hover:text-accent-foreground" : "text-muted-foreground/30",
                        isDisabled && "opacity-40 cursor-not-allowed pointer-events-none hover:bg-transparent",
                        isSelected && "bg-primary text-primary-foreground font-bold hover:bg-primary/90",
                        isToday && !isSelected && "border border-primary/40 text-primary"
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Tracking Section */}
            <div className="w-35 flex flex-col p-4 bg-muted/20">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                <Clock className="h-3.5 w-3.5" />
                Time
              </div>

              <div className="flex-1 flex gap-2 h-50 overflow-hidden">
                {/* Hour Column */}
                <div className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar scroll-smooth">
                  {hours.map((h) => {
                    const isDisabled = isHourDisabled(h);
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleTimeSelect("h", h)}
                        className={cn(
                          "h-8 rounded-lg flex items-center justify-center text-xs font-medium shrink-0 hover:bg-muted transition-colors",
                          selectedHour === h && "bg-primary text-primary-foreground font-bold hover:bg-primary/90",
                          isDisabled && "opacity-40 cursor-not-allowed pointer-events-none hover:bg-transparent"
                        )}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>

                {/* Minute Column */}
                <div className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar scroll-smooth">
                  {minutes.map((m) => {
                    const isDisabled = isMinuteDisabled(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleTimeSelect("m", m)}
                        className={cn(
                          "h-8 rounded-lg flex items-center justify-center text-xs font-medium shrink-0 hover:bg-muted transition-colors",
                          selectedMinute === m && "bg-primary text-primary-foreground font-bold hover:bg-primary/90",
                          isDisabled && "opacity-40 cursor-not-allowed pointer-events-none hover:bg-transparent"
                        )}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>

                {/* AM/PM */}
                <div className="flex flex-col gap-1 h-fit">
                  {["AM", "PM"].map((am) => {
                    const isDisabled = isAmPmDisabled(am);
                    return (
                      <button
                        key={am}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleTimeSelect("am", am)}
                        className={cn(
                          "h-8 px-2 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-muted transition-colors",
                          selectedAmPm === am && "bg-primary text-primary-foreground hover:bg-primary/90",
                          isDisabled && "opacity-40 cursor-not-allowed pointer-events-none hover:bg-transparent"
                        )}
                      >
                        {am}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex justify-between items-center p-3 border-t border-border bg-muted/10 h-12">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
            >
              Today
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// Help satisfy missing icons
const ChevronDown = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
