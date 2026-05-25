
import React, { useState, useMemo, useEffect } from 'react';
import { Users, Plus, Search, Edit, CreditCard, Phone, Loader2, Trash2, Star, Copy, DollarSign, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { LoadingLogo } from '@/components/ui/loading-logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCustomers, Customer, useDeleteCustomer } from '@/hooks/useCustomers';
import { useAllCustomersBalances } from '@/hooks/useCustomerBalance';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from "@/lib/utils";
import EditCustomerDialog from '@/components/customers/EditCustomerDialog';
import CustomerCreditDialog from '@/components/customers/CustomerCreditDialog';
import AddCustomerDialog from '@/components/pos/AddCustomerDialog';
import { LimitReachedDialog } from './subscription/PlanRestrictions';
import { useToast } from '@/hooks/use-toast';

import { usePlanFeatures } from '@/hooks/usePlanFeatures';

// ... imports

const Customers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  // Feature Limits
  const { hasReachedLimit } = usePlanFeatures();

  const queryClient = useQueryClient();
  const { data: customers = [], isLoading } = useCustomers();
  const { data: creditData } = useAllCustomersBalances();
  const balances = creditData?.balances || {};
  const overdueSet = creditData?.overdueCustomers || new Set();

  const deleteCustomer = useDeleteCustomer();
  const { toast } = useToast();

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer =>
      (customer.name && customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.rnc && customer.rnc.includes(searchTerm)) ||
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [customers, searchTerm]);

  const stats = useMemo(() => {
    const totalCustomers = customers.length;

    // Calculate totals only for the customers currently available in the list
    // This ensures consistency between the list view and the summary cards.
    let totalCredit = 0;
    let totalOverdue = 0;

    customers.forEach(c => {
      const debt = balances[c.id] || 0;
      totalCredit += debt;
      if (overdueSet.has(c.id)) {
        totalOverdue++;
      }
    });

    return { totalCustomers, totalCredit, totalOverdue };
  }, [customers, balances, overdueSet]);

  // Real-time updates subscription
  useEffect(() => {
    const channel = supabase
      .channel('customers-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['allCustomersBalances'] });
          // Invalidate customers too as they might have aggregated fields
          queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditDialogOpen(true);
  };

  const handleCredit = (customer: Customer) => {
    setCreditCustomer(customer);
    setCreditDialogOpen(true);
  };

  const handleDelete = async (customer: Customer) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar al cliente "${customer.name}"?`)) {
      try {
        await deleteCustomer.mutateAsync(customer.id);
        toast({
          title: "Cliente eliminado",
          description: "El cliente se ha eliminado correctamente.",
        });
      } catch (error: any) {
        console.error('Error al eliminar cliente:', error);

        let message = "No se pudo eliminar el cliente. Inténtalo de nuevo. Error: " + (error?.message || error?.details || "Desconocido");

        if (error?.message === 'FALTA_SQL_CLIENTE' || error === 'FALTA_SQL_CLIENTE') {
          message = "Por favor, ejecuta el script SQL '8_FIX_ELIMINAR_CLIENTES.sql' en Supabase para habilitar la eliminación de clientes con historial.";
        } else if (error?.message?.includes("foreign key") || error?.message?.includes("constraint") || error?.code === '23503') {
          message = "No se puede eliminar este cliente porque tiene historial asociado. Contacta a soporte para forzar la eliminación.";
        }

        toast({
          variant: "destructive",
          title: "Error al eliminar",
          description: message,
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingLogo text="Cargando clientes..." size="sm" />
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      {/* Centered Premium Header */}
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-8 py-6">
        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tighter uppercase tracking-[0.15em] leading-normal py-1">
            Clientes
          </h1>
          <div className="flex items-center justify-center gap-4 text-primary/80">
            <div className="h-px w-10 bg-primary/30" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">
              Directorio de Cartera y Créditos
            </p>
            <div className="h-px w-10 bg-primary/30" />
          </div>
        </div>

        <Button
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest h-14 px-12 rounded-2xl shadow-xl shadow-emerald-500/20 gap-3 transition-all active:scale-95"
          onClick={() => {
            if (hasReachedLimit('customers', customers.length)) {
              setShowLimitDialog(true);
            } else {
              setAddDialogOpen(true);
            }
          }}
        >
          <Plus className="h-5 w-5" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Impact Stats Grid */}
      <div className="max-w-5xl mx-auto w-full px-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-muted/5 border-border/30 overflow-hidden relative group hover:bg-muted/10 transition-all rounded-3xl">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Total Clientes</span>
              <span className="text-4xl font-black tracking-tighter text-emerald-500">{stats.totalCustomers}</span>
              <div className="mt-2 p-1.5 bg-emerald-500/10 rounded-full">
                <Users className="h-3.5 w-3.5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-muted/5 border-border/30 overflow-hidden relative group hover:bg-muted/10 transition-all rounded-3xl">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Deuda Total</span>
              <span className="text-4xl font-black tracking-tighter text-amber-500">${stats.totalCredit.toLocaleString()}</span>
              <div className="mt-2 p-1.5 bg-amber-500/10 rounded-full">
                <DollarSign className="h-3.5 w-3.5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/5 border-border/30 overflow-hidden relative group hover:bg-muted/10 transition-all rounded-3xl">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Clientes con Mora</span>
              <span className="text-4xl font-black tracking-tighter text-red-500">{stats.totalOverdue}</span>
              <div className="mt-2 p-1.5 bg-red-500/10 rounded-full">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Centered Search */}
      <div className="max-w-2xl mx-auto w-full px-4">
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Buscar por nombre, RNC o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-14 h-14 bg-muted/20 border-border/50 rounded-2xl focus:ring-primary/20 text-sm font-medium transition-all"
          />
        </div>
      </div>

      {/* Lista de clientes */}
      <div className="grid grid-cols-1 gap-4">
        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              {searchTerm ? 'No se encontraron clientes con ese criterio' : 'No hay clientes registrados'}
            </CardContent>
          </Card>
        ) : (
          filteredCustomers.map((customer) => {
            const creditLimit = customer.credit_limit || 0;
            // Use real-time balance if available, otherwise 0.
            const creditUsed = balances[customer.id] || 0;
            const creditPercentage = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

            return (
              <Card key={customer.id}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{customer.name}</h3>
                          {customer.is_employee && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
                                Empleado
                            </Badge>
                          )}
                          {creditPercentage >= 80 && (
                            <Badge variant="destructive">Crédito Alto</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p><strong>RNC:</strong> {customer.rnc || 'N/A'}</p>
                            <p className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone || 'N/A'}
                            </p>
                            <p><strong>Email:</strong> {customer.email || 'N/A'}</p>
                          </div>
                          <div>
                            <p><strong>Dirección:</strong> {customer.address || 'N/A'}</p>
                            <p><strong>Última compra:</strong> {customer.last_purchase_date ? new Date(customer.last_purchase_date).toLocaleDateString() : 'N/A'}</p>
                            <p><strong>Total compras:</strong> ${(customer.total_purchases || 0).toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Barra de crédito - Mostrar siempre */}
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1 mb-2">
                            <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Deuda Pendiente</span>
                            <div className="flex items-baseline gap-2">
                              <span className={`text-2xl font-bold ${creditUsed > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                ${creditUsed.toLocaleString()}
                              </span>
                              {creditLimit > 0 ? (
                                <span className="text-sm text-muted-foreground">
                                  / ${creditLimit.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground font-normal ml-1">
                                  (Sin límite)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="w-full bg-secondary/50 rounded-full h-3 mb-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${(creditLimit > 0 && creditPercentage < 60) ? 'bg-emerald-500' :
                                (creditLimit > 0 && creditPercentage < 80) ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                              style={{
                                width: `${creditLimit > 0 ? Math.min(creditPercentage, 100) : (creditUsed > 0 ? 100 : 0)}%`
                              }}
                            />
                          </div>

                          {customer.credit_due_date && creditUsed > 0 && (
                            <p className="text-xs text-muted-foreground">
                              <strong>Vencimiento:</strong> {new Date(customer.credit_due_date).toLocaleDateString()}
                            </p>
                          )}

                          {/* Puntos de Lealtad y Tarjeta Virtual */}
                          {(((customer as any).loyalty_points ?? 0) > 0 || customer.validation_code) && (
                            <div className="mt-3 space-y-2">
                              <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Fidelidad y Puntos</span>
                              <div className="flex flex-col sm:flex-row gap-3">
                                {/* Puntos acumulados badge */}
                                {((customer as any).loyalty_points ?? 0) > 0 && (
                                  <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-md px-3 py-1.5 h-fit shadow-sm">
                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                    <span className="text-sm font-bold text-yellow-600">{(customer as any).loyalty_points} puntos</span>
                                    <span className="text-xs text-muted-foreground ml-1">acumulados</span>
                                  </div>
                                )}

                                {/* Tarjeta Virtual / Código */}
                                {customer.validation_code && (
                                  <div className="flex-1 max-w-sm bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-3 relative overflow-hidden group shadow-sm transition-all hover:shadow-md">
                                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                      <CreditCard className="h-12 w-12 text-indigo-600 rotate-12" />
                                    </div>
                                    <div className="relative z-10 flex flex-col gap-1">
                                      <span className="text-[10px] font-bold text-indigo-600/70 uppercase tracking-widest">Tarjeta Virtual</span>
                                      <div className="flex items-baseline gap-2">
                                        <p className="text-lg font-mono font-black text-indigo-700 tracking-tighter">
                                          {customer.validation_code}
                                        </p>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 text-indigo-400 hover:text-indigo-600 hover:bg-transparent"
                                          onClick={() => {
                                            navigator.clipboard.writeText(customer.validation_code!);
                                            toast({ title: "Código copiado", description: "El código de validación ha sido copiado." });
                                          }}
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <p className="text-[9px] text-muted-foreground italic">Digitar este código en el POS para puntos</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCredit(customer)}
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          Crédito
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(customer)}
                          title="Editar Cliente"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(customer)}
                          title="Eliminar Cliente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <EditCustomerDialog
        customer={editingCustomer}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <CustomerCreditDialog
        customer={creditCustomer}
        open={creditDialogOpen}
        onOpenChange={setCreditDialogOpen}
      />

      <AddCustomerDialog
        isOpen={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onCustomerAdded={() => { }}
      />

      <LimitReachedDialog
        isOpen={showLimitDialog}
        onClose={() => setShowLimitDialog(false)}
        title="Límite de Clientes Alcanzado"
        description="Has llegado al máximo de clientes permitidos en tu plan actual. Para seguir registrando clientes, necesitas un plan superior."
        limitType="customers"
      />
    </div>
  );
};

export default Customers;
