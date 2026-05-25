import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import {
    differenceInSeconds,
    format,
    startOfDay,
    startOfWeek,
    startOfMonth,
    subDays,
    parseISO,
    isValid,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Loader2, TrendingUp, Clock, CheckCircle2, AlertTriangle, Zap, Star, Package, ChefHat, CalendarRange, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─── Types ──────────────────────────────────────────────────────────────────
interface OrderItem {
    id: string;
    product_name: string;
    quantity: number;
}

interface CompletedOrder {
    id: string;
    order_number: string;
    customer_name: string;
    created_at: string;
    updated_at: string;
    order_status: string;
    notes?: string;
    open_order_items: OrderItem[];
}

type DateRangePreset = 'today' | 'week' | 'month' | '30days' | 'custom';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const fmtTimeLabel = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

// ─── Subcomponents ───────────────────────────────────────────────────────────
const KpiCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
    color: string;
}> = ({ icon, label, value, sub, color }) => (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-2`}>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
            {icon}
        </div>
        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black text-white leading-none">{value}</p>
        {sub && <p className="text-[11px] text-zinc-500 leading-snug">{sub}</p>}
    </div>
);

// ─── Custom Date Range Picker Inline ─────────────────────────────────────────
const CustomRangePicker: React.FC<{
    fromDate: string;
    toDate: string;
    onFromChange: (v: string) => void;
    onToChange: (v: string) => void;
    onClose: () => void;
}> = ({ fromDate, toDate, onFromChange, onToChange, onClose }) => (
    <div className="flex items-center gap-2 bg-zinc-900 border border-primary/40 rounded-xl px-3 py-2 shadow-xl animate-fade-in">
        <CalendarRange className="h-4 w-4 text-primary shrink-0" />
        <div className="flex items-center gap-1.5 flex-wrap">
            <label className="text-[10px] text-zinc-500 font-bold uppercase">Desde</label>
            <input
                type="date"
                value={fromDate}
                onChange={(e) => onFromChange(e.target.value)}
                className="bg-zinc-800 text-white text-xs rounded-lg px-2 py-1.5 border border-zinc-700 focus:border-primary outline-none w-[130px]"
            />
            <label className="text-[10px] text-zinc-500 font-bold uppercase">Hasta</label>
            <input
                type="date"
                value={toDate}
                onChange={(e) => onToChange(e.target.value)}
                className="bg-zinc-800 text-white text-xs rounded-lg px-2 py-1.5 border border-zinc-700 focus:border-primary outline-none w-[130px]"
            />
        </div>
        <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors ml-1"
            title="Cerrar selector"
        >
            <X className="h-4 w-4" />
        </button>
    </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────
const KitchenPerformanceDashboard: React.FC = () => {
    const { data: userStore } = useUserStore();
    const { settings } = useStoreSettings();
    const [range, setRange] = useState<DateRangePreset>('today');

    // Custom range state
    const today = format(new Date(), 'yyyy-MM-dd');
    const [customFrom, setCustomFrom] = useState(today);
    const [customTo, setCustomTo] = useState(today);

    // Thresholds from kitchen settings
    const yellowThreshold = (settings.kitchen_yellow_threshold || 5) * 60;
    const redThreshold = (settings.kitchen_red_threshold || 10) * 60;
    const alertThreshold = (settings.kitchen_alert_threshold || 15) * 60;

    const rangeStart = useMemo(() => {
        const now = new Date();
        if (range === 'today') return startOfDay(now);
        if (range === 'week') return startOfWeek(now, { locale: es });
        if (range === 'month') return startOfMonth(now);
        if (range === 'custom') {
            const parsed = parseISO(customFrom);
            return isValid(parsed) ? startOfDay(parsed) : startOfDay(now);
        }
        return subDays(now, 30);
    }, [range, customFrom]);

    const rangeEnd = useMemo(() => {
        if (range === 'custom') {
            const parsed = parseISO(customTo);
            if (isValid(parsed)) {
                const end = new Date(parsed);
                end.setHours(23, 59, 59, 999);
                return end;
            }
        }
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return end;
    }, [range, customTo]);

    const { data: orders = [], isLoading } = useQuery<CompletedOrder[]>({
        queryKey: ['kitchen-performance', userStore?.id, range, customFrom, customTo],
        queryFn: async () => {
            if (!userStore?.id) return [];
            const { data, error } = await supabase
                .from('open_orders')
                .select('*, open_order_items(*)')
                .eq('store_id', userStore.id)
                .in('order_status', ['completed', 'shipped', 'paid', 'ready'])
                .gte('updated_at', rangeStart.toISOString())
                .lte('updated_at', rangeEnd.toISOString())
                .order('updated_at', { ascending: false });
            if (error) throw error;
            return (data ?? []) as CompletedOrder[];
        },
        enabled: !!userStore?.id,
        refetchInterval: 30000,
    });

    // ── Computed metrics ────────────────────────────────────────────────────
    const metrics = useMemo(() => {
        if (!orders.length) return null;

        const cookTimes = orders.map(o =>
            differenceInSeconds(new Date(o.updated_at), new Date(o.created_at))
        ).filter(t => t > 0);

        const avg = cookTimes.length
            ? Math.round(cookTimes.reduce((a, b) => a + b, 0) / cookTimes.length)
            : 0;
        const fastest = cookTimes.length ? Math.min(...cookTimes) : 0;
        const slowest = cookTimes.length ? Math.max(...cookTimes) : 0;

        const onTime = orders.filter((o, i) => cookTimes[i] < alertThreshold).length;
        const late = orders.length - onTime;
        const onTimeRate = orders.length ? Math.round((onTime / orders.length) * 100) : 0;

        const beforeYellow = orders.filter((o, i) => cookTimes[i] < yellowThreshold).length;
        const yellowToRed = orders.filter((o, i) => cookTimes[i] >= yellowThreshold && cookTimes[i] < redThreshold).length;
        const redToAlert = orders.filter((o, i) => cookTimes[i] >= redThreshold && cookTimes[i] < alertThreshold).length;
        const overAlert = orders.filter((o, i) => cookTimes[i] >= alertThreshold).length;

        const productMap: Record<string, number> = {};
        orders.forEach(o =>
            o.open_order_items?.forEach(item => {
                const name = item.product_name.split('(')[0].trim();
                productMap[name] = (productMap[name] || 0) + (item.quantity || 1);
            })
        );
        const topProducts = Object.entries(productMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([name, count]) => ({ name, count }));

        const hourMap: Record<number, number> = {};
        orders.forEach(o => {
            const h = new Date(o.updated_at).getHours();
            hourMap[h] = (hourMap[h] || 0) + 1;
        });
        const hourlyData = Array.from({ length: 24 }, (_, h) => ({
            hour: `${h}h`,
            pedidos: hourMap[h] || 0,
        })).filter(d => d.pedidos > 0);

        const pieData = [
            { name: `Excelente (<${yellowThreshold / 60}m)`, value: beforeYellow, fill: '#10b981' },
            { name: `Bueno`, value: yellowToRed, fill: '#f59e0b' },
            { name: `Lento`, value: redToAlert, fill: '#ef4444' },
            { name: `Tardío (>${alertThreshold / 60}m)`, value: overAlert, fill: '#7f1d1d' },
        ].filter(d => d.value > 0);

        const detailedOrders = orders.map((o, i) => ({
            ...o,
            cookTime: cookTimes[i] ?? 0,
            isLate: (cookTimes[i] ?? 0) >= alertThreshold,
            isOnTime: (cookTimes[i] ?? 0) < yellowThreshold,
        }));

        return {
            total: orders.length,
            avg,
            fastest,
            slowest,
            onTime,
            late,
            onTimeRate,
            topProducts,
            hourlyData,
            pieData,
            detailedOrders,
        };
    }, [orders, alertThreshold, yellowThreshold, redThreshold]);

    // ── Range label for display ─────────────────────────────────────────────
    const rangeSummary = useMemo(() => {
        if (range === 'custom') {
            if (customFrom === customTo) return format(parseISO(customFrom), "d 'de' MMMM", { locale: es });
            return `${format(parseISO(customFrom), 'd MMM', { locale: es })} – ${format(parseISO(customTo), 'd MMM yyyy', { locale: es })}`;
        }
        return null;
    }, [range, customFrom, customTo]);

    // ── Render ──────────────────────────────────────────────────────────────
    const presets: { key: DateRangePreset; label: string }[] = [
        { key: 'today', label: 'Hoy' },
        { key: 'week', label: 'Esta semana' },
        { key: 'month', label: 'Este mes' },
        { key: '30days', label: 'Últ. 30 días' },
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-zinc-950 text-white p-4 space-y-5">
            {/* Header + Range Selector */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center">
                            <ChefHat className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-base font-black uppercase tracking-tight">Rendimiento de Cocina</h2>
                            <p className="text-[11px] text-zinc-500">
                                {rangeSummary ? rangeSummary : 'Análisis de productividad y tiempos'}
                            </p>
                        </div>
                    </div>

                    {/* Preset buttons + custom button */}
                    <div className="flex flex-wrap gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                        {presets.map(r => (
                            <button
                                key={r.key}
                                onClick={() => setRange(r.key)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${range === r.key
                                    ? 'bg-primary text-primary-foreground shadow'
                                    : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                {r.label}
                            </button>
                        ))}
                        {/* Custom range trigger */}
                        <button
                            onClick={() => setRange('custom')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${range === 'custom'
                                ? 'bg-primary text-primary-foreground shadow'
                                : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            <CalendarRange className="h-3.5 w-3.5" />
                            Personalizado
                        </button>
                    </div>
                </div>

                {/* Custom date inputs — only shown when 'custom' is selected */}
                {range === 'custom' && (
                    <div className="flex justify-end">
                        <CustomRangePicker
                            fromDate={customFrom}
                            toDate={customTo}
                            onFromChange={(v) => {
                                setCustomFrom(v);
                                // Ensure 'to' is not before 'from'
                                if (customTo < v) setCustomTo(v);
                            }}
                            onToChange={(v) => {
                                setCustomTo(v);
                                if (v < customFrom) setCustomFrom(v);
                            }}
                            onClose={() => setRange('today')}
                        />
                    </div>
                )}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            )}

            {/* Empty */}
            {!isLoading && !metrics && (
                <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                    <ChefHat className="h-16 w-16 mb-3" />
                    <p className="text-xl font-black uppercase">Sin datos</p>
                    <p className="text-xs mt-1">No hay pedidos completados en este período</p>
                </div>
            )}

            {metrics && (
                <>
                    {/* ── KPI Cards ── */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <KpiCard
                            icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                            label="Total Procesados"
                            value={String(metrics.total)}
                            sub="pedidos completados"
                            color="bg-emerald-500/15"
                        />
                        <KpiCard
                            icon={<Clock className="h-5 w-5 text-blue-400" />}
                            label="Tiempo Promedio"
                            value={fmtTime(metrics.avg)}
                            sub="por pedido"
                            color="bg-blue-500/15"
                        />
                        <KpiCard
                            icon={<Zap className="h-5 w-5 text-yellow-400" />}
                            label="Más Rápido"
                            value={fmtTime(metrics.fastest)}
                            sub="tiempo mínimo"
                            color="bg-yellow-500/15"
                        />
                        <KpiCard
                            icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
                            label="Más Lento"
                            value={fmtTime(metrics.slowest)}
                            sub="tiempo máximo"
                            color="bg-red-500/15"
                        />
                        <KpiCard
                            icon={<TrendingUp className="h-5 w-5 text-primary" />}
                            label="En Tiempo"
                            value={`${metrics.onTimeRate}%`}
                            sub={`${metrics.onTime} de ${metrics.total}`}
                            color="bg-primary/15"
                        />
                        <KpiCard
                            icon={<Star className="h-5 w-5 text-orange-400" />}
                            label="Tardíos"
                            value={String(metrics.late)}
                            sub={`>${Math.round(alertThreshold / 60)}m (alerta)`}
                            color="bg-orange-500/15"
                        />
                    </div>

                    {/* ── On-time vs Late Banner ── */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
                            Distribución por Tiempo de Entrega
                        </p>
                        <div className="w-full h-4 rounded-full overflow-hidden flex gap-0.5">
                            {metrics.pieData.map(d => (
                                <div
                                    key={d.name}
                                    style={{
                                        width: `${(d.value / metrics.total) * 100}%`,
                                        backgroundColor: d.fill,
                                    }}
                                    className="h-full transition-all"
                                    title={`${d.name}: ${d.value}`}
                                />
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-3">
                            {metrics.pieData.map(d => (
                                <div key={d.name} className="flex items-center gap-1.5">
                                    <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.fill }} />
                                    <span className="text-[11px] text-zinc-400">
                                        {d.name} — <span className="text-white font-bold">{d.value}</span>
                                        <span className="text-zinc-600"> ({Math.round((d.value / metrics.total) * 100)}%)</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Charts Row ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Hourly Distribution */}
                        {metrics.hourlyData.length > 0 && (
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">
                                    Pedidos por Hora del Día
                                </p>
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={metrics.hourlyData} barSize={16}>
                                        <XAxis dataKey="hour" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={20} />
                                        <Tooltip
                                            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                                            itemStyle={{ color: '#fff' }}
                                            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                        />
                                        <Bar dataKey="pedidos" radius={[4, 4, 0, 0]}>
                                            {metrics.hourlyData.map((entry, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={entry.pedidos === Math.max(...metrics.hourlyData.map(d => d.pedidos))
                                                        ? '#22c55e' : '#3f3f46'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Product Leaderboard */}
                        {metrics.topProducts.length > 0 && (
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Package className="h-3.5 w-3.5" />
                                    Productos Más Preparados
                                </p>
                                <div className="space-y-2">
                                    {metrics.topProducts.map((p, i) => (
                                        <div key={p.name} className="flex items-center gap-2">
                                            <div className="shrink-0 h-5 w-5 rounded-md bg-zinc-800 flex items-center justify-center">
                                                <span className="text-[9px] font-black text-zinc-400">#{i + 1}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <p className="text-xs font-bold truncate">{p.name}</p>
                                                    <span className="text-xs font-black text-primary ml-2 shrink-0">{p.count}x</span>
                                                </div>
                                                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{
                                                            width: `${(p.count / metrics.topProducts[0].count) * 100}%`,
                                                            backgroundColor: i === 0 ? '#22c55e' : i === 1 ? '#3b82f6' : '#6366f1',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Detailed Orders Table ── */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                Historial de Pedidos Completados
                            </p>
                            <span className="text-xs text-zinc-600">{metrics.total} registros</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-zinc-800 bg-zinc-950/50">
                                        <th className="py-2.5 px-3 text-left font-bold text-zinc-500 uppercase tracking-wider">#</th>
                                        <th className="py-2.5 px-3 text-left font-bold text-zinc-500 uppercase tracking-wider">Cliente</th>
                                        <th className="py-2.5 px-3 text-left font-bold text-zinc-500 uppercase tracking-wider">Productos</th>
                                        <th className="py-2.5 px-3 text-left font-bold text-zinc-500 uppercase tracking-wider">Iniciado</th>
                                        <th className="py-2.5 px-3 text-left font-bold text-zinc-500 uppercase tracking-wider">Completado</th>
                                        <th className="py-2.5 px-3 text-right font-bold text-zinc-500 uppercase tracking-wider">Tiempo</th>
                                        <th className="py-2.5 px-3 text-right font-bold text-zinc-500 uppercase tracking-wider">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/60">
                                    {metrics.detailedOrders.map(order => (
                                        <tr key={order.id} className="hover:bg-zinc-800/30 transition-colors">
                                            <td className="py-2.5 px-3">
                                                <span className="font-black text-zinc-300">
                                                    #{order.order_number.split('-').pop()}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 font-semibold text-white max-w-[100px] truncate">
                                                {order.customer_name}
                                            </td>
                                            <td className="py-2.5 px-3 text-zinc-400 max-w-[180px]">
                                                <div className="flex flex-wrap gap-1">
                                                    {order.open_order_items?.slice(0, 3).map(item => (
                                                        <span key={item.id} className="bg-zinc-800 rounded px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap">
                                                            {item.quantity}× {item.product_name.split('(')[0].trim().slice(0, 14)}
                                                        </span>
                                                    ))}
                                                    {(order.open_order_items?.length ?? 0) > 3 && (
                                                        <span className="text-zinc-600 text-[10px]">+{order.open_order_items.length - 3}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-zinc-500 whitespace-nowrap">
                                                {format(new Date(order.created_at), 'dd/MM HH:mm', { locale: es })}
                                            </td>
                                            <td className="py-2.5 px-3 text-zinc-500 whitespace-nowrap">
                                                {format(new Date(order.updated_at), 'dd/MM HH:mm', { locale: es })}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-black whitespace-nowrap">
                                                <span className={
                                                    order.cookTime < yellowThreshold ? 'text-emerald-400' :
                                                        order.cookTime < redThreshold ? 'text-yellow-400' :
                                                            order.cookTime < alertThreshold ? 'text-red-400' : 'text-red-600'
                                                }>
                                                    {fmtTimeLabel(order.cookTime)}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                {order.isOnTime ? (
                                                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">Excelente</Badge>
                                                ) : order.isLate ? (
                                                    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0">Tardío</Badge>
                                                ) : (
                                                    <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px] px-1.5 py-0">Normal</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default KitchenPerformanceDashboard;
