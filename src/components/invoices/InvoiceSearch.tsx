
import React from 'react';
import { Search, Filter, User, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';

interface InvoiceSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  paymentMethodFilter: string;
  onPaymentMethodChange: (value: string) => void;
  customerFilter: string;
  onCustomerChange: (value: string) => void;
  userIdFilter: string;
  onUserIdChange: (value: string) => void;
  invoiceTypeFilter: string;
  onInvoiceTypeChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  minAmount: string;
  onMinAmountChange: (value: string) => void;
  maxAmount: string;
  onMaxAmountChange: (value: string) => void;
  onClearFilters: () => void;
  customers?: Array<{ id: string; name: string; rnc?: string }>;
  employees?: Array<{ id: string; full_name: string }>;
}

const InvoiceSearch: React.FC<InvoiceSearchProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  paymentMethodFilter,
  onPaymentMethodChange,
  customerFilter,
  onCustomerChange,
  userIdFilter,
  onUserIdChange,
  invoiceTypeFilter,
  onInvoiceTypeChange,
  dateRange,
  onDateRangeChange,
  minAmount,
  onMinAmountChange,
  maxAmount,
  onMaxAmountChange,
  onClearFilters,
  customers = [],
  employees = [],
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);
  const [tempSearchTerm, setTempSearchTerm] = React.useState(searchTerm);

  // Sincronizar cuando cambia externamente
  React.useEffect(() => {
    setTempSearchTerm(searchTerm);
  }, [searchTerm]);

  const handleSearch = () => {
    onSearchChange(tempSearchTerm);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="space-y-4">
      {/* Primary Search Bar & Date */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input
            placeholder="Buscar por NCF, referencia o nombre..."
            value={tempSearchTerm}
            onChange={(e) => setTempSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-12 h-12 text-base shadow-sm border-muted-foreground/20"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={onDateRangeChange}
          />
          <Button onClick={handleSearch} size="lg" className="h-12 px-6 shadow-md">
            Buscar
          </Button>
          <Button
            variant={isAdvancedOpen ? "secondary" : "outline"}
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="h-12 px-4 border-dashed"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      {/* Advanced Filters Section */}
      {isAdvancedOpen && (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Column 1: Status & Type */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado y Tipo</label>
              <Select value={statusFilter} onValueChange={onStatusChange}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Estados</SelectItem>
                  <SelectItem value="completed">Pagadas</SelectItem>
                  <SelectItem value="pending">Pendientes de Pago</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={invoiceTypeFilter} onValueChange={onInvoiceTypeChange}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Tipo de Factura" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Tipos</SelectItem>
                  <SelectItem value="B01">B01 - Crédito Fiscal</SelectItem>
                  <SelectItem value="B02">B02 - Consumo Final</SelectItem>
                  <SelectItem value="B14">B14 - Regímenes Especiales</SelectItem>
                  <SelectItem value="B15">B15 - Gubernamental</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Column 2: Payment & Money */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pagos y Montos</label>
              <Select value={paymentMethodFilter} onValueChange={onPaymentMethodChange}>
                <SelectTrigger className="bg-background">
                  <CreditCard className="h-3 w-3 mr-2" />
                  <SelectValue placeholder="Método de Pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Métodos</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min $"
                  value={minAmount}
                  onChange={(e) => onMinAmountChange(e.target.value)}
                  className="bg-background"
                />
                <Input
                  type="number"
                  placeholder="Max $"
                  value={maxAmount}
                  onChange={(e) => onMaxAmountChange(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            {/* Column 3: People */}
            <div className="space-y-3 md:col-span-2 lg:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Personas</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select value={customerFilter} onValueChange={onCustomerChange}>
                  <SelectTrigger className="bg-background">
                    <User className="h-3 w-3 mr-2" />
                    <SelectValue placeholder="Cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Clientes</SelectItem>
                    <SelectItem value="general">Cliente General</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={userIdFilter} onValueChange={onUserIdChange}>
                  <SelectTrigger className="bg-background">
                    <User className="h-3 w-3 mr-2" />
                    <SelectValue placeholder="Vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Vendedores</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-1 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTempSearchTerm('');
                    onClearFilters();
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Limpiar todos los filtros
                </Button>
              </div>
            </div>

          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InvoiceSearch;
