import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TableSection, DEFAULT_TABLE_SECTIONS } from '@/types/tableConfig';
import { useUserStore } from '@/hooks/useUserStore';
import { useStoreSettings } from '@/hooks/useStoreSettings';

const STORAGE_KEY_PREFIX = 'cobro_table_sections_';

export const useTableConfig = () => {
  const queryClient = useQueryClient();
  const { data: userStore } = useUserStore();
  const { settings: storeSettings, updateSettings } = useStoreSettings();
  const storeId = userStore?.id || 'default';

  const storageKey = `${STORAGE_KEY_PREFIX}${storeId}`;

  const { data: sections = DEFAULT_TABLE_SECTIONS, isLoading } = useQuery<TableSection[]>({
    queryKey: ['table-sections', storeId],
    queryFn: () => {
      try {
        const local = localStorage.getItem(storageKey);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }

        if (Array.isArray(storeSettings?.table_sections) && storeSettings.table_sections.length > 0) {
          localStorage.setItem(storageKey, JSON.stringify(storeSettings.table_sections));
          return storeSettings.table_sections as TableSection[];
        }
      } catch (err) {
        console.error('Error al cargar configuración de mesas:', err);
      }
      return DEFAULT_TABLE_SECTIONS;
    },
    staleTime: Infinity,
  });

  const saveSections = useCallback(
    async (newSections: TableSection[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newSections));
        queryClient.setQueryData(['table-sections', storeId], newSections);
        // Persistir también en settings sincronizados de la tienda
        await updateSettings({ table_sections: newSections });
      } catch (err) {
        console.error('Error al guardar configuración de mesas:', err);
      }
    },
    [storageKey, storeId, queryClient, updateSettings]
  );

  const addSection = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const id = trimmed
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);

      const updated = [...sections, { id, name: trimmed, tables: [] }];
      await saveSections(updated);
    },
    [sections, saveSections]
  );

  const updateSection = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const updated = sections.map((sec) => (sec.id === id ? { ...sec, name: trimmed } : sec));
      await saveSections(updated);
    },
    [sections, saveSections]
  );

  const deleteSection = useCallback(
    async (id: string) => {
      const updated = sections.filter((sec) => sec.id !== id);
      await saveSections(updated);
    },
    [sections, saveSections]
  );

  const addTable = useCallback(
    async (sectionId: string, tableName: string) => {
      const trimmed = tableName.trim();
      if (!trimmed) return;
      const updated = sections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        if (sec.tables.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return sec;
        return { ...sec, tables: [...sec.tables, trimmed] };
      });
      await saveSections(updated);
    },
    [sections, saveSections]
  );

  const updateTable = useCallback(
    async (sectionId: string, oldName: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      const updated = sections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          tables: sec.tables.map((t) => (t.toLowerCase() === oldName.toLowerCase() ? trimmed : t)),
        };
      });
      await saveSections(updated);
    },
    [sections, saveSections]
  );

  const removeTable = useCallback(
    async (sectionId: string, tableName: string) => {
      const updated = sections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          tables: sec.tables.filter((t) => t.toLowerCase() !== tableName.toLowerCase()),
        };
      });
      await saveSections(updated);
    },
    [sections, saveSections]
  );

  const generateTables = useCallback(
    async (sectionId: string, prefix: string, count: number, startFrom: number = 1) => {
      const cleanPrefix = prefix.trim();
      const n = Math.min(Math.max(1, count), 100);
      const generated: string[] = [];
      for (let i = 0; i < n; i++) {
        const num = startFrom + i;
        generated.push(cleanPrefix ? `${cleanPrefix} ${num}` : `Mesa ${num}`);
      }

      const updated = sections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        // Evitar duplicados
        const existingLower = new Set(sec.tables.map((t) => t.toLowerCase()));
        const toAdd = generated.filter((t) => !existingLower.has(t.toLowerCase()));
        return { ...sec, tables: [...sec.tables, ...toAdd] };
      });
      await saveSections(updated);
    },
    [sections, saveSections]
  );

  const resetToDefaults = useCallback(async () => {
    await saveSections(DEFAULT_TABLE_SECTIONS);
  }, [saveSections]);

  return {
    sections,
    isLoading,
    saveSections,
    addSection,
    updateSection,
    deleteSection,
    addTable,
    updateTable,
    removeTable,
    generateTables,
    resetToDefaults,
  };
};
