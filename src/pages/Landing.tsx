import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  Package, 
  FileText, 
  Store, 
  Utensils, 
  ShoppingCart, 
  ArrowRight,
  CheckCircle2,
  Menu,
  X
} from "lucide-react";
import cobroLogo from '@/assets/cobro-logo-dark.png';
import heroBg from '@/assets/hero-bg-uploaded.jpg';

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Landing = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Redirigir automáticamente si ya hay sesión activa
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/app', { replace: true });
      }
    });
  }, [navigate]);

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  return (
    <div className="dark min-h-screen font-sans selection:bg-emerald-500/30 text-slate-100" style={{ backgroundColor: '#1f262d' }}>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1f262d]/90 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={cobroLogo} alt="Logo" className="h-8 md:h-10 w-auto object-contain cursor-pointer rounded-lg shadow-sm" onClick={() => window.scrollTo(0,0)} />
            <span className="text-xl font-bold tracking-tight text-white cursor-pointer" onClick={() => window.scrollTo(0,0)}>Cobroapp</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#beneficios" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Beneficios</a>
            <a href="#casos" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Para tu negocio</a>
            <a href="#precios" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Precios</a>
            <div className="flex items-center gap-3 ml-4">
              <Link to="/auth">
                <Button variant="ghost" className="font-semibold">
                  Iniciar sesión
                </Button>
              </Link>
              <Link to="/auth?signup=true">
                <Button>
                  Probar gratis
                </Button>
              </Link>
            </div>
          </div>

          {/* Mobile: Login button + hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="font-semibold text-sm px-3">
                Iniciar sesión
              </Button>
            </Link>
            <button 
              className="p-2 text-foreground"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 border-b border-white/10 shadow-lg p-4 flex flex-col gap-4 z-50" style={{ backgroundColor: '#1f262d' }}>
            <a href="#beneficios" className="text-sm font-medium p-2 text-slate-300 hover:text-white" onClick={() => setIsMenuOpen(false)}>Beneficios</a>
            <a href="#casos" className="text-sm font-medium p-2 text-slate-300 hover:text-white" onClick={() => setIsMenuOpen(false)}>Para tu negocio</a>
            <a href="#precios" className="text-sm font-medium p-2 text-slate-300 hover:text-white" onClick={() => setIsMenuOpen(false)}>Precios</a>
            <hr className="my-2 border-white/10" />
            <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
              <Button variant="outline" className="w-full justify-center">
                Iniciar sesión
              </Button>
            </Link>
            <Link to="/auth?signup=true" onClick={() => setIsMenuOpen(false)}>
              <Button className="w-full justify-center">
                Probar gratis
              </Button>
            </Link>
          </div>
        )}
      </nav>

      <main className="pt-16">
        {/* 1. Hero Section */}
        <section className="relative overflow-hidden pt-32 pb-24 lg:pt-40 lg:pb-48 border-b border-white/5">
          {/* Background Image */}
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-50"
            style={{ backgroundImage: `url(${heroBg})` }}
          />
          {/* Dark Gradient Overlay for Professional Look - Darker for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#1f262d]/80 via-[#1f262d]/95 to-[#1f262d] z-10" />
          
          <div className="container px-4 mx-auto text-center relative z-20">
            <motion.div 
              className="max-w-4xl mx-auto space-y-6 md:space-y-8"
              initial="initial" animate="animate" variants={fadeIn}
            >
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight md:leading-tight drop-shadow-lg">
                El control total de tus ventas y <span className="text-emerald-400">facturación electrónica</span>, en un solo lugar.
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed drop-shadow-md">
                La plataforma de Punto de Venta (POS) diseñada para que Tiendas, Restaurantes y Supermercados vendan más rápido, controlen su inventario sin errores y cumplan con las autoridades fiscales sin complicaciones.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
                <Link to="/auth?signup=true" className="w-full sm:w-auto">
                  <Button size="lg" className="h-14 px-8 text-base md:text-lg w-full sm:w-auto shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_35px_rgba(16,185,129,0.6)] hover:scale-105 transition-all duration-300 rounded-xl">
                    Comienza tu prueba gratis de 15 días <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 flex items-center justify-center gap-1.5 mt-6 font-medium">
                <span className="text-lg">🔒</span> Sin tarjeta de crédito. Configuración en menos de 5 minutos.
              </p>
            </motion.div>
          </div>
        </section>

        {/* 2. Problem / Solution Section */}
        <section id="beneficios" className="py-24 bg-black/20">
          <div className="container px-4 mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Olvídate de las filas lentas, el desorden de stock y el estrés de la contabilidad manual.</h2>
              <p className="text-lg text-slate-400">Cobroapp está diseñado para hacer tu vida más fácil y tu negocio más rentable. Descubre cómo transformamos tu operación:</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {[
                { icon: Zap, title: "Cajas Rápidas (Vende en segundos)", desc: "Atiende a tus clientes a la velocidad de la luz. Nuestra interfaz intuitiva te permite procesar pagos y emitir recibos sin demoras, eliminando las filas y mejorando la experiencia de compra." },
                { icon: Package, title: "Inventario Inteligente", desc: "Mantén el control absoluto. Cobroapp actualiza tu stock en tiempo real y te avisa cuando es momento de reabastecer, para que nunca pierdas una venta por falta de mercancía." },
                { icon: FileText, title: "Facturación Electrónica Legal", desc: "Cumplir con las normativas fiscales de tu país (con agilidad para los comprobantes en República Dominicana y la región) nunca fue tan fácil. Emite facturas válidas automáticamente." },
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-8 rounded-2xl border border-white/10 shadow-sm hover:shadow-md transition-shadow" style={{ backgroundColor: '#262f38' }}
                >
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6">
                    <item.icon className="text-emerald-400 w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Use Cases */}
        <section id="casos" className="py-24">
          <div className="container px-4 mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Una solución que se adapta a ti, sin importar lo que vendas.</h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                { icon: Store, title: "Para Tiendas y Retail", desc: "Control de stock al milímetro y máxima agilidad en el mostrador. Escanea productos, aplica descuentos y fideliza a tus clientes con un sistema que no te hace perder el tiempo." },
                { icon: Utensils, title: "Para Restaurantes y Cafeterías", desc: "Domina el caos de las horas pico. Toma pedidos rápidamente, gestiona el control de mesas en tiempo real y envía comandas directas a la cocina, todo desde una sola pantalla." },
                { icon: ShoppingCart, title: "Para Supermercados y Minimarkets", desc: "Diseñado para el alto volumen. Soporte fluido para cajas múltiples, lectura rápida de códigos de barras y facturación masiva para que tu operación no se detenga un solo segundo." },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center p-6">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                    <item.icon className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">{item.title}</h3>
                  <p className="text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Pricing */}
        <section id="precios" className="py-24 bg-black/20">
          <div className="container px-4 mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Planes transparentes que crecen junto a tu negocio.</h2>
              <div className="flex items-center justify-center gap-3 mt-8">
                <span className={`text-sm font-medium ${!isAnnual ? 'text-white' : 'text-slate-400'}`}>Pago Mensual</span>
                <button 
                  onClick={() => setIsAnnual(!isAnnual)}
                  className="w-14 h-7 bg-emerald-500 rounded-full relative transition-colors focus:outline-none"
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${isAnnual ? 'left-8' : 'left-1'}`} />
                </button>
                <span className={`text-sm font-medium flex items-center gap-1 ${isAnnual ? 'text-white' : 'text-slate-400'}`}>
                  Pago Anual <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">(Ahorra hasta 17%)</span>
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
              {/* Emprendedor */}
              <div className="p-8 rounded-3xl border border-white/10 shadow-sm" style={{ backgroundColor: '#262f38' }}>
                <h3 className="text-2xl font-bold mb-2 text-white">🌱 Plan Emprendedor</h3>
                <p className="text-slate-400 mb-6 h-12">Ideal para empezar con el pie derecho.</p>
                <div className="mb-6">
                  <div>
                    <span className="text-4xl font-extrabold text-white">${isAnnual ? '24' : '29'}</span>
                    <span className="text-slate-400"> USD / mes</span>
                  </div>
                  {isAnnual && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col gap-2 items-start">
                      <span className="inline-block text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-400 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-emerald-400/50">
                        ✨ Ahorras $60 USD / año (17%)
                      </span>
                      <span className="text-sm text-slate-400 font-medium">
                        Pago único de $288 USD
                      </span>
                    </div>
                  )}
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    { text: 'Facturas electrónicas ilimitadas', active: true },
                    { text: '1 Empleado', active: true },
                    { text: 'Control de inventario', active: true },
                    { text: 'Múltiples métodos de pago', active: true },
                    { text: 'Reportes de ventas', active: true },
                    { text: 'Soporte estándar', active: true },
                    { text: 'Gestión de clientes (CRM)', active: true },
                    { text: 'Mi tienda online', active: false },
                    { text: 'Nómina', active: false },
                    { text: 'Contabilidad', active: false },
                    { text: 'API de integración', active: false },
                  ].map((feature, i) => (
                    <li key={i} className={`flex items-start gap-3 ${!feature.active ? 'opacity-50' : ''}`}>
                      {feature.active ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <X className="w-5 h-5 text-slate-400 shrink-0" />}
                      <span className={`text-sm ${!feature.active ? 'line-through text-slate-400' : 'text-slate-300'}`}>{feature.text}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/auth?signup=true&plan=basic">
                  <Button variant="outline" className="w-full h-12 border-white/20 text-white hover:bg-white/10">Empezar Prueba</Button>
                </Link>
              </div>

              {/* Negocio */}
              <div className="bg-emerald-500 text-emerald-950 rounded-3xl p-8 border-emerald-400 shadow-xl md:scale-105 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-yellow-400 text-yellow-950 text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                  El más popular
                </div>
                <h3 className="text-2xl font-bold mb-2">⭐ Plan Negocio</h3>
                <p className="text-emerald-950/80 mb-6 h-12">Todo lo que necesitas para escalar.</p>
                <div className="mb-6">
                  <div>
                    <span className="text-4xl font-extrabold">${isAnnual ? '49' : '59'}</span>
                    <span className="text-emerald-950/80"> USD / mes</span>
                  </div>
                  {isAnnual && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col gap-2 items-start">
                      <span className="inline-block text-sm font-extrabold text-yellow-950 bg-yellow-400 px-3 py-1 rounded-full shadow-[0_4px_14px_rgba(250,204,21,0.5)] ring-2 ring-yellow-300/50">
                        🔥 Ahorras $120 USD / año (17%)
                      </span>
                      <span className="text-sm text-emerald-950/80 font-bold">
                        Pago único de $588 USD
                      </span>
                    </div>
                  )}
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    { text: 'Facturas electrónicas ilimitadas', active: true },
                    { text: 'Hasta 5 Empleados', active: true },
                    { text: 'Control de inventario avanzado', active: true },
                    { text: 'Múltiples métodos de pago', active: true },
                    { text: 'Reportes y analíticas', active: true },
                    { text: 'Soporte prioritario', active: true },
                    { text: 'Gestión de clientes (CRM)', active: true },
                    { text: 'Mi tienda online', active: true },
                    { text: 'Nómina', active: true },
                    { text: 'Contabilidad', active: true },
                    { text: 'API de integración', active: false },
                  ].map((feature, i) => (
                    <li key={i} className={`flex items-start gap-3 ${!feature.active ? 'opacity-60' : ''}`}>
                      {feature.active ? <CheckCircle2 className="w-5 h-5 text-emerald-950 shrink-0" /> : <X className="w-5 h-5 text-emerald-950/60 shrink-0" />}
                      <span className={`text-sm font-medium ${!feature.active ? 'line-through text-emerald-950/60' : ''}`}>{feature.text}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/auth?signup=true&plan=pro">
                  <Button className="w-full h-12 bg-white text-emerald-700 hover:bg-white/90 font-bold">Empezar Prueba</Button>
                </Link>
              </div>

              {/* Corporativo */}
              <div className="p-8 rounded-3xl border border-white/10 shadow-sm" style={{ backgroundColor: '#262f38' }}>
                <h3 className="text-2xl font-bold mb-2 text-white">🏢 Plan Corporativo</h3>
                <p className="text-slate-400 mb-6 h-12">Potencia ilimitada y adaptación exacta a las necesidades de tu negocio.</p>
                <div className="mb-6 flex items-center h-[38px]">
                  <span className="text-3xl font-extrabold text-white">Personalizado</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    { text: 'Facturas electrónicas ilimitadas', active: true },
                    { text: 'Empleados ilimitados', active: true },
                    { text: 'Inventario de alto volumen', active: true },
                    { text: 'Múltiples métodos de pago', active: true },
                    { text: 'Reportes personalizados', active: true },
                    { text: 'Soporte 24/7 y dedicado', active: true },
                    { text: 'Gestión de clientes (CRM)', active: true },
                    { text: 'Mi tienda online', active: true },
                    { text: 'Nómina', active: true },
                    { text: 'Contabilidad', active: true },
                    { text: 'API y Webhooks', active: true },
                    { text: 'Software adaptado a medida', active: true },
                  ].map((feature, i) => (
                    <li key={i} className={`flex items-start gap-3 ${!feature.active ? 'opacity-50' : ''}`}>
                      {feature.active ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <X className="w-5 h-5 text-slate-400 shrink-0" />}
                      <span className={`text-sm ${!feature.active ? 'line-through text-slate-400' : 'text-slate-300'}`}>{feature.text}</span>
                    </li>
                  ))}
                </ul>
                <a href="mailto:hola@cobroapp.com">
                  <Button variant="outline" className="w-full h-12 border-white/20 text-white hover:bg-white/10">Contáctanos</Button>
                </a>
              </div>
            </div>


          </div>
        </section>

        {/* 5. Testimonials */}
        <section className="py-24">
          <div className="container px-4 mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-white">Únete a los negocios que ya digitalizaron su éxito.</h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {[
                { name: "Carlos M.", role: "Dueño de Tienda", emoji: "🏪", quote: "Antes de Cobroapp, el cuadre de caja y el inventario me tomaban horas. Ahora todo está automático, y la facturación electrónica es súper sencilla. ¡Me cambió la vida!" },
                { name: "Laura T.", role: "Gerente de Restaurante", emoji: "🍕", quote: "El módulo de mesas es increíble. Los meseros no se equivocan con las comandas y la cuenta se divide e imprime en segundos. Totalmente recomendado para gastronomía." },
                { name: "Roberto G.", role: "Administrador de Supermercado", emoji: "🛒", quote: "Manejamos un volumen altísimo de clientes y Cobroapp nunca se cuelga. El escaneo de códigos de barras vuela y emitimos facturas sin ningún retraso." }
              ].map((t, i) => (
                <div key={i} className="rounded-2xl p-8 relative border border-white/5" style={{ backgroundColor: '#262f38' }}>
                  <div className="text-4xl absolute -top-5 left-8">{t.emoji}</div>
                  <p className="text-lg italic text-slate-300 mb-6 pt-4">"{t.quote}"</p>
                  <div>
                    <p className="font-bold text-white">{t.name}</p>
                    <p className="text-sm text-slate-400">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. CTA Footer */}
        <section className="py-24 bg-zinc-950 text-zinc-50 rounded-t-[3rem]">
          <div className="container px-4 mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 max-w-3xl mx-auto">¿Listo para modernizar tu negocio y dejar atrás el trabajo manual?</h2>
            <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
              Comienza hoy mismo. Tienes 15 días para enamorarte de la plataforma. Elimina el estrés de la contabilidad y acelera tus ventas desde el primer día.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Link to="/auth?signup=true">
                <Button size="lg" className="h-14 px-10 text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-transform bg-primary text-primary-foreground">
                  Crea tu cuenta ahora
                </Button>
              </Link>
              <p className="text-sm text-zinc-500">Prueba de 15 días gratuita. Sin riesgo. Sin tarjeta de crédito.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Personalizado */}
      <footer className="bg-zinc-950 text-zinc-400 py-16 border-t border-zinc-800/50">
        <div className="container px-4 mx-auto">
          <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 mb-2 shadow-lg">
              <span className="text-3xl">🇩🇴</span>
            </div>
            
            <p className="text-zinc-300 leading-relaxed text-lg sm:text-xl">
              <strong className="text-white">Cobroapp</strong> es una iniciativa creada con pasión por <strong className="text-emerald-400">Harold Rosado</strong>, un emprendedor dominicano con la firme misión de ayudar financiera y sistemáticamente a los negocios a prosperar en la era digital.
            </p>
            
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 mt-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
              <p className="text-sm sm:text-base text-zinc-400 italic relative z-10">
                "Detrás de cada negocio hay una familia y un sueño. Al apoyar y usar Cobroapp, no solo modernizas tu empresa, sino que me ayudas a seguir construyendo herramientas que empoderan a miles de comerciantes como tú. Únete a nuestra comunidad y crezcamos juntos."
              </p>
            </div>
            
            <div className="w-full max-w-xs h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent my-4" />
            
            <p className="text-xs text-zinc-600 font-medium">
              &copy; {new Date().getFullYear()} Cobroapp por Harold Rosado. Todos los derechos reservados. <br className="sm:hidden" /> Hecho con orgullo en República Dominicana.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
