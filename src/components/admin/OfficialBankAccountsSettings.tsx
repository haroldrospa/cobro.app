import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building,
  PlusCircle,
  Trash2,
  Save,
  CheckCircle2,
  Copy,
  Check,
  CreditCard,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { useOfficialBankAccounts, OfficialBankAccount } from '@/hooks/useOfficialBankAccounts';
import { toast } from '@/hooks/use-toast';

export const OfficialBankAccountsSettings: React.FC = () => {
  const { accounts, saveAccounts, isSaving, isLoading } = useOfficialBankAccounts();
  const [localAccounts, setLocalAccounts] = useState<OfficialBankAccount[]>(accounts);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (accounts && accounts.length > 0) {
      setLocalAccounts(accounts);
    }
  }, [accounts]);

  const handleFieldChange = (index: number, field: keyof OfficialBankAccount, value: any) => {
    setLocalAccounts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddAccount = () => {
    const newAcc: OfficialBankAccount = {
      id: `bank_${Date.now()}`,
      bank: 'Nuevo Banco',
      accountType: 'Cuenta Corriente',
      accountNumber: '',
      holder: 'HAROLD MANUEL ROSADO PACHECO',
      taxId: '402-1824665-6',
      currency: 'DOP',
      email: 'haroldrospa@gmail.com',
      isActive: true,
      badge: 'Nuevo',
    };
    setLocalAccounts((prev) => [...prev, newAcc]);
  };

  const handleRemoveAccount = (index: number) => {
    if (localAccounts.length <= 1) {
      alert('Debe mantener al menos una cuenta bancaria oficial.');
      return;
    }
    setLocalAccounts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    for (const acc of localAccounts) {
      if (!acc.bank.trim() || !acc.accountNumber.trim()) {
        alert('Por favor complete el nombre del banco y el número de cuenta en todas las tarjetas.');
        return;
      }
    }
    await saveAccounts(localAccounts);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card className="border border-border/60 bg-card/60 shadow-sm rounded-2xl">
      <CardHeader className="p-5 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Building className="h-5 w-5 text-emerald-500" />
              Cuentas Bancarias Oficiales de CobroApp
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Cuentas donde los clientes depositan para <strong>pagar membresías/suscripciones</strong> y para <strong>recargas de saldo de billetera en el POS</strong>.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleAddAccount}
            variant="outline"
            className="h-9 text-xs font-semibold gap-1.5 rounded-xl border-border/70 hover:bg-muted shrink-0"
          >
            <PlusCircle className="h-4 w-4 text-emerald-500" />
            Agregar Otra Cuenta
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {localAccounts.map((acc, index) => (
            <div
              key={acc.id || index}
              className={`p-4 rounded-2xl border transition-all space-y-3 relative ${
                acc.isActive
                  ? 'bg-card border-border/80 shadow-2xs'
                  : 'bg-muted/20 border-dashed border-border/50 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-xs text-foreground">Cuenta #{index + 1}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acc.isActive}
                      onChange={(e) => handleFieldChange(index, 'isActive', e.target.checked)}
                      className="rounded accent-emerald-600 h-3.5 w-3.5"
                    />
                    Activa
                  </label>
                  {localAccounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAccount(index)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                      title="Eliminar cuenta"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Nombre del Banco */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Entidad Bancaria
                </Label>
                <Input
                  type="text"
                  value={acc.bank}
                  onChange={(e) => handleFieldChange(index, 'bank', e.target.value)}
                  placeholder="Ej. Banco de Reservas"
                  className="h-8 text-xs font-semibold rounded-lg bg-background"
                />
              </div>

              {/* Número de Cuenta */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                    Número de Cuenta
                  </Label>
                  {acc.accountNumber && (
                    <button
                      type="button"
                      onClick={() => handleCopy(acc.accountNumber, acc.id)}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
                    >
                      {copiedId === acc.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      Copiar
                    </button>
                  )}
                </div>
                <Input
                  type="text"
                  value={acc.accountNumber}
                  onChange={(e) => handleFieldChange(index, 'accountNumber', e.target.value)}
                  placeholder="Ej. 9601938364"
                  className="h-9 text-sm font-mono font-bold tracking-wider rounded-lg bg-background border-emerald-500/40 text-foreground"
                />
              </div>

              {/* Tipo de Cuenta y Moneda */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                    Tipo de Cuenta
                  </Label>
                  <Input
                    type="text"
                    value={acc.accountType}
                    onChange={(e) => handleFieldChange(index, 'accountType', e.target.value)}
                    placeholder="Cuenta de Ahorros"
                    className="h-8 text-xs rounded-lg bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                    Moneda
                  </Label>
                  <Input
                    type="text"
                    value={acc.currency || 'DOP'}
                    onChange={(e) => handleFieldChange(index, 'currency', e.target.value)}
                    placeholder="DOP"
                    className="h-8 text-xs rounded-lg bg-background"
                  />
                </div>
              </div>

              {/* Titular */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Titular de la Cuenta
                </Label>
                <Input
                  type="text"
                  value={acc.holder}
                  onChange={(e) => handleFieldChange(index, 'holder', e.target.value)}
                  placeholder="HAROLD MANUEL ROSADO PACHECO"
                  className="h-8 text-xs font-medium rounded-lg bg-background"
                />
              </div>

              {/* Cédula / RNC */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Cédula / RNC
                </Label>
                <Input
                  type="text"
                  value={acc.taxId}
                  onChange={(e) => handleFieldChange(index, 'taxId', e.target.value)}
                  placeholder="402-1824665-6"
                  className="h-8 text-xs font-mono rounded-lg bg-background"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Callout de Sincronización Global */}
        <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs text-muted-foreground flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-[11px]">
              Los cambios guardados aquí se reflejarán automáticamente en el módulo de <strong>Membresías</strong> y en la ventana de <strong>Recargas de Servicios en el POS</strong>.
            </span>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm shrink-0 gap-1.5"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Cuentas Bancarias
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
