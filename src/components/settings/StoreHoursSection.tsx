import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Clock, Save, Loader2 } from 'lucide-react';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const DAYS = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
];

const DEFAULT_HOURS = {
    monday: { open: '08:00', close: '18:00', closed: false },
    tuesday: { open: '08:00', close: '18:00', closed: false },
    wednesday: { open: '08:00', close: '18:00', closed: false },
    thursday: { open: '08:00', close: '18:00', closed: false },
    friday: { open: '08:00', close: '18:00', closed: false },
    saturday: { open: '09:00', close: '13:00', closed: false },
    sunday: { open: '00:00', close: '00:00', closed: true },
};

const StoreHoursSection = () => {
    const { settings, updateSettings, isUpdating } = useStoreSettings();
    const { toast } = useToast();
    const [hours, setHours] = useState<any>(DEFAULT_HOURS);

    useEffect(() => {
        if (settings?.business_hours && !isUpdating) {
            setHours(settings.business_hours);
        }
    }, [settings?.business_hours, isUpdating]);

    const handleTimeChange = (day: string, type: 'open' | 'close', value: string) => {
        setHours(prev => ({
            ...prev,
            [day]: { ...prev[day], [type]: value }
        }));
    };

    const handleToggleClosed = (day: string, closed: boolean) => {
        setHours(prev => ({
            ...prev,
            [day]: { ...prev[day], closed }
        }));
    };

    const handleSave = async () => {
        try {
            await updateSettings({ business_hours: hours });
            toast({
                title: "Horarios guardados",
                description: "Los horarios de atención se han actualizado correctamente.",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudieron guardar los horarios.",
                variant: "destructive",
            });
        }
    };

    return (
        <Card className="border border-border/40 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/10 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                    <Clock className="h-5 w-5 text-emerald-500" />
                    Horarios de Atención
                </CardTitle>
                <CardDescription>
                    Define los horarios en que tu tienda está abierta al público.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6 bg-card/10">
                <div className="space-y-3">
                    {DAYS.map((day) => {
                        const dayConfig = hours[day.key] || DEFAULT_HOURS[day.key as keyof typeof DEFAULT_HOURS];
                        const isClosed = dayConfig.closed;

                        return (
                            <div key={day.key} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors">
                                {/* Left side: Switch + Label */}
                                <div className="flex items-center gap-2.5 flex-shrink-0">
                                    <Switch
                                        id={`closed-${day.key}`}
                                        checked={!isClosed}
                                        onCheckedChange={(checked) => handleToggleClosed(day.key, !checked)}
                                        className="data-[state=checked]:bg-emerald-500 scale-90 sm:scale-100"
                                    />
                                    <Label htmlFor={`closed-${day.key}`} className={cn("text-xs sm:text-sm font-bold cursor-pointer transition-colors", isClosed ? 'text-muted-foreground line-through opacity-65' : 'text-foreground')}>
                                        {day.label}
                                    </Label>
                                </div>

                                {/* Right side: Inline inputs or Closed pill */}
                                <div className="flex items-center justify-end flex-1 min-w-0">
                                    {isClosed ? (
                                        <span className="text-[10px] sm:text-xs text-muted-foreground/60 italic font-bold bg-muted/60 px-3 py-1 rounded-lg border border-border/20">
                                            Cerrado
                                        </span>
                                    ) : (
                                        <div className="flex items-center gap-1.5 w-full max-w-[200px] sm:max-w-none justify-end">
                                            <Input
                                                type="time"
                                                value={dayConfig.open}
                                                onChange={(e) => handleTimeChange(day.key, 'open', e.target.value)}
                                                className="w-20 sm:w-28 text-center px-1 text-xs sm:text-sm h-8 sm:h-9 [&::-webkit-calendar-picker-indicator]:hidden bg-background border-border/50 rounded-lg shadow-sm"
                                            />
                                            <span className="text-zinc-500 text-[10px] sm:text-xs font-semibold px-0.5 shrink-0">a</span>
                                            <Input
                                                type="time"
                                                value={dayConfig.close}
                                                onChange={(e) => handleTimeChange(day.key, 'close', e.target.value)}
                                                className="w-20 sm:w-28 text-center px-1 text-xs sm:text-sm h-8 sm:h-9 [&::-webkit-calendar-picker-indicator]:hidden bg-background border-border/50 rounded-lg shadow-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end pt-2 border-t border-border/10">
                    <Button 
                        onClick={handleSave} 
                        disabled={isUpdating}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/10 rounded-xl font-bold"
                    >
                        {isUpdating ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Guardar Horarios
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default StoreHoursSection;
