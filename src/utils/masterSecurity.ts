import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export interface MasterSecurityInfo {
  email: string;
  ip: string;
  location: string;
  isp: string;
  device: string;
  timestamp: string;
  id?: string;
}

/**
 * Obtiene la dirección IP, geolocalización e información del dispositivo del cliente
 */
export const fetchClientSecurityInfo = async (): Promise<Omit<MasterSecurityInfo, 'email'>> => {
  let ip = "Desconocida";
  let location = "Santo Domingo, República Dominicana";
  let isp = "Proveedor de Internet Local";

  try {
    const res = await fetch("https://ipapi.co/json/");
    if (res.ok) {
      const data = await res.json();
      ip = data.ip || ip;
      const parts = [data.city, data.region, data.country_name].filter(Boolean);
      if (parts.length > 0) location = parts.join(", ");
      isp = data.org || data.asn || isp;
    }
  } catch (e) {
    try {
      const res2 = await fetch("https://ipwho.is/");
      if (res2.ok) {
        const data2 = await res2.json();
        ip = data2.ip || ip;
        const parts2 = [data2.city, data2.region, data2.country].filter(Boolean);
        if (parts2.length > 0) location = parts2.join(", ");
        isp = data2.connection?.isp || isp;
      }
    } catch (e2) {
      console.warn("Fallback IP check failed", e2);
    }
  }

  const userAgent = navigator.userAgent;
  let device = "Navegador Web";
  if (userAgent.includes("Windows")) device = "PC Windows";
  else if (userAgent.includes("Macintosh")) device = "Mac OS";
  else if (userAgent.includes("Android")) device = "Dispositivo Android";
  else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) device = "Dispositivo iOS";

  return {
    ip,
    location,
    isp,
    device,
    timestamp: format(new Date(), "dd/MM/yyyy, hh:mm:ss a", { locale: es })
  };
};

/**
 * Envia notificación de alerta de seguridad al correo Haroldrospa@gmail.com
 */
export const sendSecurityNotificationEmail = async (loginInfo: MasterSecurityInfo) => {
  const targetEmail = "Haroldrospa@gmail.com";

  // 1. Intentar envío por Supabase Edge Function
  try {
    await supabase.functions.invoke("send-otp-email", {
      body: {
        email: targetEmail,
        subject: `🚨 ALERTA DE SEGURIDAD: Inicio de sesión en Panel Maestro - CobroApp`,
        message: `
Se ha registrado un inicio de sesión exitoso al PANEL MAESTRO de CobroApp.

📍 INFORMACIÓN DETALLADA DEL ACCESO:
---------------------------------------------
• Usuario / Correo Maestro: ${loginInfo.email}
• Dirección IP: ${loginInfo.ip}
• Ubicación Geográfica: ${loginInfo.location}
• Proveedor de Internet (ISP): ${loginInfo.isp}
• Dispositivo / Sistema: ${loginInfo.device}
• Fecha y Hora Local: ${loginInfo.timestamp}
---------------------------------------------

Si reconoces este acceso, no necesitas realizar ninguna acción.
En caso contrario, cambia la contraseña maestra de inmediato.
`
      }
    });
  } catch (err) {
    console.warn("Could not send via Edge Function:", err);
  }

  // 2. Intentar envío por Formspree Webhook para garantizar recepción inmediata
  try {
    await fetch("https://formspree.io/f/xknkqpoy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        _subject: `🚨 ALERTA SEGURIDAD: Inicio de sesión Panel Maestro (${loginInfo.location})`,
        email_notificacion: targetEmail,
        usuario_maestro: loginInfo.email,
        direccion_ip: loginInfo.ip,
        ubicacion_geografica: loginInfo.location,
        proveedor_isp: loginInfo.isp,
        dispositivo: loginInfo.device,
        fecha_hora: loginInfo.timestamp,
        alerta: `Inicio de sesión al Panel Maestro detectado desde ${loginInfo.location} (IP: ${loginInfo.ip})`
      })
    });
  } catch (err) {
    console.warn("Formspree fallback email attempt:", err);
  }
};
