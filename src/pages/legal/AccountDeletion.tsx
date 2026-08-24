import React from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function AccountDeletion() {
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
          <h1 className="text-3xl font-bold mb-6">Eliminación de Cuenta y Datos — Cobro POS</h1>
          <p className="text-gray-500 mb-8">Última actualización: {new Date().toLocaleDateString()}</p>

          <p>
            Si usas <strong>Cobro POS</strong> (desarrollada por Cobro App) y quieres eliminar tu cuenta
            y los datos asociados, sigue los pasos de esta página.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">Cómo solicitar la eliminación</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Envía un correo a{' '}
              <a href="mailto:haroldrospa@gmail.com" className="text-blue-600 hover:underline">
                haroldrospa@gmail.com
              </a>{' '}
              desde el mismo correo con el que te registraste en Cobro POS.
            </li>
            <li>
              En el asunto escribe: <strong>"Solicitud de eliminación de cuenta — Cobro POS"</strong>.
            </li>
            <li>
              Incluye el nombre de tu tienda/negocio y el correo asociado a la cuenta, para poder
              identificarla.
            </li>
            <li>
              Procesaremos la solicitud en un plazo máximo de <strong>15 días hábiles</strong> y te
              confirmaremos por correo cuando se complete.
            </li>
          </ol>

          <h2 className="text-xl font-semibold mt-8 mb-4">Qué datos se eliminan</h2>
          <p>Al procesar tu solicitud, eliminamos permanentemente:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Tu perfil de usuario (nombre, correo, teléfono).</li>
            <li>Los datos de tu(s) tienda(s): catálogo de productos, clientes, proveedores.</li>
            <li>Historial de mensajes de chat con clientes.</li>
            <li>Tu cuenta de inicio de sesión (no podrás volver a entrar con ella).</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-4">Qué datos podemos conservar, y por qué</h2>
          <p>
            Por obligaciones legales, conservamos por un periodo adicional (según lo exija la
            legislación fiscal dominicana aplicable) los registros de facturación y comprobantes
            fiscales (NCF) ya emitidos, así como los registros de transacciones de pago ya procesadas —
            esto aplica igual que para cualquier negocio obligado a llevar registros contables/fiscales,
            independientemente de que el usuario que los generó haya eliminado su cuenta. Estos registros
            se conservan de forma aislada, sin vincularlos a tu perfil eliminado, y solo para fines de
            cumplimiento legal.
          </p>

          <p className="mt-8">
            ¿Dudas sobre este proceso? Escríbenos a{' '}
            <a href="mailto:haroldrospa@gmail.com" className="text-blue-600 hover:underline">
              haroldrospa@gmail.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
