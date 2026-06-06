import React, { useState } from 'react';
import { Plus, Search, Edit, User, CheckCircle, XCircle, Trash2, AlertTriangle, DollarSign, CreditCard } from 'lucide-react';
import { LoadingLogo } from '@/components/ui/loading-logo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEmployees, Employee, useManageEmployee, useManageEmployeeCredit } from '@/hooks/useEmployees';
import { EmployeeDialog } from '@/components/employees/EmployeeDialog';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useNavigate } from 'react-router-dom';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { LimitReachedDialog } from './subscription/PlanRestrictions';

const Employees: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [showLimitDialog, setShowLimitDialog] = useState(false);
    const [creditEmployee, setCreditEmployee] = useState<Employee | null>(null);
    const [creditAmount, setCreditAmount] = useState('');
    const [creditAction, setCreditAction] = useState<'add' | 'set' | 'pay'>('add');

    const { data: employees = [], isLoading } = useEmployees();
    const { mutate: manageEmployee, isPending: isDeleting } = useManageEmployee();
    const { profile, loading: profileLoading } = useUserProfile();
    const navigate = useNavigate();

    const { hasReachedLimit } = usePlanFeatures();

    const filteredEmployees = employees.filter(employee =>
        (employee.full_name && employee.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (employee.email && employee.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleEdit = (employee: Employee) => {
        setSelectedEmployee(employee);
        setDialogOpen(true);
    };

    const handleCreate = () => {
        setSelectedEmployee(null);
        setDialogOpen(true);
    };

    const handleToggleStatus = (employee: Employee) => {
        manageEmployee({
            action: 'toggle_status',
            id: employee.id,
            isActive: !employee.is_active
        });
    };

    // Open confirmation dialog instead of window.confirm()
    const handleDeleteClick = (employee: Employee) => {
        setDeleteTarget(employee);
        setDeleteDialogOpen(true);
    };

    // Actually execute the delete after confirmation
    const handleDeleteConfirm = () => {
        if (!deleteTarget) return;
        manageEmployee({
            action: 'delete',
            id: deleteTarget.id
        });
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
    };

    const { mutate: updateCredit, isPending: isUpdatingCredit } = useManageEmployeeCredit();

    const handleManageCredit = (employee: Employee) => {
        setCreditEmployee(employee);
        setCreditAmount('');
        setCreditAction('add');
    };

    const onSaveCredit = () => {
        if (!creditEmployee || !creditAmount) return;
        updateCredit({
            id: creditEmployee.id,
            amount: parseFloat(creditAmount),
            action: creditAction
        }, {
            onSuccess: () => setCreditEmployee(null)
        });
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return <Badge variant="default" className="bg-purple-500">Administrador</Badge>;
            case 'manager':
                return <Badge variant="default" className="bg-blue-500">Gerente</Badge>;
            case 'cashier':
            case 'staff':
                return <Badge variant="default" className="bg-green-500">Cajero</Badge>;
            case 'kitchen':
                return <Badge variant="default" className="bg-orange-500">Cocinero</Badge>;
            case 'delivery':
                return <Badge variant="default" className="bg-cyan-500">Delivery</Badge>;
            default:
                return <Badge variant="outline">{role}</Badge>;
        }
    };

    return (
    <div className="space-y-12 animate-fade-in pb-20">
      {/* Centered Premium Header */}
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-8 py-6">
        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tighter uppercase tracking-[0.15em] leading-normal py-1">
            Empleados
          </h1>
          <div className="flex items-center justify-center gap-4 text-primary/80">
            <div className="h-px w-10 bg-primary/30" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">
              Gestión de Personal y Accesos
            </p>
            <div className="h-px w-10 bg-primary/30" />
          </div>
        </div>

        <Button
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest h-14 px-12 rounded-2xl shadow-xl shadow-emerald-500/20 gap-3 transition-all active:scale-95"
          onClick={() => {
            if (hasReachedLimit('employees', employees.length)) {
              setShowLimitDialog(true);
            } else {
              handleCreate();
            }
          }}
        >
          <Plus className="h-5 w-5" />
          Nuevo Empleado
        </Button>
      </div>

      {/* Centered Search */}
      <div className="max-w-2xl mx-auto w-full px-4">
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Buscar por nombre o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-14 h-14 bg-muted/20 border-border/50 rounded-2xl focus:ring-primary/20 text-sm font-medium transition-all"
          />
        </div>
      </div>

      {/* Employee List Section */}
      <div className="max-w-6xl mx-auto w-full px-4">
        {/* Desktop View */}
        <div className="hidden lg:block overflow-hidden rounded-3xl border border-border/50 shadow-2xl bg-card">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-none">
                <TableHead className="font-black uppercase text-[10px] tracking-widest py-6 pl-8">Empleado</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest py-6">Cédula</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest py-6">Correo</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest py-6">Rol</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest py-6">Salario Base</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest py-6">Consumo</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest py-6">Estado</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest py-6 text-right pr-8">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-20 text-center">
                    <LoadingLogo size="sm" text="Cargando equipo..." />
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-20 text-center text-muted-foreground font-bold italic">
                    {searchTerm ? "No se encontraron empleados" : "No hay empleados registrados"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((employee) => (
                  <TableRow key={employee.id} className="hover:bg-muted/20 transition-colors border-b border-border/30 group">
                    <TableCell className="py-4 pl-8">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-sm tracking-tight">{employee.full_name}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {employee.cedula ? (
                        <div className="inline-flex items-center gap-2 bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10">
                          <CreditCard className="h-3.5 w-3.5 text-primary/70" />
                          <span className="font-mono text-[13px] font-bold text-foreground/90 tracking-tight">{employee.cedula}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30 font-bold">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[11px] font-bold text-muted-foreground">{employee.email}</TableCell>
                    <TableCell>{getRoleBadge(employee.role)}</TableCell>
                    <TableCell className="font-black text-emerald-600">${(employee.base_salary || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className={cn("text-sm font-black tracking-tighter", (employee.credit_used || 0) > 0 ? "text-red-500" : "text-emerald-500")}>
                          ${(employee.credit_used || 0).toLocaleString()}
                        </span>
                        {employee.credit_limit && (
                          <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-70">Límite: ${employee.credit_limit.toLocaleString()}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {employee.is_active ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-black text-[9px] uppercase tracking-widest">Activo</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 font-black text-[9px] uppercase tracking-widest">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-amber-600 hover:bg-amber-50" onClick={() => handleManageCredit(employee)}>
                          <DollarSign className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => handleEdit(employee)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClick(employee)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View - PREMIUM CARDS */}
        <div className="lg:hidden space-y-4">
          {isLoading ? (
            <div className="py-20 flex justify-center"><LoadingLogo size="sm" /></div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-20 text-center border-2 border-dashed rounded-3xl text-muted-foreground font-black uppercase tracking-widest text-xs">Vacio</div>
          ) : (
            filteredEmployees.map((employee) => (
              <div key={employee.id} className="bg-card border border-border/50 rounded-3xl p-5 space-y-4 shadow-sm relative overflow-hidden active:bg-muted/10 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-7 w-7 text-primary" />
                    </div>
                    <div className="min-w-0 flex flex-col justify-center">
                      <h4 className="font-black text-lg leading-tight tracking-tight truncate">{employee.full_name}</h4>
                      <p className="text-[10px] font-bold text-muted-foreground truncate">{employee.email}</p>
                    </div>
                  </div>
                  {getRoleBadge(employee.role)}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-muted/10 rounded-2xl p-3 border border-border/30">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1">Cédula</p>
                    <p className="font-mono text-xs font-bold tracking-tight">{employee.cedula || '-'}</p>
                  </div>
                  <div className="bg-muted/10 rounded-2xl p-3 border border-border/30">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1">Salario Base</p>
                    <p className="text-lg font-black tracking-tighter leading-none text-emerald-500">
                      ${(employee.base_salary || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-muted/10 rounded-2xl p-3 border border-border/30">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1">Consumo</p>
                    <p className={cn("text-lg font-black tracking-tighter leading-none", (employee.credit_used || 0) > 0 ? "text-red-500" : "text-emerald-500")}>
                      ${(employee.credit_used || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-muted/10 rounded-2xl p-3 border border-border/30">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1">Estado</p>
                    <div className="flex items-center gap-1">
                      <div className={cn("h-1.5 w-1.5 rounded-full", employee.is_active ? "bg-emerald-500" : "bg-red-500")} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{employee.is_active ? "Activo" : "Inactivo"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border/30 gap-2">
                  <Button variant="secondary" size="sm" className="flex-1 h-10 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2" onClick={() => handleManageCredit(employee)}>
                    <DollarSign className="h-3.5 w-3.5" />
                    Crédito
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => handleEdit(employee)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive active:bg-destructive/10" onClick={() => handleDeleteClick(employee)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

            <EmployeeDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                employee={selectedEmployee}
            />

            {/* ── Diálogo de confirmación de eliminación ── */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Eliminar empleado
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <span>¿Estás seguro que deseas eliminar a </span>
                            <span className="font-bold text-foreground">{deleteTarget?.full_name}</span>
                            <span> ({deleteTarget?.email})?</span>
                            <br />
                            <span className="text-red-500 font-medium">Esta acción no se puede deshacer.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <LimitReachedDialog
                isOpen={showLimitDialog}
                onClose={() => setShowLimitDialog(false)}
                title="Límite de Empleados Alcanzado"
                description="Has llegado al máximo de empleados permitidos en tu plan actual. Para seguir registrando empleados, necesitas un plan superior."
                limitType="employees"
            />

            {/* Credit Management Dialog */}
            <AlertDialog open={!!creditEmployee} onOpenChange={(o) => !o && setCreditEmployee(null)}>
                <AlertDialogContent className="sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Gestionar Crédito - {creditEmployee?.full_name}</AlertDialogTitle>
                        <AlertDialogDescription>
                            Registra consumos, adelantos o ajusta el balance pendiente del empleado.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="flex bg-muted p-1 rounded-md overflow-x-auto gap-1">
                            <Button 
                                variant={creditAction === 'add' ? 'default' : 'ghost'} 
                                className="flex-1 text-xs h-8 px-2 whitespace-nowrap"
                                onClick={() => setCreditAction('add')}
                            >
                                Añadir Deuda
                            </Button>
                            <Button 
                                variant={creditAction === 'pay' ? 'default' : 'ghost'} 
                                className="flex-1 text-xs h-8 px-2 whitespace-nowrap bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white data-[state=inactive]:bg-transparent data-[state=inactive]:text-foreground"
                                data-state={creditAction === 'pay' ? 'active' : 'inactive'}
                                onClick={() => setCreditAction('pay')}
                            >
                                Restar / Pagar
                            </Button>
                            <Button 
                                variant={creditAction === 'set' ? 'default' : 'ghost'} 
                                className="flex-1 text-xs h-8 px-2 whitespace-nowrap"
                                onClick={() => setCreditAction('set')}
                            >
                                Ajustar Total
                            </Button>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Monto ($)</Label>
                            <Input 
                                type="number" 
                                placeholder="0.00" 
                                value={creditAmount}
                                onChange={(e) => setCreditAmount(e.target.value)}
                                autoFocus
                            />
                        </div>
                        
                        {creditAction === 'add' && (
                            <div className="text-sm text-muted-foreground bg-orange-50 border border-orange-100 p-3 rounded-md">
                                <p><strong>Resumen:</strong> El empleado debe <span className="text-orange-600 font-bold">${creditEmployee?.credit_used || 0}</span>. Se le sumarán <span className="text-orange-600 font-bold">${creditAmount || 0}</span> a su deuda.</p>
                            </div>
                        )}
                        {creditAction === 'pay' && (
                            <div className="text-sm text-muted-foreground bg-emerald-50 border border-emerald-100 p-3 rounded-md">
                                <p><strong>Resumen:</strong> El empleado debe <span className="text-emerald-600 font-bold">${creditEmployee?.credit_used || 0}</span>. Se le restarán <span className="text-emerald-600 font-bold">${creditAmount || 0}</span> a su deuda.</p>
                            </div>
                        )}
                        {creditAction === 'set' && (
                            <div className="text-sm text-muted-foreground bg-blue-50 border border-blue-100 p-3 rounded-md">
                                <p><strong>Resumen:</strong> La deuda total del empleado pasará a ser exactamente <span className="text-blue-600 font-bold">${creditAmount || 0}</span>.</p>
                            </div>
                        )}
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={(e) => {
                                e.preventDefault();
                                onSaveCredit();
                            }}
                            disabled={isUpdatingCredit || !creditAmount}
                        >
                            {isUpdatingCredit ? 'Guardando...' : 'Guardar Cambios'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Employees;
