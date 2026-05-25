import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCreateCustomer } from '@/hooks/useCustomers';
import { Loader2, UserPlus, Phone, Mail, MapPin, CreditCard, ShieldCheck } from 'lucide-react';

interface AddCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerAdded: (customerId: string) => void;
}

const AddCustomerDialog: React.FC<AddCustomerDialogProps> = ({
  isOpen,
  onClose,
  onCustomerAdded,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    rnc: '',
    phone: '',
    email: '',
    address: '',
    customer_type: 'final' as 'final' | 'business',
    credit_limit: '',
    validation_code: ''
  });

  const { toast } = useToast();
  const createCustomer = useCreateCustomer();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El nombre del cliente es requerido.",
      });
      return;
    }

    createCustomer.mutate({
      ...formData,
      rnc: formData.rnc.trim() || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      address: formData.address.trim() || null,
      validation_code: formData.validation_code.trim() || null,
      credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : 0,
      credit_used: 0,
      total_purchases: 0
    }, {
      onSuccess: (data) => {
        toast({
          title: "Cliente creado exitosamente",
          description: `Cliente ${data.name} ha sido agregado.`,
        });
        onCustomerAdded(data.id);
        handleClose();
      },
      onError: (error: any) => {
        console.error('Error creating customer:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "No se pudo crear el cliente. Inténtalo de nuevo.",
        });
      }
    });
  };

  const handleClose = () => {
    setFormData({
      name: '',
      rnc: '',
      phone: '',
      email: '',
      address: '',
      customer_type: 'final',
      credit_limit: '',
      validation_code: ''
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-zinc-950 border-white/5 p-6 rounded-[2rem] max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-600 to-emerald-500" />
        
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-green-500/10 text-green-500">
              <UserPlus className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-black text-white tracking-tight uppercase">Nuevo Cliente</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="name" className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Nombre Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Juan Pérez"
                className="h-12 bg-zinc-900/50 border-white/5 rounded-xl focus:ring-green-500/20 text-white font-bold"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-type" className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Tipo</Label>
              <Select
                value={formData.customer_type}
                onValueChange={(value: 'final' | 'business') =>
                  setFormData({ ...formData, customer_type: value })
                }
              >
                <SelectTrigger className="h-12 bg-zinc-900/50 border-white/5 rounded-xl text-white font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10">
                  <SelectItem value="final" className="font-bold">Personal</SelectItem>
                  <SelectItem value="business" className="font-bold">Negocio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rnc" className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">RNC / Cédula</Label>
              <Input
                id="rnc"
                value={formData.rnc}
                onChange={(e) => setFormData({ ...formData, rnc: e.target.value })}
                placeholder="402-..."
                className="h-12 bg-zinc-900/50 border-white/5 rounded-xl focus:ring-green-500/20 text-white font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1 flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> Teléfono
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="809-..."
                className="h-12 bg-zinc-900/50 border-white/5 rounded-xl focus:ring-green-500/20 text-white font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1 flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="cliente@mail.com"
                className="h-12 bg-zinc-900/50 border-white/5 rounded-xl focus:ring-green-500/20 text-white font-bold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Dirección (Opcional)
            </Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Calle..."
              className="h-12 bg-zinc-900/50 border-white/5 rounded-xl focus:ring-green-500/20 text-white font-bold"
            />
          </div>

          <div className="space-y-2 p-4 bg-zinc-900/50 border border-white/5 rounded-2xl">
            <Label htmlFor="credit_limit" className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-1.5 mb-2">
              <CreditCard className="h-3 w-3" /> Configuración de Crédito
            </Label>
            <div className="flex gap-2">
              <Input
                id="credit_limit"
                type="number"
                min="0"
                step="0.01"
                value={formData.credit_limit}
                onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                className="h-10 bg-zinc-950/50 border-white/5 rounded-lg text-white font-black"
                placeholder="0.00"
              />
              <div className="flex gap-1 overflow-x-auto pb-1 slim-scroll">
                {[1000, 5000].map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 bg-zinc-950/50 border-white/5 rounded-lg text-[10px] font-black hover:bg-green-500/10 hover:text-green-500"
                    onClick={() => setFormData({ ...formData, credit_limit: amount.toString() })}
                  >
                    ${amount / 1000}k
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 p-4 bg-green-500/5 border border-green-500/10 rounded-2xl">
            <Label htmlFor="validation_code" className="text-[10px] uppercase font-black tracking-widest text-green-500/70 flex items-center gap-1.5 mb-2">
              <ShieldCheck className="h-3 w-3" /> Código de Fidelidad
            </Label>
            <div className="flex gap-2">
              <Input
                id="validation_code"
                value={formData.validation_code}
                onChange={(e) => setFormData({ ...formData, validation_code: e.target.value })}
                placeholder="ABC-123"
                className="h-10 bg-zinc-950/20 border-green-500/10 rounded-lg font-black text-green-500"
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-lg border-green-500/20 text-[10px] font-black hover:bg-green-500/10 uppercase"
                onClick={() => {
                  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                  setFormData({ ...formData, validation_code: randomCode });
                }}
              >
                Generar
              </Button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="flex-1 h-14 rounded-2xl font-black text-zinc-500 hover:text-white"
              disabled={createCustomer.isPending}
            >
              CANCELAR
            </Button>
            <Button
              type="submit"
              className="flex-[2] h-14 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 text-white font-black shadow-[0_0_20px_rgba(34,197,94,0.2)]"
              disabled={createCustomer.isPending}
            >
              {createCustomer.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : null}
              {createCustomer.isPending ? 'GUARDANDO...' : 'CREAR CLIENTE'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerDialog;