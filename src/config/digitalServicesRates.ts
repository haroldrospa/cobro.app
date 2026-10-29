// Configuración Oficial de Tarifas y Comisiones de RecargameYa
// Regla de Negocio: Split 50/50 exacto entre CobroApp (Dueño) y el Comercio/Usuario.
// Al usuario/cajero SOLO se le muestra su parte (el 50%), nunca la ganancia del dueño.

export type RateType = 'percentage' | 'fixed';

export interface ServiceCommissionConfig {
  id: string;
  name: string;
  rateType: RateType;
  grossRate: number;      // Lo que paga RecargameYa en total al dueño de CobroApp
  userRate: number;       // La mitad (50%) que se gana el usuario/comercio
  ownerRate: number;      // La otra mitad (50%) que se queda el dueño de CobroApp
  displayBadge: string;   // Texto del badge que ve el usuario (ej. "2.75% com." o "+RD$ 2.00 ganancia")
}

// 1. OPERADORAS MÓVILES - RECARGAS DE SALDO (RD Y HAITÍ)
export const MOBILE_OPERATORS_RATES: Record<string, { grossRate: number; userRate: number; badge: string }> = {
  claro: { grossRate: 5.50, userRate: 2.75, badge: '2.75% com.' },
  altice: { grossRate: 5.50, userRate: 2.75, badge: '2.75% com.' },
  viva: { grossRate: 5.50, userRate: 2.75, badge: '2.75% com.' },
  digicel: { grossRate: 6.00, userRate: 3.00, badge: '3.00% com.' },
  natcom: { grossRate: 6.00, userRate: 3.00, badge: '3.00% com.' },
  wind_telecom: { grossRate: 2.50, userRate: 1.25, badge: '1.25% com.' },
  wind: { grossRate: 2.50, userRate: 1.25, badge: '1.25% com.' },
};

// 2. LUZ PREPAGO (RD)
export const PREPAID_POWER_RATES: Record<string, { rateType: RateType; grossRate: number; userRate: number; badge: string }> = {
  edesur_prepago: { rateType: 'percentage', grossRate: 2.00, userRate: 1.00, badge: '1.00% com.' },
  edenorte_prepago: { rateType: 'percentage', grossRate: 2.00, userRate: 1.00, badge: '1.00% com.' },
  edeeste_prepago: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  cepm_prepago: { rateType: 'percentage', grossRate: 1.00, userRate: 0.50, badge: '0.50% com.' },
  ceb_prepago: { rateType: 'percentage', grossRate: 1.00, userRate: 0.50, badge: '0.50% com.' },
  cepn_prepago: { rateType: 'percentage', grossRate: 1.00, userRate: 0.50, badge: '0.50% com.' },
  luz_y_fuerza_prepago: { rateType: 'fixed', grossRate: 2.00, userRate: 1.00, badge: '+RD$ 1.00 ganancia' },
};

// 3. REMESAS A HAITÍ
export const REMITTANCE_RATES: Record<string, { rateType: RateType; grossRate: number; userRate: number; badge: string }> = {
  moncash: { rateType: 'percentage', grossRate: 5.00, userRate: 2.50, badge: '2.50% com.' },
  natcash: { rateType: 'percentage', grossRate: 5.00, userRate: 2.50, badge: '2.50% com.' },
};

// 4. FACTURAS, GOBIERNO, UNIVERSIDADES, CABLE, AGUA Y SERVICIOS
export const BILLERS_RATES: Record<string, { rateType: RateType; grossRate: number; userRate: number; badge: string }> = {
  // Agua y Acueductos
  caasd: { rateType: 'percentage', grossRate: 1.50, userRate: 0.75, badge: '0.75% com.' },
  coraaplata: { rateType: 'percentage', grossRate: 1.50, userRate: 0.75, badge: '0.75% com.' },
  coraasan: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  coraavega: { rateType: 'percentage', grossRate: 1.50, userRate: 0.75, badge: '0.75% com.' },
  coaarom: { rateType: 'fixed', grossRate: 1.00, userRate: 0.50, badge: '+RD$ 0.50 ganancia' },
  inapa: { rateType: 'fixed', grossRate: 1.50, userRate: 0.75, badge: '+RD$ 0.75 ganancia' },
  asdn: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },

  // Impuestos y Gobierno
  dgii: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  tss: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  adn: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  pgr_multas: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  infotep: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },

  // Educación / Universidades
  uapa: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  unapec: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  unibe: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  utel: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },

  // TV, Cable e Internet
  starcable: { rateType: 'percentage', grossRate: 1.00, userRate: 0.50, badge: '0.50% com.' },
  telecasa: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  milchans: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  activa: { rateType: 'percentage', grossRate: 1.00, userRate: 0.50, badge: '0.50% com.' },
  aster: { rateType: 'fixed', grossRate: 1.50, userRate: 0.75, badge: '+RD$ 0.75 ganancia' },

  // Financieras y Créditos
  paso_rapido: { rateType: 'percentage', grossRate: 1.50, userRate: 0.75, badge: '0.75% com.' },
  credigo: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  krece: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  solucredito: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  paycash: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  moneyshop: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },

  // Catálogos y Cosméticos
  avon: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  belcorp: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },

  // Bancas y Apuestas
  betcris: { rateType: 'percentage', grossRate: 2.50, userRate: 1.25, badge: '1.25% com.' },
  juancito_sport: { rateType: 'percentage', grossRate: 5.00, userRate: 2.50, badge: '2.50% com.' },
  starsport: { rateType: 'percentage', grossRate: 2.50, userRate: 1.25, badge: '1.25% com.' },
  loteria_nacional: { rateType: 'percentage', grossRate: 9.00, userRate: 4.50, badge: '4.50% com.' },

  // Seguros
  angloamericana: { rateType: 'percentage', grossRate: 9.00, userRate: 4.50, badge: '4.50% com.' },
  seguro_midas: { rateType: 'percentage', grossRate: 9.00, userRate: 4.50, badge: '4.50% com.' },
  seguro_vehiculo: { rateType: 'percentage', grossRate: 9.00, userRate: 4.50, badge: '4.50% com.' },

  // Gaming
  freefire: { rateType: 'percentage', grossRate: 5.00, userRate: 2.50, badge: '2.50% com.' },
  mobile_legends: { rateType: 'percentage', grossRate: 5.00, userRate: 2.50, badge: '2.50% com.' },
  pubg: { rateType: 'percentage', grossRate: 5.00, userRate: 2.50, badge: '2.50% com.' },
  roblox: { rateType: 'percentage', grossRate: 5.00, userRate: 2.50, badge: '2.50% com.' },

  // Facturas de Luz Postpago
  ceb: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  cepm: { rateType: 'percentage', grossRate: 4.00, userRate: 2.00, badge: '2.00% com.' },
  edeeste: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  edenorte: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  edesur: { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' },
  luz_y_fuerza: { rateType: 'fixed', grossRate: 2.00, userRate: 1.00, badge: '+RD$ 1.00 ganancia' },
};

/**
 * Función centralizada para calcular la comisión con la regla 50/50.
 * Retorna la ganancia del usuario (50%), la ganancia del dueño (50%) y el costo a debitar de la billetera.
 */
export function calculateDigitalServiceCommission(
  serviceId: string,
  amount: number,
  serviceType: 'recharge' | 'data_package' | 'bill_payment' | 'prepaid_power' | 'remittance'
): {
  grossCommission: number;
  userCommission: number;
  ownerCommission: number;
  costAmount: number;
  displayUserRate: string;
} {
  const normId = serviceId.toLowerCase().trim();
  const numAmount = Number(amount) || 0;

  // 1. Recargas de Saldo
  if (serviceType === 'recharge' || serviceType === 'data_package') {
    const config = MOBILE_OPERATORS_RATES[normId] || { grossRate: 5.50, userRate: 2.75, badge: '2.75% com.' };
    const grossCommission = Math.round((numAmount * (config.grossRate / 100)) * 100) / 100;
    const userCommission = Math.round((grossCommission / 2) * 100) / 100;
    const ownerCommission = Math.round((grossCommission - userCommission) * 100) / 100;
    const costAmount = Math.max(0, Math.round((numAmount - userCommission) * 100) / 100);

    return {
      grossCommission,
      userCommission,
      ownerCommission,
      costAmount,
      displayUserRate: config.badge,
    };
  }

  // 2. Luz Prepago
  if (serviceType === 'prepaid_power') {
    const config = PREPAID_POWER_RATES[normId] || { rateType: 'percentage', grossRate: 2.00, userRate: 1.00, badge: '1.00% com.' };
    let grossCommission = 0;
    if (config.rateType === 'percentage') {
      grossCommission = Math.round((numAmount * (config.grossRate / 100)) * 100) / 100;
    } else {
      grossCommission = config.grossRate;
    }

    const userCommission = Math.round((grossCommission / 2) * 100) / 100;
    const ownerCommission = Math.round((grossCommission - userCommission) * 100) / 100;
    const costAmount = Math.max(0, Math.round((numAmount - userCommission) * 100) / 100);

    return {
      grossCommission,
      userCommission,
      ownerCommission,
      costAmount,
      displayUserRate: config.badge,
    };
  }

  // 3. Remesas a Haití
  if (serviceType === 'remittance') {
    const config = REMITTANCE_RATES[normId] || { rateType: 'percentage', grossRate: 5.00, userRate: 2.50, badge: '2.50% com.' };
    const grossCommission = Math.round((numAmount * (config.grossRate / 100)) * 100) / 100;
    const userCommission = Math.round((grossCommission / 2) * 100) / 100;
    const ownerCommission = Math.round((grossCommission - userCommission) * 100) / 100;
    const costAmount = Math.max(0, Math.round((numAmount - userCommission) * 100) / 100);

    return {
      grossCommission,
      userCommission,
      ownerCommission,
      costAmount,
      displayUserRate: config.badge,
    };
  }

  // 4. Facturas y Servicios Generales
  const config = BILLERS_RATES[normId] || { rateType: 'fixed', grossRate: 4.00, userRate: 2.00, badge: '+RD$ 2.00 ganancia' };
  let grossCommission = 0;
  if (config.rateType === 'percentage') {
    grossCommission = Math.round((numAmount * (config.grossRate / 100)) * 100) / 100;
  } else {
    grossCommission = config.grossRate;
  }

  const userCommission = Math.round((grossCommission / 2) * 100) / 100;
  const ownerCommission = Math.round((grossCommission - userCommission) * 100) / 100;
  const costAmount = Math.max(0, Math.round((numAmount - userCommission) * 100) / 100);

  return {
    grossCommission,
    userCommission,
    ownerCommission,
    costAmount,
    displayUserRate: config.badge,
  };
}
