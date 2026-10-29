import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  id: string;
  className?: string;
  imageClassName?: string;
  fallbackText?: string;
}

// Mapeo exhaustivo y exacto a los archivos oficiales descargados de RecargameYa
const RECARGAMEYA_LOGOS: Record<string, string> = {
  // Operadoras Móviles RD y Haití
  claro: '/logos/services/claro.png',
  altice: '/logos/services/altice.png',
  viva: '/logos/services/viva.jpg',
  digicel: '/logos/services/digicel.png',
  natcom: '/logos/services/natcom.png',
  wind: '/logos/services/wind_telecom.png',
  wind_telecom: '/logos/services/wind_telecom.png',

  // Luz Prepago y Electricidad
  edesur: '/logos/services/edesur.png',
  edesur_prepago: '/logos/services/edesur.png',
  edenorte: '/logos/services/edenorte.png',
  edenorte_prepago: '/logos/services/edenorte.png',
  edeeste: '/logos/services/edeeste.png',
  edeeste_prepago: '/logos/services/edeeste.png',
  cepm: '/logos/services/cepm.png',
  cepm_prepago: '/logos/services/cepm.png',
  ceb: '/logos/services/ceb.png',
  ceb_prepago: '/logos/services/ceb.png',
  luz_y_fuerza: '/logos/services/luz_y_fuerza.png',
  luz_y_fuerza_prepago: '/logos/services/luz_y_fuerza.png',

  // Remesas a Haití
  moncash: '/logos/services/moncash.png',
  natcash: '/logos/services/natcash.png',

  // Agua y Acueductos
  caasd: '/logos/services/caasd.png',
  coraasan: '/logos/services/coraasan.jpg',
  coraaplata: '/logos/services/coraaplata.png',
  coraavega: '/logos/services/coraavega.png',
  coaarom: '/logos/services/coaarom.png',
  asdn: '/logos/services/asdn.jpg',
  inapa: '/logos/services/inapa.png',

  // Impuestos y Gobierno
  dgii: '/logos/services/dgii.png',
  tss: '/logos/services/tss.png',
  adn: '/logos/services/adn.png',
  pgr_multas: '/logos/services/pgr_multas.jpg',
  digesett: '/logos/services/pgr_multas.jpg',
  senasa: '/logos/services/senasa.png',

  // Universidades y Educación
  uapa: '/logos/services/uapa.png',
  unapec: '/logos/services/unapec.png',
  unibe: '/logos/services/unibe.png',
  utel: '/logos/services/utel.png',
  infotep: '/logos/services/infotep.png',

  // TV, Cable e Internet
  starcable: '/logos/services/starcable.png',
  telecasa: '/logos/services/telecasa.png',
  milchans: '/logos/services/milchans.webp',

  // Financieras y Crédito
  credigo: '/logos/services/credigo.jpg',
  krece: '/logos/services/krece.png',
  solucredito: '/logos/services/solucredito.png',
  paycash: '/logos/services/paycash.png',
  paso_rapido: '/logos/services/paso_rapido.png',
  moneyshop: '/logos/services/moneyshop.png',

  // Catálogos y Cosméticos
  avon: '/logos/services/avon.png',
  belcorp: '/logos/services/belcorp.png',

  // Apuestas Deportivas
  betcris: '/logos/services/betcris.png',
  starsport: '/logos/services/starsport.png',
  juancito_sport: '/logos/services/juancito_sport.jpg',
  activa: '/logos/services/activa.png',

  // Seguros
  angloamericana: '/logos/services/angloamericana.jpg',
  seguro_midas: '/logos/services/seguro-midas.jpg',
  midas: '/logos/services/seguro-midas.jpg',

  // Gaming y Recreación Digital
  freefire: '/logos/services/freefire.webp',
  free_fire: '/logos/services/freefire.webp',
  mobile_legends: '/logos/services/mobile_legends.png',
  pubg: '/logos/services/pubg.jpg',
  roblox: '/logos/services/roblox.png',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  id,
  className = "w-10 h-10",
  imageClassName = "max-w-full max-h-full object-contain",
  fallbackText,
}) => {
  const [hasError, setHasError] = useState(false);
  const normalizedId = id.toLowerCase().trim();
  const src = RECARGAMEYA_LOGOS[normalizedId];

  if (!src || hasError) {
    return (
      <div
        className={cn(
          "rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center font-bold text-xs text-foreground uppercase shrink-0 select-none shadow-2xs",
          className
        )}
      >
        {fallbackText || id.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl bg-white border border-border/40 p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden",
        className
      )}
    >
      <img
        src={src}
        alt={id}
        loading="lazy"
        onError={() => setHasError(true)}
        className={cn("w-full h-full", imageClassName)}
      />
    </div>
  );
};

export default BrandLogo;
