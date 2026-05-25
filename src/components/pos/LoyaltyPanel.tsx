import React, { useState, useRef } from 'react';
import { Star, Search, X, Gift, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    useFindCustomerByCode,
    calculatePointsEarned,
    calculatePointsValue,
    LoyaltyCustomer
} from '@/hooks/useLoyaltyPoints';
import { cn } from '@/lib/utils';

interface LoyaltyPanelProps {
    cartTotal: number;
    onCustomerFound?: (customerId: string) => void;
    onLoyaltyPointsBalance?: (currentPoints: number) => void;
    onPointsRedeemed?: (discountAmount: number, pointsUsed: number) => void;
    onClearRedemption?: () => void;
    redeemedPoints?: number;
}

const LoyaltyPanel: React.FC<LoyaltyPanelProps> = ({
    cartTotal,
    onCustomerFound,
    onLoyaltyPointsBalance,
    onPointsRedeemed,
    onClearRedemption,
    redeemedPoints = 0,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [validationCode, setValidationCode] = useState('');
    const [foundCustomer, setFoundCustomer] = useState<LoyaltyCustomer | null>(null);
    const [pointsToRedeem, setPointsToRedeem] = useState(0);
    const [searchError, setSearchError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const findCustomerByCode = useFindCustomerByCode();

    const pointsEarned = calculatePointsEarned(cartTotal);
    const maxRedeemable = foundCustomer?.loyalty_points || 0;
    const redeemValue = calculatePointsValue(pointsToRedeem);

    const handleSearch = async () => {
        if (!validationCode.trim()) return;
        setSearchError('');
        try {
            const customer = await findCustomerByCode.mutateAsync(validationCode);
            if (customer) {
                setFoundCustomer(customer);
                setPointsToRedeem(0);
                onCustomerFound?.(customer.id);
                onLoyaltyPointsBalance?.(customer.loyalty_points);
                setIsExpanded(false); // Colapsar después de encontrar el cliente
            } else {
                setFoundCustomer(null);
                setSearchError('Cliente no encontrado con ese código.');
            }
        } catch (err: any) {
            setSearchError('Error al buscar: ' + err.message);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    const handleClearCustomer = () => {
        setFoundCustomer(null);
        setValidationCode('');
        setPointsToRedeem(0);
        setSearchError('');
        onClearRedemption?.();
    };

    const handleRedeem = () => {
        if (!foundCustomer || pointsToRedeem <= 0) return;
        const discount = calculatePointsValue(pointsToRedeem);
        onPointsRedeemed?.(discount, pointsToRedeem);
        setFoundCustomer(prev => prev ? { ...prev, loyalty_points: prev.loyalty_points - pointsToRedeem } : null);
        setPointsToRedeem(0);
    };

    const handleClearRedemption = () => {
        if (foundCustomer) {
            setFoundCustomer(prev => prev ? { ...prev, loyalty_points: prev.loyalty_points + redeemedPoints } : null);
        }
        setPointsToRedeem(0);
        onClearRedemption?.();
    };

    // Compact always-visible bar
    return (
        <div className="border-t border-border/50">
            {/* Toggle header - always visible, ultra compact */}
            <button
                onClick={() => {
                    setIsExpanded(prev => {
                        if (!prev) setTimeout(() => inputRef.current?.focus(), 100);
                        return !prev;
                    });
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/40 transition-colors"
            >
                <div className="flex items-center gap-1.5 flex-wrap">
                    <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground">
                        {foundCustomer
                            ? <><span className="text-foreground font-semibold">{foundCustomer.name.split(' ')[0]}</span> · <span className="text-yellow-600 font-bold">{foundCustomer.loyalty_points} pts</span>
                                {foundCustomer.loyalty_points_expires_at && (
                                    <span className="text-[10px] text-orange-500 ml-1">
                                        (vence {new Date(foundCustomer.loyalty_points_expires_at).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })})
                                    </span>
                                )}
                            </>
                            : redeemedPoints > 0
                                ? <span className="text-green-600 font-semibold">-{redeemedPoints} pts canjeados</span>
                                : 'Puntos de Lealtad'}
                    </span>
                </div>
                {isExpanded
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>

            {/* Expanded panel */}
            {isExpanded && (
                <div className="px-3 pb-3 space-y-2 bg-muted/20">
                    {!foundCustomer ? (
                        <div className="space-y-1">
                            <div className="flex gap-1.5">
                                <Input
                                    ref={inputRef}
                                    placeholder="Código de Validación del cliente"
                                    value={validationCode}
                                    onChange={(e) => setValidationCode(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="h-7 text-xs flex-1"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 shrink-0"
                                    onClick={handleSearch}
                                    disabled={findCustomerByCode.isPending}
                                >
                                    {findCustomerByCode.isPending
                                        ? <div className="h-3 w-3 border border-foreground/30 border-t-foreground rounded-full animate-spin" />
                                        : <Search className="h-3 w-3" />}
                                </Button>
                            </div>
                            {searchError && <p className="text-[10px] text-destructive">{searchError}</p>}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Customer summary row */}
                            <div className="flex items-center justify-between bg-background rounded-md px-2 py-1.5 border border-border/50">
                                <div>
                                    <p className="text-xs font-semibold leading-tight">{foundCustomer.name}</p>
                                    <div className="flex items-center gap-1">
                                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                        <span className="text-xs font-bold text-yellow-600">{foundCustomer.loyalty_points} pts</span>
                                    </div>
                                </div>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={handleClearCustomer}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>

                            {/* Points that will be earned */}
                            {cartTotal > 0 && (
                                <p className="text-[10px] text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-0.5">
                                    ✦ Ganará <strong className="text-yellow-600">+{pointsEarned} pts</strong> con esta compra
                                    {pointsEarned > 0 && (
                                        <span className="text-orange-400 ml-1">
                                            (vencen en 45 días)
                                        </span>
                                    )}
                                </p>
                            )}

                            {/* Expiry warning for existing points */}
                            {foundCustomer.loyalty_points_expires_at && foundCustomer.loyalty_points > 0 && (
                                <div className="bg-orange-500/10 border border-orange-500/20 rounded px-2 py-0.5 flex items-center gap-1">
                                    <span className="text-[10px] text-orange-600">
                                        ⏰ Puntos vencen el{' '}
                                        <strong>{new Date(foundCustomer.loyalty_points_expires_at).toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                                    </span>
                                </div>
                            )}

                            {/* Redemption or active discount */}
                            {redeemedPoints > 0 ? (
                                <div className="bg-green-500/10 border border-green-500/30 rounded px-2 py-1.5 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Gift className="h-3.5 w-3.5 text-green-600" />
                                        <span className="text-xs font-semibold text-green-700">-{redeemedPoints} pts → -${calculatePointsValue(redeemedPoints)} desc.</span>
                                    </div>
                                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={handleClearRedemption}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : foundCustomer.loyalty_points > 0 ? (
                                <div className="space-y-1.5">
                                    <div className="flex gap-1.5 items-center">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={maxRedeemable}
                                            value={pointsToRedeem || ''}
                                            onChange={(e) => setPointsToRedeem(Math.min(maxRedeemable, Math.max(0, parseInt(e.target.value) || 0)))}
                                            placeholder="Pts a canjear"
                                            className="h-7 text-xs flex-1"
                                        />
                                        {redeemValue > 0 && (
                                            <span className="text-xs text-muted-foreground shrink-0">= ${redeemValue}</span>
                                        )}
                                    </div>
                                    {/* Quick picks */}
                                    <div className="flex gap-1">
                                        {[25, 50, 100, maxRedeemable].filter((v, i, arr) => v <= maxRedeemable && arr.indexOf(v) === i).map(pts => (
                                            <button key={pts} onClick={() => setPointsToRedeem(pts)}
                                                className={cn("flex-1 text-[10px] py-0.5 rounded border transition-colors",
                                                    pointsToRedeem === pts ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>
                                                {pts === maxRedeemable ? 'Todo' : `${pts}pts`}
                                            </button>
                                        ))}
                                    </div>
                                    <Button size="sm" className="w-full h-7 text-xs" disabled={pointsToRedeem <= 0} onClick={handleRedeem}>
                                        <Gift className="h-3 w-3 mr-1" />
                                        Canjear → -${redeemValue} descuento
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-[10px] text-muted-foreground text-center">Sin puntos disponibles para canjear</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LoyaltyPanel;
