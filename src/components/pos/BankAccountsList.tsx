import React, { useState } from 'react';
import { Landmark, Copy, Check, Plus, Trash2, Edit3, Share2, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useStoreSettings, BankAccount } from '@/hooks/useStoreSettings';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { cn } from '@/lib/utils';

export const DOMINICAN_BANKS = [
  'Banreservas',
  'Banco Popular Dominicano',
  'Banco BHD',
  'Banco Santa Cruz',
  'Scotiabank',
  'Banco Promerica',
  'Banco BDI',
  'Banco Caribe',
  'Banco Vimenca',
  'Banco López de Haro',
  'Qik Banco Digital',
  'APAP (Asoc. Popular)',
  'ACAP (Asoc. Cibao)',
  'ALAVER',
  'Otro Banco'
];

interface BankAccountsListProps {
  totalAmount?: number;
  allowEdit?: boolean;
  className?: string;
  onAccountsChange?: (accounts: BankAccount[]) => void;
}

export const BankAccountsList: React.FC<BankAccountsListProps> = ({
  totalAmount,
  allowEdit = true,
  className,
  onAccountsChange
}) => {
  const { settings, updateSettings, isUpdating } = useStoreSettings();
  const { settings: companySettings } = useCompanySettings();
  const { toast } = useToast();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAllId, setCopiedAllId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  // Form state
  const [bankName, setBankName] = useState('');
  const [customBankName, setCustomBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'ahorros' | 'corriente'>('ahorros');
  const [holderName, setHolderName] = useState('');
  const [rncCedula, setRncCedula] = useState('');
  const [alias, setAlias] = useState('');

  const accounts: BankAccount[] = React.useMemo(() => {
    if (settings?.bank_accounts && Array.isArray(settings.bank_accounts)) {
      return settings.bank_accounts;
    }
    const transferMethod = settings?.payment_methods?.find((m: any) => m.id === 'transfer' || m.id === 'bank');
    if (transferMethod?.bank_accounts && Array.isArray(transferMethod.bank_accounts)) {
      return transferMethod.bank_accounts;
    }
    return [];
  }, [settings]);

  const handleOpenAddDialog = () => {
    setEditingAccount(null);
    setBankName('Banreservas');
    setCustomBankName('');
    setAccountNumber('');
    setAccountType('ahorros');
    setHolderName(companySettings?.company_name || '');
    setRncCedula(companySettings?.rnc || '');
    setAlias('');
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (account: BankAccount) => {
    setEditingAccount(account);
    const isStandard = DOMINICAN_BANKS.includes(account.bank_name);
    if (isStandard) {
      setBankName(account.bank_name);
      setCustomBankName('');
    } else {
      setBankName('Otro Banco');
      setCustomBankName(account.bank_name);
    }
    setAccountNumber(account.account_number);
    setAccountType((account.account_type as any) || 'ahorros');
    setHolderName(account.holder_name || '');
    setRncCedula(account.rnc_cedula || '');
    setAlias(account.alias || '');
    setIsDialogOpen(true);
  };

  const handleSaveAccount = async () => {
    const finalBankName = bankName === 'Otro Banco' ? (customBankName.trim() || 'Otro Banco') : bankName;
    const cleanNumber = accountNumber.trim();

    if (!finalBankName) {
      toast({ title: 'Campo requerido', description: 'Por favor indica el nombre del banco.', variant: 'destructive' });
      return;
    }
    if (!cleanNumber) {
      toast({ title: 'Campo requerido', description: 'Por favor ingresa el número de cuenta.', variant: 'destructive' });
      return;
    }

    let updatedList: BankAccount[];

    if (editingAccount) {
      updatedList = accounts.map(acc => acc.id === editingAccount.id ? {
        ...acc,
        bank_name: finalBankName,
        account_number: cleanNumber,
        account_type: accountType,
        holder_name: holderName.trim() || undefined,
        rnc_cedula: rncCedula.trim() || undefined,
        alias: alias.trim() || undefined
      } : acc);
    } else {
      const newAcc: BankAccount = {
        id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        bank_name: finalBankName,
        account_number: cleanNumber,
        account_type: accountType,
        holder_name: holderName.trim() || undefined,
        rnc_cedula: rncCedula.trim() || undefined,
        alias: alias.trim() || undefined
      };
      updatedList = [...accounts, newAcc];
    }

    await updateSettings({ bank_accounts: updatedList });
    if (onAccountsChange) {
      onAccountsChange(updatedList);
    }
    setIsDialogOpen(false);
    toast({
      title: editingAccount ? 'Cuenta actualizada' : 'Cuenta agregada',
      description: `La cuenta de ${finalBankName} se guardó correctamente.`
    });
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    const updatedList = accounts.filter(acc => acc.id !== id);
    await updateSettings({ bank_accounts: updatedList });
    if (onAccountsChange) {
      onAccountsChange(updatedList);
    }
    toast({
      title: 'Cuenta eliminada',
      description: `Se eliminó la cuenta de ${name}.`
    });
  };

  const copyToClipboard = (text: string, id: string, isFullInfo = false) => {
    navigator.clipboard.writeText(text);
    if (isFullInfo) {
      setCopiedAllId(id);
      setTimeout(() => setCopiedAllId(null), 2500);
      toast({
        title: '¡Datos copiados!',
        description: 'Texto formateado para WhatsApp / Mensaje copiado al portapapeles.'
      });
    } else {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({
        title: '¡Número copiado!',
        description: `Cuenta ${text} copiada al portapapeles.`
      });
    }
  };

  const getFullCopyText = (acc: BankAccount) => {
    const lines = [
      `🏦 *DATOS DE TRANSFERENCIA*`,
      `*Banco:* ${acc.bank_name}`,
      `*Tipo de Cuenta:* ${acc.account_type === 'corriente' ? 'Corriente' : 'Ahorros'}`,
      `*Número de Cuenta:* ${acc.account_number}`
    ];
    if (acc.holder_name) lines.push(`*Titular:* ${acc.holder_name}`);
    if (acc.rnc_cedula) lines.push(`*RNC/Cédula:* ${acc.rnc_cedula}`);
    if (totalAmount && totalAmount > 0) {
      lines.push(`*Monto a Transferir:* RD$ ${totalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`);
    }
    return lines.join('\n');
  };

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Landmark className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
            Cuentas Bancarias del Negocio
          </span>
        </div>
        {allowEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenAddDialog}
            className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md gap-1"
          >
            <Plus className="h-3 w-3" />
            Agregar cuenta
          </Button>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="p-3.5 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center space-y-2 animate-in fade-in">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Landmark className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">No hay cuentas bancarias registradas</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Registra tus cuentas bancarias para mostrarlas al cobrar por transferencia.
            </p>
          </div>
          {allowEdit && (
            <Button
              type="button"
              size="sm"
              onClick={handleOpenAddDialog}
              className="h-7 text-xs font-bold gap-1 rounded-lg shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Configurar Cuenta Bancaria
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5 scrollbar-thin">
          {accounts.map((acc) => {
            const isNumCopied = copiedId === acc.id;
            const isAllCopied = copiedAllId === acc.id;

            return (
              <div
                key={acc.id}
                className="group p-2.5 rounded-xl bg-card border border-border/70 shadow-sm hover:border-primary/40 hover:shadow transition-all relative overflow-hidden text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Header with bank name and type badge */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-xs text-foreground tracking-tight flex items-center gap-1">
                        <Building className="h-3 w-3 text-primary shrink-0" />
                        {acc.bank_name}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase bg-primary/10 text-primary border border-primary/20">
                        {acc.account_type === 'corriente' ? 'Corriente' : 'Ahorros'}
                      </span>
                      {acc.alias && (
                        <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.2 rounded-full">
                          {acc.alias}
                        </span>
                      )}
                    </div>

                    {/* Account number in prominent mono box */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <div className="bg-muted/60 border border-border/60 rounded-md px-2 py-0.5 font-mono text-xs font-black text-foreground tracking-wider select-all">
                        {acc.account_number}
                      </div>

                      {/* 1-Click Copy Number button */}
                      <Button
                        type="button"
                        size="sm"
                        variant={isNumCopied ? "default" : "outline"}
                        className={cn(
                          "h-6 px-2 text-[10px] font-bold rounded-md transition-all gap-1",
                          isNumCopied ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "hover:bg-primary/10 hover:text-primary"
                        )}
                        onClick={() => copyToClipboard(acc.account_number, acc.id, false)}
                        title="Copiar número de cuenta"
                      >
                        {isNumCopied ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copiar</span>
                          </>
                        )}
                      </Button>

                      {/* Copy full details formatted for client */}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "h-6 px-1.5 text-[10px] font-bold rounded-md transition-all gap-1 text-muted-foreground hover:text-foreground",
                          isAllCopied && "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                        )}
                        onClick={() => copyToClipboard(getFullCopyText(acc), acc.id, true)}
                        title="Copiar todos los datos para WhatsApp"
                      >
                        {isAllCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Share2 className="h-3 w-3" />}
                        <span className="hidden sm:inline">Compartir</span>
                      </Button>
                    </div>

                    {/* Holder and RNC metadata */}
                    {(acc.holder_name || acc.rnc_cedula) && (
                      <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5">
                        {acc.holder_name && (
                          <span>Titular: <strong className="text-foreground font-semibold">{acc.holder_name}</strong></span>
                        )}
                        {acc.rnc_cedula && (
                          <span>RNC/Cédula: <strong className="font-mono text-foreground font-semibold">{acc.rnc_cedula}</strong></span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Edit/Delete actions */}
                  {allowEdit && (
                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => handleOpenEditDialog(acc)}
                        title="Editar cuenta"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteAccount(acc.id, acc.bank_name)}
                        title="Eliminar cuenta"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Bank Account Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[380px] w-[calc(100%-2rem)] p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-2xl z-[200]">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              {editingAccount ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ingresa los datos bancarios del negocio para cobros por transferencia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-left">
            {/* Banco Selection */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Banco</Label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger className="h-9 text-xs rounded-lg bg-background">
                  <SelectValue placeholder="Seleccionar Banco" />
                </SelectTrigger>
                <SelectContent className="max-h-[220px] z-[220]">
                  {DOMINICAN_BANKS.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bankName === 'Otro Banco' && (
              <div className="space-y-1 animate-in fade-in">
                <Label className="text-xs font-semibold">Nombre del Banco</Label>
                <Input
                  placeholder="Ej. Citibank, Banesco..."
                  value={customBankName}
                  onChange={(e) => setCustomBankName(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                />
              </div>
            )}

            {/* Número de Cuenta */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Número de Cuenta *</Label>
              <Input
                placeholder="Ej. 960-000000-0 o 800-000000-0"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="h-9 text-xs font-mono font-bold rounded-lg"
                autoFocus
              />
            </div>

            {/* Tipo de Cuenta */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tipo de Cuenta</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={accountType === 'ahorros' ? 'default' : 'outline'}
                  size="sm"
                  className={cn("h-8 text-xs font-bold rounded-lg", accountType === 'ahorros' ? "bg-primary text-primary-foreground" : "")}
                  onClick={() => setAccountType('ahorros')}
                >
                  Ahorros
                </Button>
                <Button
                  type="button"
                  variant={accountType === 'corriente' ? 'default' : 'outline'}
                  size="sm"
                  className={cn("h-8 text-xs font-bold rounded-lg", accountType === 'corriente' ? "bg-primary text-primary-foreground" : "")}
                  onClick={() => setAccountType('corriente')}
                >
                  Corriente
                </Button>
              </div>
            </div>

            {/* Titular */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Titular de la Cuenta</Label>
              <Input
                placeholder="Ej. Harold Rosado o Mi Empresa SRL"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                className="h-9 text-xs rounded-lg"
              />
            </div>

            {/* RNC / Cédula */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">RNC / Cédula del Titular (Opcional)</Label>
              <Input
                placeholder="Ej. 131-00000-0"
                value={rncCedula}
                onChange={(e) => setRncCedula(e.target.value)}
                className="h-9 text-xs font-mono rounded-lg"
              />
            </div>

            {/* Alias */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Alias o Descripción (Opcional)</Label>
              <Input
                placeholder="Ej. Cuenta Principal, Dólares..."
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="h-9 text-xs rounded-lg"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(false)}
              className="flex-1 h-9 rounded-lg text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isUpdating || !accountNumber.trim()}
              onClick={handleSaveAccount}
              className="flex-1 h-9 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {editingAccount ? 'Guardar Cambios' : 'Guardar Cuenta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankAccountsList;
