
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/hooks/useUserStore";

const StoreSuspended = () => {
    const navigate = useNavigate();
    const { data: store } = useUserStore();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
            <Card className="w-full max-w-lg border-red-900/50 bg-gray-950 text-white shadow-2xl">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                        <Lock className="w-8 h-8 text-red-500" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-red-500">
                        Acceso Suspendido
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-lg">
                        Esta tienda ha sido desactivada temporalmente.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-red-950/30 p-4 rounded-lg border border-red-900/50">
                        <p className="text-sm text-gray-300 text-center">
                            Para restaurar el acceso al sistema, por favor contacte al departamento de soporte inmediatamente.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-3 bg-gray-900 rounded-lg">
                            <div className="bg-primary/20 p-2 rounded-full">
                                <Phone className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Línea Directa / WhatsApp</div>
                                <div className="font-mono text-lg font-bold">809-917-5744</div>
                            </div>
                        </div>

                        {store?.store_code && (
                            <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-800">
                                <div className="text-sm text-gray-400">Código de tu Tienda:</div>
                                <div className="font-mono text-lg font-bold text-white bg-gray-800 px-3 py-1 rounded">
                                    {store.store_code}
                                </div>
                            </div>
                        )}
                    </div>

                    <Button
                        variant="outline"
                        className="w-full border-gray-700 hover:bg-gray-800"
                        onClick={handleLogout}
                    >
                        Cerrar Sesión
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default StoreSuspended;
