import React, { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingLogo } from '@/components/ui/loading-logo';

const Landing = lazy(() => import('@/pages/Landing'));

/**
 * Elemento de la ruta raíz "/".
 * Muestra la página de inicio (Landing) de Cobroapp para que todos los usuarios
 * y visitantes conozcan la plataforma, sus módulos, precios y beneficios.
 * Si vienen parámetros de autenticación/recuperación (code, recovery, reset),
 * se transfieren directamente a /auth para que no se pierda el flujo de recuperación.
 */
const RootRoute: React.FC = () => {
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
