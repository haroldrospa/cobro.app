import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Search, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStoreByUserNumber } from '@/hooks/useStore';
import { useToast } from '@/hooks/use-toast';

const BuscarTienda: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userCode, setUserCode] = useState('');
  const [searchCode, setSearchCode] = useState('');
  
  const { data: store, isLoading, error } = useStoreByUserNumber(searchCode || undefined);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const code = userCode.trim().toUpperCase();
    if (!code) {
      toast({ title: 'Ingresa un código', variant: 'destructive' });
      return;
    }
    setSearchCode(code);
  };

  React.useEffect(() => {
    if (store && !isLoading) {
      navigate(`/tienda/${store.slug}`);
    } else if (searchCode && !isLoading && !store) {
      toast({ 
        title: 'Tienda no encontrada', 
        description: 'Verifica el código e intenta nuevamente.',
        variant: 'destructive' 
      });
      setSearchCode('');
    }
  }, [store, isLoading, searchCode, navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Buscar Tienda</CardTitle>
          <CardDescription>
            Ingresa el código de la tienda para acceder a sus productos
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Código de Tienda</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ej: BP-000004"
                  value={userCode}
                  onChange={e => setUserCode(e.target.value)}
                  className="pl-10 uppercase"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Este código te lo proporciona el vendedor
              </p>
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                'Buscando...'
              ) : (
                <>
                  Ir a la Tienda
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BuscarTienda;
