
import React from 'react';
import { Button } from '@/components/ui/button';

interface ProductFormActionsProps {
  onClose: () => void;
  isLoading: boolean;
}

export const ProductFormActions: React.FC<ProductFormActionsProps> = ({
  onClose,
  isLoading,
}) => {
  return (
    <div className="flex gap-2 pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        className="flex-1"
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        className="flex-1"
        disabled={isLoading}
      >
        {isLoading ? 'Guardando...' : 'Guardar'}
      </Button>
    </div>
  );
};
