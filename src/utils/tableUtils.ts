export const extractTableFromNotes = (notes?: string | null): string | null => {
  if (!notes) return null;
  const match = notes.match(/\[MESA:\s*([^\]]+)\]/i);
  return match ? match[1].trim() : null;
};
