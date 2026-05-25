import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import {
    format,
    subDays,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
    startOfWeek,
    endOfWeek,
    subMonths,
    startOfDay,
    endOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
    dateRange: DateRange | undefined;
    onDateRangeChange: (range: DateRange | undefined) => void;
    className?: string;
}

const DATE_PRESETS = [
    {
        label: 'Hoy',
        getValue: () => ({
            from: startOfDay(new Date()),
            to: endOfDay(new Date()),
        }),
    },
    {
        label: 'Ayer',
        getValue: () => {
            const yesterday = subDays(new Date(), 1);
            return {
                from: startOfDay(yesterday),
                to: endOfDay(yesterday),
            };
        },
    },
    {
        label: 'Esta semana',
        getValue: () => ({
            from: startOfWeek(new Date(), { weekStartsOn: 1 }), // Lunes
            to: endOfWeek(new Date(), { weekStartsOn: 1 }), // Domingo
        }),
    },
    {
        label: 'Últimos 7 días',
        getValue: () => ({
            from: startOfDay(subDays(new Date(), 6)),
            to: endOfDay(new Date()),
        }),
    },
    {
        label: 'Últimos 30 días',
        getValue: () => ({
            from: startOfDay(subDays(new Date(), 29)),
            to: endOfDay(new Date()),
        }),
    },
    {
        label: 'Este mes',
        getValue: () => ({
            from: startOfMonth(new Date()),
            to: endOfMonth(new Date()),
        }),
    },
    {
        label: 'Mes pasado',
        getValue: () => {
            const lastMonth = subMonths(new Date(), 1);
            return {
                from: startOfMonth(lastMonth),
                to: endOfMonth(lastMonth),
            };
        },
    },
    {
        label: 'Este año',
        getValue: () => ({
            from: startOfYear(new Date()),
            to: endOfYear(new Date()),
        }),
    },
    {
        label: 'Últimos 3 meses',
        getValue: () => ({
            from: startOfDay(subMonths(new Date(), 3)),
            to: endOfDay(new Date()),
        }),
    },
    {
        label: 'Este último año',
        getValue: () => ({
            from: startOfDay(subMonths(new Date(), 12)),
            to: endOfDay(new Date()),
        }),
    },
];

export const DateRangePicker = ({ dateRange, onDateRangeChange, className }: DateRangePickerProps) => {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const handlePresetClick = (preset: typeof DATE_PRESETS[0]) => {
        onDateRangeChange(preset.getValue());
        setIsCalendarOpen(false);
    };

    const clearDates = () => {
        onDateRangeChange(undefined);
    };

    const formatDateRange = () => {
        if (!dateRange?.from) return 'Seleccionar rango';

        if (dateRange.to) {
            return `${format(dateRange.from, 'dd/MM/yyyy', { locale: es })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: es })}`;
        }

        return format(dateRange.from, 'dd/MM/yyyy', { locale: es });
    };

    const handleOpenChange = (open: boolean) => {
        if (!open && dateRange?.from && !dateRange.to) {
            onDateRangeChange({
                from: dateRange.from,
                to: endOfDay(dateRange.from)
            });
        }
        setIsCalendarOpen(open);
    };

    return (
        <div className={cn('grid gap-2', className)}>
            <Popover open={isCalendarOpen} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant="outline"
                        size="sm"
                        className={cn(
                            'h-9 justify-start text-left font-normal w-[260px]',
                            !dateRange && 'text-muted-foreground'
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formatDateRange()}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <div className="flex flex-col sm:flex-row max-h-[500px] overflow-auto sm:overflow-visible">
                        {/* Sidebar Presets */}
                        <div className="flex flex-col gap-1 p-2 border-r sm:w-40 bg-muted/10">
                            {DATE_PRESETS.map((preset) => (
                                <Button
                                    key={preset.label}
                                    variant="ghost"
                                    size="sm"
                                    className="justify-start font-normal text-xs h-8"
                                    onClick={() => handlePresetClick(preset)}
                                >
                                    {preset.label}
                                </Button>
                            ))}
                            <div className="my-1 border-t" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="justify-start font-normal text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={clearDates}
                            >
                                Limpiar filtro
                            </Button>
                        </div>

                        {/* Calendar */}
                        <div className="p-2">
                            <Calendar
                                key={`${dateRange?.from?.getTime()}-${dateRange?.to?.getTime()}`}
                                mode="range"
                                selected={dateRange}
                                onSelect={(range) => {
                                    if (range) {
                                        onDateRangeChange({
                                            from: range.from ? startOfDay(range.from) : undefined,
                                            to: range.to ? endOfDay(range.to) : undefined,
                                        });
                                    } else {
                                        onDateRangeChange(undefined);
                                    }
                                }}
                                locale={es}
                                numberOfMonths={2}
                                initialFocus
                            />
                            {/* Close helper for mobile/when done */}
                            <div className="flex justify-end p-2 border-t mt-2">
                                <Button size="sm" className="h-7 text-xs" onClick={() => handleOpenChange(false)}>
                                    Listo
                                </Button>
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};
