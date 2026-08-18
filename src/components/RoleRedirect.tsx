import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserProfile } from '@/hooks/useUserProfile';
import { LoadingLogo } from '@/components/ui/loading-logo';

const RoleRedirect: React.FC = () => {
    const { profile, isLoading } = useUserProfile();

    if (isLoading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background z-[9999]">
                <LoadingLogo />
            </div>
        );
    }

    // Si no hay perfil o no hay rol, por defecto al POS (más seguro para empleados)
    if (!profile || !profile.role) {
        return <Navigate to="/pos" replace />;
    }

    const roleLower = profile.role.toLowerCase();

    // Contador: va directo a Contabilidad
    if (roleLower === 'accountant') {
        return <Navigate to="/accounting" replace />;
    }

    // Cocinero: va a Cocina
    if (roleLower === 'kitchen') {
        return <Navigate to="/kitchen" replace />;
    }

    // Delivery: va a Pedidos Delivery
    if (roleLower === 'delivery') {
        return <Navigate to="/delivery" replace />;
    }

    // Roles que van al Dashboard directamente
    const adminRoles = ['admin', 'owner', 'manager'];
    
    if (adminRoles.includes(roleLower)) {
        return <Navigate to="/dashboard" replace />;
    }

    // Por defecto para cajeros / staff
    return <Navigate to="/pos" replace />;
};

export default RoleRedirect;
