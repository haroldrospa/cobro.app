import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LoadingLogo } from '@/components/ui/loading-logo';

/**
 * Elemento de la ruta "/". Revisa la sesión con un componente mínimo sin
 * dependencias pesadas y redirige siempre: a /app si hay sesión, a /auth
 * si no la hay. Si vienen parámetros de autenticación (code, recovery),
 * los transfiere a /auth para que no se pierda el flujo de recuperación.
 */
const RootRoute: React.FC = () => {
    const [checked, setChecked] = useState(false);
    const [hasSession, setHasSession] = useState(false);
    const location = useLocation();

    // Si viene un código de recuperación o autenticación en la URL raíz, pasarlo directamente a /auth
    if (
        location.search.includes('code=') ||
        location.search.includes('recovery') ||
        location.search.includes('reset=true') ||
        location.hash.includes('recovery') ||
        location.hash.includes('access_token')
    ) {
        return <Navigate to={`/auth${location.search}${location.hash}`} replace />;
    }

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
