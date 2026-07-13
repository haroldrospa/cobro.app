import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Customer, useUpdateCustomer, useCustomers } from '@/hooks/useCustomers';
import { useEmployees } from '@/hooks/useEmployees';
import { toast } from 'sonner';
import { Star, ShieldAlert } from 'lucide-react';

const customerSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  rnc: z.string().max(20).optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Email inválido').max(255).optional().or(z.literal('')),
  address: z.string().max(255).optional().or(z.literal('')),
  customer_type: z.enum(['final', 'business']).optional(),
  credit_limit: z.coerce.number().min(0).optional(),
  credit_due_date: z.string().optional().or(z.literal('')),
  loyalty_points: z.coerce.number().min(0).optional(),
  validation_code: z.string().max(20).optional().or(z.literal('')),
  profile_id: z.string().optional().nullable().or(z.literal('')),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface EditCustomerDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditCustomerDialog: React.FC<EditCustomerDialogProps> = ({
  customer,
  open,
  onOpenChange,
}) => {
  const updateCustomer = useUpdateCustomer();
  const { data: employees = [] } = useEmployees();
  const { data: allCustomers = [] } = useCustomers();

  // Find profile_ids already linked to other customers
  const takenProfileIds = useMemo(() => {
    return new Set(
      allCustomers
        .map(c => c.profile_id)
        .filter(pid => pid && pid !== customer?.profile_id)
    );
  }, [allCustomers, customer]);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    values: customer ? {
      name: customer.name,
      rnc: customer.rnc || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      customer_type: customer.customer_type || 'final',
      credit_limit: customer.credit_limit || 0,
      credit_due_date: customer.credit_due_date ? customer.credit_due_date.split('T')[0] : '',
      loyalty_points: (customer as any).loyalty_points ?? 0,
      validation_code: customer.validation_code || '',
      profile_id: customer.profile_id || 'none',
    } : undefined,
  });

  const onSubmit = async (data: CustomerFormData) => {
    if (!customer) return;

    try {
      const isEmployee = data.profile_id && data.profile_id !== 'none';
      const newProfileId = isEmployee ? data.profile_id : null;

      // If we are assigning a new profile_id, check if it's already taken and clear it
      if (newProfileId) {
        const { data: existingLink } = await supabase
          .from('customers')
          .select('id')
          .eq('profile_id', newProfileId)
          .neq('id', customer.id)
          .maybeSingle();

        if (existingLink) {
          await supabase
            .from('customers')
            .update({ profile_id: null, is_employee: false })
            .eq('id', existingLink.id);
        }
      }

      await updateCustomer.mutateAsync({
        id: customer.id,
        name: data.name,
        rnc: data.rnc || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        customer_type: data.customer_type,
        credit_limit: data.credit_limit || 0,
        credit_due_date: data.credit_due_date || null,
        loyalty_points: data.loyalty_points ?? 0,
        validation_code: data.validation_code || null,
        is_employee: isEmployee ? true : false,
        profile_id: newProfileId,
      } as any);
      toast.success('Cliente actualizado correctamente');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error al actualizar el cliente:', error);
      toast.error(`Error al actualizar el cliente: ${error.message || error}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del cliente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rnc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RNC/Cédula</FormLabel>
                    <FormControl>
                      <Input placeholder="RNC o Cédula" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customer_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="final">Consumidor Final</SelectItem>
                        <SelectItem value="business">Empresa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input placeholder="(809) 555-0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="correo@ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input placeholder="Dirección completa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vincular Empleado Dropdown */}
            <FormField
              control={form.control}
              name="profile_id"
              render={({ field }) => (
                <FormItem className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                  <FormLabel className="text-xs uppercase font-bold text-blue-500 flex items-center gap-1.5">
                    Vinculación de Empleado
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || 'none'}>
                    <FormControl>
                      <SelectTrigger className="!bg-zinc-900 !text-white border-white/10 font-semibold">
                        <SelectValue placeholder="No vincular a empleado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No vincular a empleado (Cliente Común)</SelectItem>
                      {employees.map((emp) => {
                        const isTaken = takenProfileIds.has(emp.id);
                        return (
                          <SelectItem 
                            key={emp.id} 
                            value={emp.id} 
                            className="font-semibold"
                          >
                            {emp.full_name} ({emp.role}){isTaken ? ' (Reasignar)' : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-[10px] text-zinc-500 mt-1">
                    Asocia este cliente a un usuario empleado para identificar compras internas y aplicar deudas o adelantos en nómina.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="credit_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Límite de Crédito</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ⭐ Puntos de Lealtad */}
              <FormField
                control={form.control}
                name="loyalty_points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                      Puntos de Lealtad
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        {...field}
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="credit_due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Vencimiento de Crédito</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="validation_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de Validación (Fidelidad)</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input placeholder="Ej: ABC-123" {...field} />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                        form.setValue('validation_code', randomCode);
                      }}
                    >
                      Generar
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateCustomer.isPending}>
                {updateCustomer.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditCustomerDialog;
