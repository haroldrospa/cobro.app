import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LoadingLogo } from '@/components/ui/loading-logo';

/**
 * Elemento de la ruta "/". Revisa la sesión con un componente mínimo sin
 * dependencias pesadas y redirige siempre: a /app si hay sesión, a /auth
 * si no la hay. Ya no se monta el Landing de marketing acá — la app nativa
 * (que arranca en /pos, ver capacitor.config.ts) ya iba directo al login
 * sin pasar por acá, y por pedido se unificó el mismo comportamiento para
 * la raíz web. El componente Landing.tsx queda intacto por si se quiere
 * volver a enrutar (ej. en una URL de marketing separada).
 */
const RootRoute: React.FC = () => {
    const [checked, setChecked] = useState(false);
    const [hasSession, setHasSession] = useState(false);

    useEffect(() => {
        let cancelled = false;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (cancelled) return;
            setHasSession(!!session);
            setChecked(true);
        });
        return () => { cancelled = true; };
    }, []);

    if (!checked) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background z-[9999]">
                <LoadingLogo />
            </div>
        );
    }

    return <Navigate to={hasSession ? '/app' : '/auth'} replace />;
};

export default RootRoute;
