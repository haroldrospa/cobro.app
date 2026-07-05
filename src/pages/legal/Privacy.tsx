import React from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">Cobro App</span>
          </Link>
          <Button asChild variant="outline">
            <Link to="/">Volver al Inicio</Link>
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-3xl flex-grow">
        <div className="bg-white rounded-2xl shadow-sm border p-8 md:p-12 prose prose-blue max-w-none">
          <h1 className="text-3xl font-bold mb-6">Política de Privacidad</h1>
          <p className="text-gray-500 mb-8">Última actualización: {new Date().toLocaleDateString()}</p>
          
          <p>
            En Cobro App valoramos enormemente tu privacidad. Esta política explica cómo recopilamos,
            usamos y protegemos tu información personal y los datos de tu negocio.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">1. Información que Recopilamos</h2>
          <p>
            Recopilamos información que nos proporcionas al registrarte, como tu nombre, correo electrónico,
            información de tu empresa, e inventario. Toda información financiera de pagos con tarjeta es manejada
            exclusivamente por nuestro procesador de pagos seguro (Paddle) y no es almacenada en nuestros servidores.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">2. Uso de la Información</h2>
          <p>
            Utilizamos tus datos exclusivamente para proveer, mantener y mejorar la plataforma Cobro App,
            así como para comunicarnos contigo sobre actualizaciones del servicio o soporte técnico.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">3. Protección de Datos</h2>
          <p>
            Tus datos están protegidos mediante cifrado estándar de la industria. No vendemos ni compartimos
            la información de tus clientes o inventario con terceros no autorizados.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">4. Cookies y Tecnologías Similares</h2>
          <p>
            Usamos cookies para mantener tu sesión activa y analizar el tráfico de forma anónima para 
            mejorar nuestro servicio.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">5. Derechos del Usuario</h2>
          <p>
            Tienes derecho a acceder, corregir o eliminar tus datos personales y los de tu negocio 
            en cualquier momento a través de la configuración de tu cuenta o contactando a soporte.
          </p>
        </div>
      </div>
    </div>
  );
}
