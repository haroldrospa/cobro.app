import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MessageSquarePlus, Send, HelpCircle, CheckCircle2, Clock, Phone, Mail, Loader2, AlertTriangle, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ClientReportDialogProps {
  trigger?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ClientReportDialog: React.FC<ClientReportDialogProps> = ({
  trigger,
  isOpen: externalOpen,
  onOpenChange: setExternalOpen
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? setExternalOpen! : setInternalOpen;

  const { profile } = useUserProfile();
  const { settings: companySettings } = useCompanySettings();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [reportType, setReportType] = useState('help_getting_started');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Sincronizar datos de contacto por defecto al abrir
  React.useEffect(() => {
    if (open) {
      if (!contactPhone) {
        setContactPhone(profile?.phone || companySettings?.phone || '');
      }
      if (!contactEmail) {
        setContactEmail(profile?.email || companySettings?.email || '');
      }
    }
  }, [open, profile, companySettings]);

  // Consultar historial de reportes del cliente para esta tienda
  const storeId = profile?.store_id;
  const { data: myReports = [], isLoading: loadingReports, refetch: refetchReports } = useQuery({
    queryKey: ['my-support-reports', storeId],
    enabled: open && !!storeId,
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from('client_support_reports')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching client_support_reports:', error);
        return [];
      }
      return data || [];
    }
  });

  // Límite de 3 reportes mensuales por cliente
  const MAX_MONTHLY_REPORTS = 3;
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const reportsThisMonth = myReports.filter((r: any) => new Date(r.created_at) >= currentMonthStart);
  const monthlyCount = reportsThisMonth.length;
  const reportsRemaining = Math.max(0, MAX_MONTHLY_REPORTS - monthlyCount);
  const hasReachedLimit = monthlyCount >= MAX_MONTHLY_REPORTS;
  const currentMonthName = new Date().toLocaleDateString('es-DO', { month: 'long' });

  // Mutación para crear reporte
  const createReportMutation = useMutation({
    mutationFn: async () => {
      if (hasReachedLimit) {
        throw new Error('Has alcanzado el límite de 3 reportes mensuales para este mes.');
      }
      if (!title.trim()) throw new Error('Por favor escribe un asunto para el reporte');
      if (!message.trim()) throw new Error('Por favor detalla tu consulta o requerimiento');
      if (!storeId) throw new Error('No se encontró el ID de tu negocio. Intenta recargar la página');

      const targetEmail = contactEmail.trim() || profile?.email || null;
      const targetPhone = contactPhone.trim() || profile?.phone || null;

      const { data, error } = await supabase
        .from('client_support_reports')
        .insert({
          store_id: storeId,
          user_id: profile?.id || null,
          report_type: reportType,
          title: title.trim(),
          message: message.trim(),
          contact_phone: targetPhone,
          contact_email: targetEmail,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Enviar correo de confirmación al cliente y alerta al administrador
      try {
        await supabase.functions.invoke('send-support-report-email', {
          body: {
            action: 'new_report',
            reportId: data.id,
            storeName: companySettings?.name || 'Mi Negocio',
            userName: profile?.full_name || profile?.email || 'Usuario',
            contactEmail: targetEmail,
            contactPhone: targetPhone || 'No especificado',
            reportType: reportType,
            reportTypeLabel: getReportTypeLabel(reportType),
            title: title.trim(),
            message: message.trim()
          }
        });
      } catch (emailErr) {
        console.warn('Notice: email dispatch returned:', emailErr);
      }

      return data;
    },
    onSuccess: () => {
      toast.success('¡Reporte generado! Te enviamos una confirmación por correo para darle seguimiento al caso.');
      setTitle('');
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['my-support-reports', storeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-stores'] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-support-reports'] });
      setActiveTab('history');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al enviar el reporte');
    }
  });

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'help_getting_started': return 'Asistencia para empezar';
      case 'technical_issue': return 'Problema técnico';
      case 'billing_question': return 'Facturación o Plan';
      case 'feature_request': return 'Sugerencia de función';
      case 'contact_request': return 'Solicitud de llamada';
      default: return 'Consulta general';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-emerald-500/30 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 font-semibold text-xs rounded-xl shadow-xs"
          >
            <MessageSquarePlus className="h-4 w-4 text-emerald-500" />
            <span className="hidden sm:inline">Generar Reporte / Contacto</span>
            <span className="sm:hidden">Soporte</span>
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 border-border/80">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white rounded-t-2xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
              <HelpCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-white tracking-tight">
                Generar Reporte de Contacto
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs mt-0.5">
                Comunícate directamente con Harold y el equipo de Cobro App para recibir seguimiento.
              </DialogDescription>
            </div>
          </div>

          {/* Sub-navegación crear / historial */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-white/15">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'create'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              Nuevo Reporte
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                refetchReports();
              }}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <span>Mis Reportes</span>
              {myReports.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'history' ? 'bg-emerald-100 text-emerald-800' : 'bg-white/20 text-white'}`}>
                  {myReports.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {activeTab === 'create' ? (
            <div className="space-y-4">
              {/* Barra de cuota mensual: 3 reportes mensuales */}
              <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all ${
                hasReachedLimit
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                  : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-bold flex items-center gap-1.5">
                    {hasReachedLimit ? (
                      <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    {hasReachedLimit
                      ? `Límite mensual alcanzado (3 de 3 usados este mes)`
                      : `Cuota mensual: ${monthlyCount} de ${MAX_MONTHLY_REPORTS} reportes usados`}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`font-mono text-[10px] font-bold ${
                    hasReachedLimit
                      ? 'bg-rose-500/20 text-rose-700 border-rose-500/40 dark:text-rose-200'
                      : 'bg-emerald-500/20 text-emerald-800 border-emerald-500/40 dark:text-emerald-200'
                  }`}
                >
                  {reportsRemaining} {reportsRemaining === 1 ? 'disponible' : 'disponibles'}
                </Badge>
              </div>

              {hasReachedLimit && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    Has alcanzado el límite de 3 reportes para el mes de {currentMonthName}.
                  </p>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    Tu cuota de 3 reportes mensuales se restablecerá automáticamente el primer día del próximo mes. Si necesitas asistencia urgente, puedes escribirnos directamente por WhatsApp.
                  </p>
                  <a
                    href="https://wa.me/18099175744?text=Hola%20Harold,%20tengo%20una%20consulta%20urgente%20sobre%20mi%20cuenta%20en%20Cobro%20App"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline pt-1"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Contactar soporte urgente por WhatsApp →
                  </a>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Tipo de Requerimiento</Label>
                <Select value={reportType} onValueChange={setReportType} disabled={hasReachedLimit}>
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="help_getting_started">🚀 Asistencia para empezar / Primeros pasos</SelectItem>
                    <SelectItem value="contact_request">📞 Solicitud de llamada o contacto</SelectItem>
                    <SelectItem value="technical_issue">⚙️ Problema técnico o con impresora</SelectItem>
                    <SelectItem value="billing_question">💳 Facturación, plan o pagos</SelectItem>
                    <SelectItem value="feature_request">💡 Sugerencia o nueva función</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Asunto / Título Breve</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Necesito ayuda configurando impresora térmica o mis productos"
                  className="h-10 text-xs rounded-xl"
                  maxLength={120}
                  disabled={hasReachedLimit}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Detalle de tu Consulta o Mensaje</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Explícanos con detalle en qué podemos apoyarte para darte una solución rápida..."
                  className="min-h-[110px] text-xs rounded-xl resize-none"
                  maxLength={1000}
                  disabled={hasReachedLimit}
                />
                <span className="text-[10px] text-muted-foreground float-right">
                  {message.length} / 1000
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-emerald-500" />
                    <span>Teléfono / WhatsApp</span>
                  </Label>
                  <Input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="809-000-0000"
                    className="h-9 text-xs rounded-xl font-mono"
                    disabled={hasReachedLimit}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-blue-500" />
                    <span>Correo Electrónico para Seguimiento</span>
                  </Label>
                  <Input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    className="h-9 text-xs rounded-xl font-mono"
                    disabled={hasReachedLimit}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Te enviaremos la confirmación y podrás dar seguimiento directo respondiendo al correo.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={createReportMutation.isPending || !title.trim() || !message.trim() || hasReachedLimit}
                  onClick={() => createReportMutation.mutate()}
                  className={`font-bold text-xs gap-1.5 rounded-xl shadow-sm h-9 px-4 ${
                    hasReachedLimit
                      ? 'bg-muted text-muted-foreground opacity-60 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {createReportMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>{hasReachedLimit ? 'Límite Mensual Alcanzado (3/3)' : 'Enviar Reporte'}</span>
                </Button>
              </div>
            </div>

          ) : (
            <div className="space-y-3">
              {loadingReports ? (
                <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                  <span>Cargando tus reportes...</span>
                </div>
              ) : myReports.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl p-6">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500/50 mx-auto mb-2" />
                  <p className="font-semibold text-foreground">No tienes reportes pendientes</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Cuando generes un reporte para contactarnos, podrás ver el historial aquí.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('create')}
                    className="mt-3 text-xs font-bold rounded-xl"
                  >
                    Crear nuevo reporte
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {myReports.map((report: any) => (
                    <div
                      key={report.id}
                      className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-emerald-500/30 transition-all space-y-1.5 text-xs shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              #{`TICK-${report.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-semibold bg-muted/60">
                              {getReportTypeLabel(report.report_type)}
                            </Badge>
                          </div>
                          <h4 className="font-bold text-foreground text-xs leading-tight">
                            {report.title}
                          </h4>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold shrink-0 ${
                            report.status === 'resolved'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                              : report.status === 'in_progress'
                              ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                              : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          }`}
                        >
                          {report.status === 'resolved'
                            ? 'Resuelto'
                            : report.status === 'in_progress'
                            ? 'En Proceso'
                            : 'Pendiente de Contacto'}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                        {report.message}
                      </p>

                      {report.admin_response && (
                        <div className="mt-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-foreground">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5 flex items-center gap-1">
                            <MessageSquarePlus className="h-3 w-3" />
                            Respuesta del equipo de Cobro App:
                          </span>
                          {report.admin_response}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground/80 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(report.created_at).toLocaleDateString('es-DO', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {report.contact_email && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Mail className="h-3 w-3 text-blue-500" />
                            <span>{report.contact_email}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
