import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sendEvolutionWhatsAppMessage } from '@/utils/evolutionApi';
import { useStoreSettings } from './useStoreSettings';
import { useCompanySettings } from './useCompanySettings';
import { useUserProfile } from './useUserProfile';
import { addDays, isBefore, isToday, startOfDay } from 'date-fns';

const REMINDER_COOLDOWN_DAYS = 15;
const STORAGE_KEY = 'whatsapp_reminders_log';

export const useWhatsAppReminders = () => {
  const { settings: storeSettings } = useStoreSettings();
  const { settings: companySettings } = useCompanySettings();
  const { profile } = useUserProfile();
  const hasRun = useRef(false);
  const [processedCount, setProcessedCount] = useState(0);

  useEffect(() => {
    // Only run once per session when settings are loaded and evolution is enabled
    if (
      hasRun.current ||
      !profile?.store_id ||
      !storeSettings?.evolution_enabled ||
      !storeSettings?.evolution_api_url ||
      !storeSettings?.evolution_instance_name ||
      !storeSettings?.evolution_api_key
    ) {
      return;
    }

    const checkAndSendReminders = async () => {
      hasRun.current = true;
      try {
        // Fetch all pending credit sales that have a customer with a phone number
        const { data: sales, error } = await supabase
          .from('sales')
          .select(`
            id,
            invoice_number,
            total,
            due_date,
            customer:customers (
              name,
              phone
            )
          `)
          .eq('store_id', profile.store_id)
          .eq('payment_method', 'credit')
          .eq('status', 'pending')
          .not('due_date', 'is', null)
          .not('customer_id', 'is', null);

        if (error) {
          console.error('Error fetching sales for reminders:', error);
          return;
        }

        if (!sales || sales.length === 0) return;

        // Get local storage log
        let remindersLog: Record<string, string> = {};
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            remindersLog = JSON.parse(stored);
          }
        } catch (e) {
          console.error('Error parsing reminders log', e);
        }

        const now = new Date();
        const tomorrow = addDays(startOfDay(now), 1);
        let sentCount = 0;

        for (const sale of sales as any[]) {
          // Skip if no phone
          if (!sale.customer?.phone) continue;

          const dueDate = new Date(sale.due_date);
          
          // Check if due_date is today, tomorrow, or in the past
          if (!isBefore(dueDate, tomorrow) && !isToday(dueDate)) {
            continue; // Not due yet (more than 1 day in the future)
          }

          // Check cooldown
          const lastSentString = remindersLog[sale.id];
          if (lastSentString) {
            const lastSentDate = new Date(lastSentString);
            const daysSinceLastSent = (now.getTime() - lastSentDate.getTime()) / (1000 * 3600 * 24);
            if (daysSinceLastSent < REMINDER_COOLDOWN_DAYS) {
              continue; // Skip, recently sent
            }
          }

          // Construct message
          const companyName = (companySettings?.company_name || 'La Gerencia').toUpperCase();
          const isOverdue = isBefore(dueDate, startOfDay(now));
          const statusText = isOverdue ? 'se encuentra VENCIDA' : 'vence PRÓXIMAMENTE';
          const formattedTotal = Number(sale.total).toLocaleString('en-US', { minimumFractionDigits: 2 });
          const formattedDueDate = dueDate.toLocaleDateString('es-DO');

          const message = encodeURIComponent(
            `*${companyName}* - Recordatorio Automático\n` +
            `---------------------------------------------\n\n` +
            `Estimado/a *${sale.customer.name}*,\n\n` +
            `Le contactamos para recordarle que su factura a crédito *#${sale.invoice_number}* por un monto de *$${formattedTotal}* ${statusText} (Fecha: ${formattedDueDate}).\n\n` +
            `Le agradecemos realizar el pago a la brevedad. Si ya ha realizado el pago, por favor haga caso omiso a este mensaje.\n\n` +
            `¡Gracias por su preferencia!\n\n` +
            `_(Mensaje automático de sistema)_`
          );

          // Send message
          try {
            await sendEvolutionWhatsAppMessage(sale.customer.phone, decodeURIComponent(message), {
              url: storeSettings.evolution_api_url,
              instanceName: storeSettings.evolution_instance_name,
              apiKey: storeSettings.evolution_api_key
            });

            // Update log
            remindersLog[sale.id] = now.toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remindersLog));
            sentCount++;
            
            // Add a small delay between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1500));
          } catch (sendError) {
            console.error(`Failed to send reminder for invoice ${sale.invoice_number}:`, sendError);
          }
        }

        setProcessedCount(sentCount);
        if (sentCount > 0) {
          console.log(`Se enviaron ${sentCount} recordatorios de WhatsApp.`);
        }
      } catch (err) {
        console.error('Error in checkAndSendReminders:', err);
      }
    };

    checkAndSendReminders();
  }, [profile?.store_id, storeSettings, companySettings]);

  return { processedCount };
};
