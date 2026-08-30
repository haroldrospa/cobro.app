import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCreateCustomer, useCustomers } from '@/hooks/useCustomers';
import { useEmployees } from '@/hooks/useEmployees';
import { Loader2, UserPlus, Phone, Mail, MapPin, CreditCard, ShieldCheck, Search } from 'lucide-react';
import { lookupRnc } from '@/lib/rncLookup';

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
    validation_code: '',
    profile_id: ''
  });

  const { toast } = useToast();
  const createCustomer = useCreateCustomer();
  const { data: employees = [] } = useEmployees();
  const { data: allCustomers = [] } = useCustomers();
  const [isLookingUpRnc, setIsLookingUpRnc] = useState(false);

  const handleLookupRnc = async () => {
    if (!formData.rnc.trim()) return;
    setIsLookingUpRnc(true);
    try {
      const result = await lookupRnc(formData.rnc);
      if (result.success && result.name) {
        setFormData(prev => ({ ...prev, name: result.name! }));
        toast({
          title: "Cliente encontrado",
          description: `Nombre: ${result.name}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Consulta fallida",
          description: result.error || "No se encontró un cliente con este RNC/Cédula.",
        });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error de conexión al consultar.",
      });
    } finally {
      setIsLookingUpRnc(false);
    }
  };

  // Find profile_ids already linked to other customers
  const takenProfileIds = useMemo(() => {
    return new Set(
      allCustomers
        .map(c => c.profile_id)
        .filter(pid => !!pid)
    );
  }, [allCustomers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El nombre del cliente es requerido.",
      });
      return;
    }

    const isEmployee = formData.profile_id && formData.profile_id !== 'none';
    const newProfileId = isEmployee ? formData.profile_id : null;

    try {
      // If we are assigning a new profile_id, check if it's already taken and clear it
      if (newProfileId) {
        const { data: existingLink } = await supabase
          .from('customers')
          .select('id')
          .eq('profile_id', newProfileId)
          .maybeSingle();

        if (existingLink) {
          await supabase
            .from('customers')
            .update({ profile_id: null, is_employee: false })
            .eq('id', existingLink.id);
        }
      }

      const cleanRnc = formData.rnc.replace(/[^0-9]/g, '');
      const detectedType = cleanRnc.length === 9 ? 'business' : 'final';

      createCustomer.mutate({
        name: formData.name,
        rnc: formData.rnc.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        validation_code: formData.validation_code.trim() || null,
        customer_type: detectedType,
        credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : 0,
        credit_used: 0,
        total_purchases: 0,
        is_employee: isEmployee ? true : false,
        profile_id: newProfileId,
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
    } catch (err: any) {
      console.error('Error handling pre-assignment in creation:', err);
    }
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
      validation_code: '',
      profile_id: ''
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-background border-border/40 p-6 rounded-[2rem] max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-600 to-emerald-500" />
        
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-green-500/10 text-green-500">
              <UserPlus className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-black text-foreground tracking-tight uppercase">Nuevo Cliente</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="rnc" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">RNC / Cédula</Label>
              <div className="relative flex items-center">
                <Input
                  id="rnc"
                  value={formData.rnc}
                  onChange={(e) => setFormData({ ...formData, rnc: e.target.value })}
                  placeholder="402-..."
                  className="h-12 bg-muted/50 border-border/40 rounded-xl pr-12 focus:ring-green-500/20 text-foreground font-bold"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 w-10 h-10 text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={handleLookupRnc}
                  disabled={isLookingUpRnc || !formData.rnc}
                  title="Buscar en DGII"
                >
                  {isLookingUpRnc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="name" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Nombre Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Juan Pérez"
                className="h-12 bg-muted/50 border-border/40 rounded-xl focus:ring-green-500/20 text-foreground font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> Teléfono *
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="809-..."
                className="h-12 bg-muted/50 border-border/40 rounded-xl focus:ring-green-500/20 text-foreground font-bold"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="cliente@mail.com"
                className="h-12 bg-muted/50 border-border/40 rounded-xl focus:ring-green-500/20 text-foreground font-bold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Dirección (Opcional)
            </Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Calle..."
              className="h-12 bg-muted/50 border-border/40 rounded-xl focus:ring-green-500/20 text-foreground font-bold"
            />
          </div>

          {/* Vincular Empleado Dropdown */}
          <div className="space-y-2 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
            <Label htmlFor="profile_id" className="text-[10px] uppercase font-black tracking-widest text-blue-400 flex items-center gap-1.5 mb-2">
              Vincular a Empleado (Opcional)
            </Label>
            <Select
              value={formData.profile_id || 'none'}
              onValueChange={(value) =>
                setFormData({ ...formData, profile_id: value })
              }
            >
              <SelectTrigger className="h-12 !bg-muted !text-foreground border-border/40 rounded-xl font-bold">
                <SelectValue placeholder="No vincular a empleado" />
              </SelectTrigger>
              <SelectContent className="bg-muted border-border text-foreground">
                <SelectItem value="none" className="font-bold">No vincular a empleado</SelectItem>
                {employees.map((emp) => {
                  const isTaken = takenProfileIds.has(emp.id);
                  return (
                    <SelectItem 
                      key={emp.id} 
                      value={emp.id} 
                      className="font-bold"
                    >
                      {emp.full_name} ({emp.role}){isTaken ? ' (Reasignar)' : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-[9px] text-muted-foreground italic mt-1">Permite asociar este cliente con un perfil de usuario del sistema.</p>
          </div>

          <div className="space-y-2 p-4 bg-muted/50 border border-border/40 rounded-2xl">
            <Label htmlFor="credit_limit" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
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
                className="h-10 bg-muted/50 border-border/40 rounded-lg text-foreground font-black"
                placeholder="0.00"
              />
              <div className="flex gap-1 overflow-x-auto pb-1 slim-scroll">
                {[1000, 5000].map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 bg-muted/50 border-border/40 rounded-lg text-[10px] font-black hover:bg-green-500/10 hover:text-green-500"
                    onClick={() => setFormData({ ...formData, credit_limit: amount.toString() })}
                  >
                    ${amount / 1000}k
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 p-3 bg-muted/30 border border-border/60 rounded-xl">
            <Label htmlFor="validation_code" className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Código de Fidelidad
            </Label>
            <div className="flex gap-2">
              <Input
                id="validation_code"
                value={formData.validation_code}
                onChange={(e) => setFormData({ ...formData, validation_code: e.target.value })}
                placeholder="ABC-123"
                className="h-9 bg-background border-border rounded-lg font-mono font-bold text-foreground text-xs"
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg border-border text-[10px] font-bold uppercase hover:bg-muted"
                onClick={() => {
                  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                  setFormData({ ...formData, validation_code: randomCode });
                }}
              >
                Generar
              </Button>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="flex-1 h-11 rounded-xl font-bold text-muted-foreground hover:text-foreground text-xs"
              disabled={createCustomer.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-[2] h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs shadow-sm"
              disabled={createCustomer.isPending}
            >
              {createCustomer.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {createCustomer.isPending ? 'Guardando...' : 'Crear Cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerDialog;