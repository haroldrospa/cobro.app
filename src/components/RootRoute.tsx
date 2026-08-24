import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LoadingLogo } from '@/components/ui/loading-logo';

const Landing = lazy(() => import('@/pages/Landing'));

/**
 * Elemento de la ruta "/". Antes esto era directamente <Landing /> — lo que
 * significa que CUALQUIER carga de la app (incluida la app nativa Android,
 * que arranca en "/") primero descargaba y montaba toda la landing de
 * marketing (framer-motion + imagen hero de ~600KB) para un usuario que ya
 * tenía sesión iniciada, antes de que Landing.tsx recién ahí revisara la
 * sesión y redirigiera a /app. Eso solo (medido en logcat durante un cold
 * start real) se comía ~2 de los 4 segundos de arranque en la tablet.
 *
 * Acá se revisa la sesión PRIMERO, con un componente mínimo sin
 * dependencias pesadas — si ya hay sesión, redirige directo sin llegar a
 * importar Landing en absoluto. Si no hay sesión (primera vez / deslogueado),
 * recién ahí se carga la landing normal.
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

    if (hasSession) {
        return <Navigate to="/app" replace />;
    }

    return (
        <Suspense fallback={
            <div className="fixed inset-0 flex items-center justify-center bg-background z-[9999]">
                <LoadingLogo />
            </div>
        }>
            <Landing />
        </Suspense>
    );
};

export default RootRoute;
