import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Percent, Sparkles, CheckCircle2 } from 'lucide-react';

export interface CommissionItem {
  name: string;
  rate: string;
  type: 'percentage' | 'fixed';
}

export interface CommissionCategory {
  title: string;
  items: CommissionItem[];
}

export const OFFICIAL_USER_COMMISSION_RATES: CommissionCategory[] = [
  {
    title: 'Recargas móviles',
    items: [
      { name: 'Altice — Recarga', rate: '2.75%', type: 'percentage' },
      { name: 'Claro — Recarga', rate: '2.75%', type: 'percentage' },
      { name: 'Digicel — Recarga', rate: '3.00%', type: 'percentage' },
      { name: 'Natcom — Recarga', rate: '3.00%', type: 'percentage' },
      { name: 'Viva — Recarga', rate: '2.75%', type: 'percentage' },
    ],
  },
  {
    title: 'Paquetes de datos',
    items: [
      { name: 'Altice — Paquetes de datos', rate: '2.75%', type: 'percentage' },
      { name: 'Claro — Paquetes de datos', rate: '2.75%', type: 'percentage' },
      { name: 'Digicel — Paquetes de datos', rate: '3.00%', type: 'percentage' },
      { name: 'Viva — Paquetes de datos', rate: '2.75%', type: 'percentage' },
      { name: 'Wind — Paquetes', rate: '1.25%', type: 'percentage' },
    ],
  },
  {
    title: 'Luz Prepago',
    items: [
      { name: 'EdeSur — Luz Prepago', rate: '1.00%', type: 'percentage' },
      { name: 'EdeNorte — Luz Prepago', rate: '1.00%', type: 'percentage' },
      { name: 'EdeEste — Luz Prepago', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'CEPM — Luz Prepago', rate: '0.50%', type: 'percentage' },
      { name: 'CEB — Luz Prepago', rate: '0.50%', type: 'percentage' },
      { name: 'CEPN — Luz Prepago', rate: '0.50%', type: 'percentage' },
      { name: 'Luz y Fuerza — Luz Prepago', rate: 'RD$ 1.00', type: 'fixed' },
    ],
  },
  {
    title: 'Facturas de electricidad',
    items: [
      { name: 'EdeSur — Factura', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'EdeNorte — Factura', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'EdeEste — Factura', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'CEB — Factura', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'CEPM — Factura', rate: '2.00%', type: 'percentage' },
      { name: 'CEPN — Factura', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'Luz y Fuerza — Factura', rate: 'RD$ 1.00', type: 'fixed' },
    ],
  },
  {
    title: 'Facturas de agua',
    items: [
      { name: 'CAASD — Factura', rate: '0.75%', type: 'percentage' },
      { name: 'CORAAPPLATA — Factura', rate: '0.75%', type: 'percentage' },
      { name: 'CORAAROM — Factura', rate: 'RD$ 0.50', type: 'fixed' },
      { name: 'CORAASAN — Factura', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'CORAVEGA — Factura', rate: '0.75%', type: 'percentage' },
      { name: 'INAPA — Factura', rate: 'RD$ 0.75', type: 'fixed' },
    ],
  },
  {
    title: 'Remesas',
    items: [
      { name: 'MonCash', rate: '2.50%', type: 'percentage' },
      { name: 'NatCash', rate: '2.50%', type: 'percentage' },
    ],
  },
  {
    title: 'Gobierno e impuestos',
    items: [
      { name: 'DGII — Impuestos', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'INFOTEP', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'PGR — Multas', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'TSS — Seguridad Social', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'ADN', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'Paso Rápido — Peajes', rate: '0.75%', type: 'percentage' },
      { name: 'Betcris — Apuestas', rate: '1.25%', type: 'percentage' },
      { name: 'Juancito — Lotería', rate: '2.50%', type: 'percentage' },
      { name: 'Lotería Nacional', rate: '4.50%', type: 'percentage' },
    ],
  },
  {
    title: 'Educación',
    items: [
      { name: 'UAPA — Universidad', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'UNAPEC — Universidad', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'UNIBE — Universidad', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'UTEL — Universidad', rate: 'RD$ 2.00', type: 'fixed' },
    ],
  },
  {
    title: 'Facturas de TV / Telecomunicaciones',
    items: [
      { name: 'Claro — Factura', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'Altice — Factura', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'Altice Hogar — Factura', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'Star Cable — Factura', rate: '0.50%', type: 'percentage' },
      { name: 'Telecasa — Factura', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'Wind — Factura', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'Aster — Factura', rate: 'RD$ 0.75', type: 'fixed' },
      { name: 'Activa TV', rate: '0.50%', type: 'percentage' },
    ],
  },
  {
    title: 'Ventas directas',
    items: [
      { name: 'Avon — Pago directo', rate: 'RD$ 2.00', type: 'fixed' },
      { name: 'Belcorp — Pago directo', rate: 'RD$ 2.00', type: 'fixed' },
    ],
  },
  {
    title: 'Seguros',
    items: [
      { name: 'Seguro de Vehículo', rate: '4.50%', type: 'percentage' },
      { name: 'Angloamericana — Seguros', rate: '4.50%', type: 'percentage' },
      { name: 'Midas Seguros', rate: '4.50%', type: 'percentage' },
    ],
  },
  {
    title: 'Gaming y Recreación',
    items: [
      { name: 'Free Fire — Diamantes', rate: '2.50%', type: 'percentage' },
      { name: 'Mobile Legends — MLBB', rate: '2.50%', type: 'percentage' },
      { name: 'PUBG Mobile — UC', rate: '2.50%', type: 'percentage' },
      { name: 'Roblox — Robux', rate: '2.50%', type: 'percentage' },
    ],
  },
];

export const CommissionRatesGrid: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return OFFICIAL_USER_COMMISSION_RATES;
    const q = searchQuery.toLowerCase().trim();

    return OFFICIAL_USER_COMMISSION_RATES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) => item.name.toLowerCase().includes(q) || cat.title.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      {/* Cabecera Informativa */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-card border border-border/70 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-foreground">Tabla Oficial de Comisiones y Ganancias</h3>
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs font-semibold">
              Tus Ganancias
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Porcentajes y montos limpios que se acreditan a tu negocio por cada servicio vendido.
          </p>
        </div>

        {/* Buscador */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar operadora, servicio o empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-xs rounded-xl border-border/70 bg-background"
          />
        </div>
      </div>

      {/* Grid de Tablas por Categoría */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map((cat) => (
          <Card key={cat.title} className="border border-border/70 bg-card rounded-2xl shadow-xs overflow-hidden flex flex-col">
            <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-sm font-bold text-foreground">
                {cat.title}
              </CardTitle>
              <span className="text-[11px] text-muted-foreground font-medium">
                {cat.items.length} {cat.items.length === 1 ? 'servicio' : 'servicios'}
              </span>
            </CardHeader>
            <CardContent className="p-0 flex-1 divide-y divide-border/40">
              {cat.items.map((item) => (
                <div
                  key={item.name}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors text-xs"
                >
                  <span className="font-medium text-foreground truncate pr-2">
                    {item.name}
                  </span>
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-bold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                    {item.rate}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <div className="p-8 text-center text-muted-foreground text-xs">
          No se encontraron servicios que coincidan con &quot;{searchQuery}&quot;.
        </div>
      )}
    </div>
  );
};
export default CommissionRatesGrid;
