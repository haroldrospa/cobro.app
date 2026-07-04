/**
 * POSSearchContext — Aísla el estado de búsqueda del POS del árbol principal.
 *
 * PROPÓSITO DE RENDIMIENTO:
 * Sin este context, cada keystroke del usuario en el input de búsqueda dispara
 * un re-render completo del árbol POS (carrito, totales, menús, diálogos).
 * Al mover `searchTerm` aquí, solo los componentes suscritos a este context
 * se re-renderizan al escribir — el árbol raíz no se toca.
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface POSSearchContextValue {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
}

const POSSearchContext = createContext<POSSearchContextValue>({
  searchTerm: '',
  setSearchTerm: () => {},
  clearSearch: () => {},
});

export const POSSearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchTerm, setSearchTermState] = useState('');

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermState(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTermState('');
  }, []);

  const value = useMemo(() => ({ searchTerm, setSearchTerm, clearSearch }), [searchTerm, setSearchTerm, clearSearch]);

  return (
    <POSSearchContext.Provider value={value}>
      {children}
    </POSSearchContext.Provider>
  );
};

export const usePOSSearch = () => useContext(POSSearchContext);
