import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Search, Loader2, Landmark, DollarSign, Phone, User } from 'lucide-react';
import { lookupRnc } from '@/lib/rncLookup';
import { useToast } from '@/hooks/use-toast';
import { Supplier } from '@/hooks/useSuppliers';

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierToEdit?: Supplier | null;
  onSave: (supplierData: Omit<Supplier, 'id' | 'created_at'>) => Promise<any>;
}

export const SupplierDialog: React.FC<SupplierDialogProps> = ({
  open,
  onOpenChange,
  supplierToEdit,
  onSave,
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLookingUpRnc, setIsLookingUpRnc] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    rnc: '',
    phone: '',
    contact: '',
    contact_phone: '',
    payment_method: 'transfer' as 'transfer' | 'cash',
    bank_name: '',
    bank_account_number: '',
    bank_account_type: 'corriente' as 'ahorros' | 'corriente',
  });

  useEffect(() => {
    if (supplierToEdit) {
      setFormData({
        name: supplierToEdit.name || '',
        rnc: supplierToEdit.rnc || '',
        phone: supplierToEdit.phone || '',
        contact: supplierToEdit.contact || '',
        contact_phone: supplierToEdit.contact_phone || '',
        payment_method: (supplierToEdit.payment_method as any) || 'transfer',
        bank_name: supplierToEdit.bank_name || '',
        bank_account_number: supplierToEdit.bank_account_number || '',
        bank_account_type: (supplierToEdit.bank_account_type as any) || 'corriente',
      });
    } else {
      setFormData({
        name: '',
        rnc: '',
        phone: '',
        contact: '',
        contact_phone: '',
        payment_method: 'transfer',
        bank_name: '',
        bank_account_number: '',
        bank_account_type: 'corriente',
      });
    }
  }, [supplierToEdit, open]);

  const handleLookupRnc = async () => {
    const rawRnc = formData.rnc.trim();
    if (!rawRnc) return;

    setIsLookingUpRnc(true);
    try {
      const result = await lookupRnc(rawRnc);
      if (result.success && result.name) {
        setFormData(prev => ({ ...prev, name: result.name! }));
        toast({
          title: "Proveedor encontrado en DGII",
          description: result.name,
        });
      } else {
        toast({
          variant: "destructive",
          title: "No encontrado",
          description: result.error || "No se encontró ningún contribuyente con este RNC/Cédula.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error de red al consultar el RNC.",
      });
    } finally {
      setIsLookingUpRnc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Por favor escribe el nombre de la empresa o proveedor.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      await onSave({
        name: formData.name.trim(),
        rnc: formData.rnc.trim() || null,
        phone: formData.phone.trim() || null,
        contact: formData.contact.trim() || null,
        contact_phone: formData.contact_phone.trim() || null,
        payment_method: formData.payment_method,
        bank_name: formData.bank_name.trim() || null,
        bank_account_number: formData.bank_account_number.trim() || null,
        bank_account_type: formData.bank_account_type || null,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error al guardar",
        description: error.message || "No se pudo guardar el proveedor.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto rounded-3xl border border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
            <Building2 className="h-5 w-5 text-emerald-500" />
            {supplierToEdit ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {supplierToEdit
              ? 'Actualiza los datos de contacto, facturación o información bancaria.'
              : 'Ingresa los datos para registrar un proveedor en tu catálogo comercial.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* RNC con búsqueda DGII */}
          <div className="space-y-1.5">
            <Label htmlFor="rnc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              RNC / Cédula (DGII)
            </Label>
            <div className="relative flex items-center">
              <Input
                id="rnc"
                placeholder="Ej. 101000000 ó 40200000000"
                value={formData.rnc}
                onChange={(e) => setFormData({ ...formData, rnc: e.target.value })}
                className="h-10 rounded-xl pr-10 font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 w-8 h-8 text-muted-foreground hover:text-emerald-500 rounded-lg"
                onClick={handleLookupRnc}
                disabled={isLookingUpRnc || !formData.rnc.trim()}
                title="Buscar nombre en DGII"
              >
                {isLookingUpRnc ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Haz clic en la lupa para autocompletar el nombre oficial de la DGII.
            </p>
          </div>

          {/* Nombre Proveedor */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Nombre o Razón Social *
            </Label>
            <Input
              id="name"
              placeholder="Ej. Distribuidora Dominicana S.R.L."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-10 rounded-xl font-semibold text-sm"
              required
            />
          </div>

          {/* Teléfono Empresa y Nombre Contacto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> Teléfono Empresa / Oficina
              </Label>
              <Input
                id="phone"
                placeholder="Ej. 809-555-0199"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="h-10 rounded-xl text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Persona de Contacto
              </Label>
              <Input
                id="contact"
                placeholder="Ej. Rafael Rosa"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                className="h-10 rounded-xl text-sm"
              />
            </div>
          </div>

          {/* Teléfono del Contacto */}
          <div className="space-y-1.5">
            <Label htmlFor="contact_phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3 text-emerald-500" /> Teléfono / Celular del Contacto
            </Label>
            <Input
              id="contact_phone"
              placeholder="Ej. 829-555-4321 (Celular o WhatsApp del contacto)"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              className="h-10 rounded-xl text-sm font-mono"
            />
          </div>

          {/* Método de Pago Preferido */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Método de Pago Habitual
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={formData.payment_method === 'transfer' ? 'default' : 'outline'}
                className="h-10 rounded-xl font-bold text-xs gap-2"
                onClick={() => setFormData({ ...formData, payment_method: 'transfer' })}
              >
                <Landmark className="h-4 w-4" /> Transferencia Bancaria
              </Button>
              <Button
                type="button"
                variant={formData.payment_method === 'cash' ? 'default' : 'outline'}
                className="h-10 rounded-xl font-bold text-xs gap-2"
                onClick={() => setFormData({ ...formData, payment_method: 'cash' })}
              >
                <DollarSign className="h-4 w-4" /> Pago en Efectivo
              </Button>
            </div>
          </div>

          {/* Datos Bancarios */}
          <div className="space-y-3 bg-muted/30 p-3.5 rounded-2xl border border-border/40">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-black uppercase tracking-wider text-foreground">
                Datos para Transferencias
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Banco</Label>
                <Input
                  placeholder="Ej. Banreservas, Popular, BHD"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Tipo de Cuenta</Label>
                <Select
                  value={formData.bank_account_type}
                  onValueChange={(val: 'ahorros' | 'corriente') => setFormData({ ...formData, bank_account_type: val })}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="corriente" className="text-xs">Cuenta Corriente</SelectItem>
                    <SelectItem value="ahorros" className="text-xs">Cuenta de Ahorros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Número de Cuenta</Label>
              <Input
                placeholder="Ej. 1029384756"
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                className="h-9 rounded-xl font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-10 text-xs font-bold"
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-10 px-6 font-bold text-xs shadow-md shadow-emerald-500/20 gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {supplierToEdit ? 'Guardar Cambios' : 'Registrar Proveedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
