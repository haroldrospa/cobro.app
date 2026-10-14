export const extractTableFromNotes = (notes?: string | null, customerName?: string | null): string | null => {
  if (notes) {
    const match = notes.match(/\[MESA:\s*([^\]]+)\]/i);
    if (match) return match[1].trim();
  }
  if (customerName) {
    const trimmed = customerName.trim();
    // Detect "Mesa X - Person" and extract only "Mesa X"
    const dashMatch = trimmed.match(/^([a-zA-ZÁ-ÿ0-9\s]+?)\s*[-–—:]\s*(.+)$/i);
    if (dashMatch && /^mesa\b/i.test(dashMatch[1].trim())) {
      return dashMatch[1].trim();
    }
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

/**
 * Formats a table customer name as "Mesa X - Person" or simply "Mesa X" if no person is provided.
 * Avoids duplicating table prefixes like "Mesa 1 - Mesa 1 - Person".
 */
export const formatTableCustomerName = (tableName: string, personName?: string | null): string => {
  const cleanTable = tableName ? tableName.trim() : '';
  if (!personName) return cleanTable || 'Cliente';

  let cleanPerson = personName.trim();
  if (!cleanPerson) return cleanTable || 'Cliente';

  // If personName starts with cleanTable prefix, strip it
  if (cleanTable) {
    const prefixRegex = new RegExp(`^${cleanTable}\\s*[-–—:]\\s*`, 'i');
    cleanPerson = cleanPerson.replace(prefixRegex, '').trim();
    // Also strip generic "Mesa:" or "Mesa" prefix if it matches
    const mesaPrefixRegex = /^mesa[\s:-]*/i;
    if (cleanPerson.toLowerCase() === cleanTable.toLowerCase()) {
      return cleanTable;
    }
    if (!cleanPerson) return cleanTable;
    return `${cleanTable} - ${cleanPerson}`;
  }

  return cleanPerson;
};

/**
 * Extracts just the person name from "Mesa X - Person" or returns the name if it's already just a person
 */
export const extractPersonFromCustomerName = (customerName?: string | null, tableName?: string | null): string => {
  if (!customerName) return '';
  const trimmed = customerName.trim();
  const table = tableName ? tableName.trim() : extractTableFromNotes(null, trimmed);

  if (table) {
    const prefixRegex = new RegExp(`^${table}\\s*[-–—:]\\s*`, 'i');
    if (prefixRegex.test(trimmed)) {
      return trimmed.replace(prefixRegex, '').trim();
    }
    if (trimmed.toLowerCase() === table.toLowerCase()) {
      return '';
    }
  }

  // Try generic dash match
  const dashMatch = trimmed.match(/^mesa[\s0-9a-zA-Z]*\s*[-–—:]\s*(.+)$/i);
  if (dashMatch && dashMatch[1]) {
    return dashMatch[1].trim();
  }

  if (/^mesa\b/i.test(trimmed)) {
    return '';
  }

  return trimmed;
};

