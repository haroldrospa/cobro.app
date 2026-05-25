import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Clock, Save } from 'lucide-react';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useToast } from '@/hooks/use-toast';

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
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Horarios de Atención
                </CardTitle>
                <CardDescription>
                    Define los horarios en que tu tienda está abierta al público.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    {DAYS.map((day) => {
                        const dayConfig = hours[day.key] || DEFAULT_HOURS[day.key as keyof typeof DEFAULT_HOURS];
                        const isClosed = dayConfig.closed;

                        return (
                            <div key={day.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg border bg-card/50">
                                <div className="flex items-center gap-3 min-w-[120px]">
                                    <Switch
                                        id={`closed-${day.key}`}
                                        checked={!isClosed}
                                        onCheckedChange={(checked) => handleToggleClosed(day.key, !checked)}
                                    />
                                    <Label htmlFor={`closed-${day.key}`} className={`font-medium ${isClosed ? 'text-muted-foreground' : ''}`}>
                                        {day.label}
                                    </Label>
                                </div>

                                <div className="flex items-center gap-2 flex-1">
                                    {isClosed ? (
                                        <span className="text-sm text-muted-foreground italic px-2">Cerrado</span>
                                    ) : (
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                                                <Input
                                                    type="time"
                                                    value={dayConfig.open}
                                                    onChange={(e) => handleTimeChange(day.key, 'open', e.target.value)}
                                                    className="w-full sm:w-32"
                                                />
                                                <Input
                                                    type="time"
                                                    value={dayConfig.close}
                                                    onChange={(e) => handleTimeChange(day.key, 'close', e.target.value)}
                                                    className="w-full sm:w-32"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={isUpdating}>
                        <Save className="h-4 w-4 mr-2" />
                        {isUpdating ? 'Guardando...' : 'Guardar Horarios'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default StoreHoursSection;
