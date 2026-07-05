import React from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Terms() {
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
          <h1 className="text-3xl font-bold mb-6">Términos de Servicio</h1>
          <p className="text-gray-500 mb-8">Última actualización: {new Date().toLocaleDateString()}</p>
          
          <p>
            Al utilizar Cobro App, aceptas estos Términos de Servicio. Por favor, léelos cuidadosamente
            antes de acceder o usar nuestra plataforma.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">1. Aceptación de los Términos</h2>
          <p>
            Al acceder a nuestra plataforma, confirmas que has leído, entendido y aceptas estar 
            sujeto a estos Términos. Si no estás de acuerdo, no debes utilizar nuestros servicios.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">2. Descripción del Servicio</h2>
          <p>
            Cobro App es un software como servicio (SaaS) que proporciona herramientas de facturación,
            punto de venta (POS) y gestión de inventario para comercios y empresas.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">3. Cuentas de Usuario</h2>
          <p>
            Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de 
            todas las actividades que ocurran bajo tu cuenta.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">4. Pagos y Suscripciones</h2>
          <p>
            Los pagos por el uso del software se procesan a través de nuestro Merchant of Record (Paddle). 
            Al adquirir una suscripción, aceptas las políticas de cobro y facturación de la pasarela de pago.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">5. Propiedad Intelectual</h2>
          <p>
            Todo el código, diseño y funcionamiento de Cobro App está protegido por derechos de autor.
            Se otorga una licencia de uso limitada al usuario, no la propiedad del software.
          </p>
        </div>
      </div>
    </div>
  );
}
