export const extractTableFromNotes = (notes?: string | null, customerName?: string | null): string | null => {
  if (notes) {
    const match = notes.match(/\[MESA:\s*([^\]]+)\]/i);
    if (match) return match[1].trim();
  }
  if (customerName) {
    const trimmed = customerName.trim();
    const match = trimmed.match(/^mesa[\s:-]*(.*)$/i);
    if (match && match[1]) {
      const rest = match[1].trim();
      if (!rest) return 'Mesa';
      return rest.toLowerCase().startsWith('mesa') ? rest : `Mesa ${rest}`;
    }
    if (/^mesa\b/i.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
};
