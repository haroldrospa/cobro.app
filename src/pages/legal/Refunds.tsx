import React from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Refunds() {
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
          <h1 className="text-3xl font-bold mb-6">Política de Reembolsos</h1>
          <p className="text-gray-500 mb-8">Última actualización: {new Date().toLocaleDateString()}</p>
          
          <p>
            Queremos que estés completamente satisfecho con Cobro App. A continuación detallamos 
            nuestra política en cuanto a reembolsos y cancelaciones.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">1. Pruebas y Cancelaciones</h2>
          <p>
            Puedes cancelar tu suscripción en cualquier momento desde tu panel de usuario.
            Al cancelar, no se te cobrará en el próximo ciclo de facturación y mantendrás el 
            acceso a tu cuenta hasta el final de tu período ya pagado.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">2. Reembolsos en Pagos Nuevos</h2>
          <p>
            Si cometiste un error al comprar una suscripción o renovar, ofrecemos una política 
            de reembolso completo durante las primeras 72 horas luego del cargo, siempre y cuando
            la plataforma no haya sido utilizada para procesar un volumen alto de transacciones 
            en ese período.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">3. Problemas Técnicos</h2>
          <p>
            En caso de cortes de servicio prolongados o fallos críticos comprobables del sistema que te 
            impidan operar, evaluaremos cada caso de manera individual para proveer crédito en la plataforma 
            o reembolsos prorrateados.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">4. Procedimiento</h2>
          <p>
            Para solicitar un reembolso, por favor contáctanos con el ID de tu transacción a nuestro 
            equipo de soporte. Los reembolsos aprobados se procesarán a través del método de pago original 
            (procesado por Paddle) y pueden tardar de 5 a 10 días hábiles en reflejarse.
          </p>
        </div>
      </div>
    </div>
  );
}
