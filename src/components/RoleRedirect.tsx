import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserProfile } from '@/hooks/useUserProfile';
import { LoadingLogo } from '@/components/ui/loading-logo';

const RoleRedirect: React.FC = () => {
    const { profile, isLoading } = useUserProfile();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <LoadingLogo text="Preparando tu espacio..." />
            </div>
        );
    }

    // Si no hay perfil o no hay rol, por defecto al POS (más seguro para empleados)
    if (!profile || !profile.role) {
        return <Navigate to="/pos" replace />;
    }

    // Roles que van al Dashboard directamente
    const adminRoles = ['admin', 'owner', 'manager'];
    
    if (adminRoles.includes(profile.role.toLowerCase())) {
        return <Navigate to="/dashboard" replace />;
    }

    // Por defecto para cajeros, delivery, etc.
    return <Navigate to="/pos" replace />;
};

export default RoleRedirect;
