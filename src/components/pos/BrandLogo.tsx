import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  id: string;
  className?: string;
  imageClassName?: string;
  fallbackText?: string;
}

const LOGO_MAP: Record<string, string> = {
  // --- TELEFONÍA & INTERNET ---
  claro: '/logos/services/claro.svg',
  claro_factura: '/logos/services/claro.svg',
  altice: '/logos/services/altice.png',
  altice_factura: '/logos/services/altice.png',
  viva: '/logos/services/viva.png',
  viva_pospago: '/logos/services/viva.png',
  wind: '/logos/services/wind.png',
  digicel: '/logos/services/digicel.png',
  natcom: '/logos/services/digicel.png',
  moun: '/logos/services/claro.svg',
  sky: '/logos/services/wind.png',
  aster: '/logos/services/wind.png',
  telecable_central: '/logos/services/wind.png',
  activa_telecable: '/logos/services/wind.png',

  // --- ELECTRICIDAD ---
  edesur: '/logos/services/edesur.png',
  edesur_prepago: '/logos/services/edesur.png',
  edeeste: '/logos/services/edeeste.png',
  edeeste_prepago: '/logos/services/edeeste.png',
  edenorte: '/logos/services/edenorte.png',
  edenorte_prepago: '/logos/services/edenorte.png',
  cepm: '/logos/services/cepm.png',
  cepm_prepago: '/logos/services/cepm.png',
  cepp: '/logos/services/edenorte.png',

  // --- AGUA POTABLE ---
  caasd: '/logos/services/caasd.png',
  coraasan: '/logos/services/coraasan.png',
  inapa: '/logos/services/inapa.png',
  coraamoca: '/logos/services/CORAAMOCA.png',
  coaarom: '/logos/services/COAAROM.png',
  coraavega: '/logos/services/CORAAVEGA.png',
  coraaplata: '/logos/services/coraasan.png',

  // --- GOBIERNO & IMPUESTOS ---
  dgii: '/logos/services/dgii.png',
  digesett: '/logos/services/digesett.png',
  senasa: '/logos/services/senasa.png',
  policia_nacional: '/logos/services/PN.png',
  pasaportes_rd: '/logos/services/DGP.png',
  alcaldia_adn: '/logos/services/ADN.png',
  alcaldia_asde: '/logos/services/ASDE.png',
  alcaldia_santiago: '/logos/services/coraasan.png',

  // --- CATÁLOGOS & BELLEZA ---
  avon: '/logos/services/avon.png',
  belcorp: '/logos/services/belcorp.png',
  yanbal: '/logos/services/belcorp.png',
  cristel: '/logos/services/belcorp.png',

  // --- VIDEOJUEGOS & STREAMING ---
  free_fire: '/logos/services/free_fire.png',
  netflix: '/logos/services/netflix.svg',
  spotify: '/logos/services/spotify.svg',
  psn: '/logos/services/psn.svg',
  xbox: '/logos/services/xbox.svg',
  roblox: '/logos/services/roblox.svg',
  google_play: '/logos/services/google_play.svg',
  apple_itunes: '/logos/services/apple.svg',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  id,
  className = "w-10 h-10",
  imageClassName = "max-w-full max-h-full object-contain",
  fallbackText,
}) => {
  const [hasError, setHasError] = useState(false);
  const src = LOGO_MAP[id.toLowerCase()];

  if (!src || hasError) {
    return (
      <div
        className={cn(
          "rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center font-bold text-xs text-foreground uppercase shrink-0 shadow-2xs select-none",
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
        "rounded-xl bg-white dark:bg-zinc-900/90 border border-border/50 p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden transition-transform",
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
