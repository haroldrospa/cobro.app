import React from 'react';

interface BrandLogoProps {
  id: string;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ id, className = "w-6 h-6" }) => {
  switch (id) {
    // --- TELEFONÍA ---
    case 'claro':
    case 'claro_factura':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <circle cx="50" cy="50" r="46" fill="#DA291C" />
          <path d="M50 20C33.4 20 20 33.4 20 50C20 66.6 33.4 80 50 80C60.2 80 69.2 74.9 74.6 67.1C72 68.3 69.1 69 66 69C51.6 69 40 57.4 40 43C40 33.3 45.3 24.8 53.1 20.4C52.1 20.1 51 20 50 20Z" fill="white" />
          <circle cx="68" cy="38" r="8" fill="white" />
        </svg>
      );

    case 'altice':
    case 'altice_factura':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#000000" />
          <path d="M50 22C34.5 22 22 34.5 22 50C22 65.5 34.5 78 50 78C62.8 78 73.6 69.4 76.9 57.6C75.2 59.8 72.2 61.2 68.8 61.2C60.8 61.2 54.4 54.8 54.4 46.8C54.4 40.2 58.8 34.6 64.9 33C60.7 26.3 53.4 22 50 22Z" fill="#0084FF" />
          <path d="M72 32C69.8 32 68 33.8 68 36C68 38.2 69.8 40 72 40C74.2 40 76 38.2 76 36C76 33.8 74.2 32 72 32Z" fill="#00C4B4" />
        </svg>
      );

    case 'viva':
    case 'viva_pospago':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#73B72C" />
          <path d="M26 32L42 70H52L68 32H56L47 56L38 32H26Z" fill="white" />
          <circle cx="74" cy="32" r="6" fill="#F7A800" />
        </svg>
      );

    case 'digicel':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#ED1C24" />
          <circle cx="50" cy="50" r="26" fill="white" />
          <path d="M46 36H54V64H46V36Z" fill="#ED1C24" />
          <circle cx="50" cy="28" r="4" fill="white" />
        </svg>
      );

    case 'natcom':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#005BAA" />
          <path d="M28 68V32L54 56V32H68V68L42 44V68H28Z" fill="#FFD100" />
        </svg>
      );

    case 'wind':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#0033A0" />
          <path d="M25 50C25 36.2 36.2 25 50 25C63.8 25 75 36.2 75 50C75 63.8 63.8 75 50 75" stroke="#FF8200" strokeWidth="8" strokeLinecap="round" />
        </svg>
      );

    // --- ELECTRICIDAD ---
    case 'edesur':
    case 'edesur_prepago':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#E86C00" />
          <path d="M54 20L32 54H48L44 80L68 46H52L54 20Z" fill="#FFFFFF" />
          <circle cx="70" cy="28" r="8" fill="#FFD100" />
        </svg>
      );

    case 'edeeste':
    case 'edeeste_prepago':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#0072CE" />
          <path d="M54 20L32 54H48L44 80L68 46H52L54 20Z" fill="#FFC72C" />
        </svg>
      );

    case 'edenorte':
    case 'edenorte_prepago':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#003865" />
          <path d="M54 20L32 54H48L44 80L68 46H52L54 20Z" fill="#00A3E0" />
        </svg>
      );

    case 'cepm':
    case 'cepm_prepago':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#008080" />
          <path d="M30 65C40 40 60 40 70 65" stroke="white" strokeWidth="8" strokeLinecap="round" />
          <circle cx="50" cy="35" r="10" fill="#FFD700" />
        </svg>
      );

    // --- AGUA POTABLE ---
    case 'caasd':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#005B94" />
          <path d="M50 20C50 20 28 48 28 62C28 74.2 37.8 84 50 84C62.2 84 72 74.2 72 62C72 48 50 20 50 20Z" fill="#38BDF8" />
          <path d="M42 54C42 48 50 36 50 36C50 36 58 48 58 54C58 58.4 54.4 62 50 62C45.6 62 42 58.4 42 54Z" fill="white" />
        </svg>
      );

    case 'coraasan':
    case 'inapa':
    case 'coraamoca':
    case 'coraaplata':
    case 'coaarom':
    case 'coraavega':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#0284C7" />
          <path d="M50 22C50 22 30 46 30 60C30 71 39 80 50 80C61 80 70 71 70 60C70 46 50 22 50 22Z" fill="white" />
          <path d="M35 62C40 66 45 66 50 62C55 58 60 58 65 62" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    // --- GOBIERNO & INSTITUCIONAL ---
    case 'dgii':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#0F2042" />
          <rect x="25" y="30" width="50" height="40" rx="4" fill="#C59B27" />
          <path d="M35 42H65M35 50H65M35 58H50" stroke="#0F2042" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );

    case 'digesett':
    case 'policia_nacional':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#1E293B" />
          <path d="M50 20L72 30V52C72 66 62 76 50 80C38 76 28 66 28 52V30L50 20Z" fill="#EAB308" />
          <circle cx="50" cy="48" r="12" fill="#1E293B" />
        </svg>
      );

    case 'pasaportes_rd':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#002F6C" />
          <rect x="30" y="24" width="40" height="52" rx="4" fill="#C59B27" />
          <circle cx="50" cy="50" r="10" stroke="#002F6C" strokeWidth="3" />
        </svg>
      );

    // --- VIDEOJUEGOS & STREAMING ---
    case 'free_fire':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#FF5722" />
          <path d="M50 18L76 45L50 82L24 45L50 18Z" fill="#FFD700" stroke="#FFFFFF" strokeWidth="3" />
          <path d="M38 45L50 72L62 45L50 30L38 45Z" fill="#FFA000" />
        </svg>
      );

    case 'netflix':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#141414" />
          <path d="M32 20H42V80H32V20Z" fill="#E50914" />
          <path d="M58 20H68V80H58V20Z" fill="#E50914" />
          <path d="M32 20L68 80H58L32 24V20Z" fill="#B81D24" />
        </svg>
      );

    case 'spotify':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <circle cx="50" cy="50" r="46" fill="#1ED760" />
          <path d="M28 42C44 38 60 41 72 48" stroke="#121212" strokeWidth="7" strokeLinecap="round" />
          <path d="M32 53C46 50 58 52 68 58" stroke="#121212" strokeWidth="6" strokeLinecap="round" />
          <path d="M35 64C46 62 55 63 63 68" stroke="#121212" strokeWidth="5" strokeLinecap="round" />
        </svg>
      );

    case 'psn':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#003791" />
          <path d="M46 25L58 31V70L46 64V25Z" fill="white" />
          <path d="M58 38C68 40 76 48 76 58C76 68 64 74 54 71V62C60 64 66 61 66 56C66 51 60 47 54 46" fill="#0070D1" />
        </svg>
      );

    case 'xbox':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <circle cx="50" cy="50" r="46" fill="#107C10" />
          <path d="M26 30C36 44 48 58 50 64C52 58 64 44 74 30C66 24 58 22 50 22C42 22 34 24 26 30Z" fill="white" />
          <path d="M22 66C32 58 44 46 50 42C46 48 34 60 26 72C24 70 23 68 22 66Z" fill="white" />
          <path d="M78 66C68 58 56 46 50 42C54 48 66 60 74 72C76 70 77 68 78 66Z" fill="white" />
        </svg>
      );

    case 'roblox':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#000000" />
          <rect x="25" y="25" width="50" height="50" rx="6" transform="rotate(-15 50 50)" fill="#FFFFFF" />
          <rect x="42" y="42" width="16" height="16" rx="2" transform="rotate(-15 50 50)" fill="#000000" />
        </svg>
      );

    case 'google_play':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#F8FAFC" />
          <path d="M24 20L64 50L24 80V20Z" fill="#00E676" />
          <path d="M64 50L76 42L24 20L64 50Z" fill="#00B0FF" />
          <path d="M64 50L24 80L76 58L64 50Z" fill="#FF3D00" />
          <path d="M64 50L76 58L84 53C87 51 87 49 84 47L76 42L64 50Z" fill="#FFC400" />
        </svg>
      );

    case 'apple_itunes':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#000000" />
          <path d="M50 20C47 24 43 27 38 27C38 22 41 18 45 15C48 12 52 10 57 10C57 15 54 20 50 20ZM64 48C64 38 72 33 72 33C67 26 59 25 57 25C49 24 43 30 40 30C36 30 31 25 25 25C17 25 10 32 6 42C-1 57 5 79 13 89C17 94 21 99 27 99C32 99 35 96 41 96C47 96 49 99 55 99C61 99 66 94 69 89C74 81 76 75 76 74C76 74 64 69 64 48Z" fill="white" />
        </svg>
      );

    // --- CATÁLOGOS & COSMÉTICOS ---
    case 'avon':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#7E22CE" />
          <text x="50" y="62" fill="white" fontSize="28" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">AVON</text>
        </svg>
      );

    case 'belcorp':
    case 'yanbal':
    case 'cristel':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none">
          <rect width="100" height="100" rx="20" fill="#BE185D" />
          <circle cx="50" cy="50" r="24" stroke="white" strokeWidth="4" />
          <path d="M50 34V66M34 50H66" stroke="white" strokeWidth="4" />
        </svg>
      );

    // Default icon
    default:
      return (
        <div className={className + " bg-muted rounded-lg flex items-center justify-center font-bold text-xs text-foreground uppercase"}>
          {id.slice(0, 2)}
        </div>
      );
  }
};
