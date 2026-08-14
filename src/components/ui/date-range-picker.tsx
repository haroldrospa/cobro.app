import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Check, RotateCcw } from 'lucide-react';
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

const MONTHS = [
    { value: 0, label: 'Enero' },
    { value: 1, label: 'Febrero' },
    { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Mayo' },
    { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Septiembre' },
    { value: 9, label: 'Octubre' },
    { value: 10, label: 'Noviembre' },
    { value: 11, label: 'Diciembre' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => currentYear - 4 + i);

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
            from: startOfWeek(new Date(), { weekStartsOn: 1 }),
            to: endOfWeek(new Date(), { weekStartsOn: 1 }),
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
    const [month, setMonth] = useState<Date>(() => dateRange?.from || new Date());

    // Sincronizar el mes visible cuando cambia el rango desde fuera o al abrir
    useEffect(() => {
        if (dateRange?.from) {
            setMonth(dateRange.from);
        }
    }, [dateRange?.from?.getTime()]);

    const handlePresetClick = (preset: typeof DATE_PRESETS[0]) => {
        const range = preset.getValue();
        onDateRangeChange(range);
        if (range.from) setMonth(range.from);
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
        if (open && dateRange?.from) {
            setMonth(dateRange.from);
        }
        setIsCalendarOpen(open);
    };

    const handleQuickMonthSelect = (monthIndex: number) => {
        const targetYear = month.getFullYear();
        const targetDate = new Date(targetYear, monthIndex, 1);
        setMonth(targetDate);
        onDateRangeChange({
            from: startOfMonth(targetDate),
            to: endOfMonth(targetDate),
        });
    };

    const handleQuickYearSelect = (year: number) => {
        const targetMonth = month.getMonth();
        const targetDate = new Date(year, targetMonth, 1);
        setMonth(targetDate);
        onDateRangeChange({
            from: startOfMonth(targetDate),
            to: endOfMonth(targetDate),
        });
    };

    const selectEntireCurrentMonth = () => {
        const from = startOfMonth(month);
        const to = endOfMonth(month);
        onDateRangeChange({ from, to });
    };

    const isSameDay = (d1?: Date, d2?: Date) => {
        if (!d1 || !d2) return false;
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    const isPresetActive = (preset: typeof DATE_PRESETS[0]) => {
        if (!dateRange?.from || !dateRange?.to) return false;
        const p = preset.getValue();
        return isSameDay(dateRange.from, p.from) && isSameDay(dateRange.to, p.to);
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
                            'h-9 justify-start text-left font-semibold w-[260px] rounded-xl border-border/60 shadow-xs hover:border-primary/50 transition-all',
                            !dateRange && 'text-muted-foreground'
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        <span className="truncate">{formatDateRange()}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-border/60 bg-background overflow-hidden" align="end">
                    {/* Header bar con selección rápida de Mes y Año */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/30 border-b border-border/40">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ir a Mes:</span>
                            <Select value={month.getMonth().toString()} onValueChange={(val) => handleQuickMonthSelect(parseInt(val))}>
                                <SelectTrigger className="h-8 text-xs font-bold w-[120px] bg-background rounded-lg border-border/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {MONTHS.map(m => (
                                        <SelectItem key={m.value} value={m.value.toString()} className="text-xs font-medium">
                                            {m.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={month.getFullYear().toString()} onValueChange={(val) => handleQuickYearSelect(parseInt(val))}>
                                <SelectTrigger className="h-8 text-xs font-bold w-[85px] bg-background rounded-lg border-border/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {YEARS.map(y => (
                                        <SelectItem key={y} value={y.toString()} className="text-xs font-medium">
                                            {y}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={selectEntireCurrentMonth}
                                className="h-8 text-xs font-semibold rounded-lg px-2.5 hover:bg-primary/10 hover:text-primary border-border/50"
                                title="Seleccionar este mes completo"
                            >
                                Todo el Mes
                            </Button>
                        </div>

                        {dateRange?.from && (
                            <div className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                                {formatDateRange()}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row max-h-[550px] overflow-auto sm:overflow-visible">
                        {/* Sidebar Presets */}
                        <div className="flex flex-col gap-1 p-2 border-r border-border/40 sm:w-44 bg-muted/15">
                            <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-2 py-1">
                                Accesos Rápidos
                            </div>
                            {DATE_PRESETS.map((preset) => {
                                const active = isPresetActive(preset);
                                return (
                                    <Button
                                        key={preset.label}
                                        variant={active ? 'default' : 'ghost'}
                                        size="sm"
                                        className={cn(
                                            'justify-between font-medium text-xs h-8 rounded-lg transition-all',
                                            active
                                                ? 'bg-primary text-primary-foreground shadow-xs'
                                                : 'hover:bg-accent hover:text-accent-foreground'
                                        )}
                                        onClick={() => handlePresetClick(preset)}
                                    >
                                        <span>{preset.label}</span>
                                        {active && <Check className="h-3.5 w-3.5 ml-1 shrink-0" />}
                                    </Button>
                                );
                            })}
                            <div className="my-1 border-t border-border/40" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="justify-start font-medium text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                onClick={clearDates}
                            >
                                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                                Limpiar filtro
                            </Button>
                        </div>

                        {/* Calendar */}
                        <div className="p-3">
                            <Calendar
                                mode="range"
                                selected={dateRange}
                                month={month}
                                onMonthChange={setMonth}
                                showOutsideDays={false}
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
                            {/* Actions bar */}
                            <div className="flex items-center justify-between p-2 border-t border-border/40 mt-3">
                                <span className="text-xs text-muted-foreground font-medium">
                                    {dateRange?.from && !dateRange.to ? 'Seleccione la fecha final...' : ''}
                                </span>
                                <Button size="sm" className="h-8 px-5 text-xs font-bold rounded-lg shadow-sm" onClick={() => handleOpenChange(false)}>
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

