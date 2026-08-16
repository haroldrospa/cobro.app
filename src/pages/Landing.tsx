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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSessionSafe } from "@/lib/authSession";

const Landing = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Redirigir automáticamente si ya hay sesión activa
  useEffect(() => {
    getSessionSafe().then((session) => {
      if (session) {
        navigate('/app', { replace: true });
      }
    }).catch(() => {});
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
        {/* 1. Hero Section — Visual-first, minimal text */}
        <section className="relative overflow-hidden min-h-[92vh] flex items-center border-b border-white/5">
          {/* Animated gradient background */}
          <div className="absolute inset-0 z-0" style={{
            background: 'radial-gradient(ellipse 80% 60% at 60% 40%, rgba(16,185,129,0.13) 0%, transparent 70%), radial-gradient(ellipse 60% 80% at 10% 80%, rgba(59,130,246,0.08) 0%, transparent 70%), #1f262d'
          }} />
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 z-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />

          <div className="container px-4 mx-auto relative z-20">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8 py-16 lg:py-0">
              
              {/* Left: Text content */}
              <div className="flex-1 text-center lg:text-left max-w-2xl mx-auto lg:mx-0">
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm font-semibold mb-6"
                >
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  POS · Facturación · Inventario
                </motion.div>

                {/* Headline */}
                <motion.h1
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.05] mb-6"
                >
                  Vende más.<br />
                  <span style={{
                    background: 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>Sin caos.</span>
                </motion.h1>

                {/* Subline — SHORT */}
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-lg sm:text-xl text-slate-400 mb-8 max-w-lg mx-auto lg:mx-0"
                >
                  Tu tienda, restaurante o supermercado con POS, inventario y facturación electrónica en un solo lugar.
                </motion.p>

                {/* CTA */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-8"
                >
                  <Link to="/auth?signup=true" className="w-full sm:w-auto">
                    <Button size="lg" className="h-14 px-9 text-base font-bold w-full sm:w-auto rounded-xl transition-all duration-300 hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        boxShadow: '0 0 30px rgba(16,185,129,0.45), 0 4px 20px rgba(0,0,0,0.3)'
                      }}
                    >
                      Prueba gratis 15 días <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link to="/auth" className="w-full sm:w-auto">
                    <Button variant="ghost" size="lg" className="h-14 px-7 text-base w-full sm:w-auto text-slate-300 hover:text-white rounded-xl border border-white/10 hover:border-white/25 transition-all">
                      Iniciar sesión
                    </Button>
                  </Link>
                </motion.div>

                {/* Trust line */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.45 }}
                  className="text-sm text-slate-500 flex items-center justify-center lg:justify-start gap-2"
                >
                  <span>🔒</span> Sin tarjeta de crédito · Listo en 5 minutos
                </motion.p>

                {/* Stats row */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.55 }}
                  className="flex flex-wrap items-center justify-center lg:justify-start gap-6 mt-10 pt-8 border-t border-white/8"
                >
                  {[
                    { value: '+500', label: 'Negocios activos' },
                    { value: '15 días', label: 'Prueba gratuita' },
                    { value: '100%', label: 'Legal y fiscal' },
                  ].map((s, i) => (
                    <div key={i} className="text-center lg:text-left">
                      <div className="text-2xl font-extrabold text-emerald-400">{s.value}</div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </motion.div>
              </div>

              {/* Right: Hero image with glow */}
              <motion.div
                initial={{ opacity: 0, x: 40, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
                className="flex-1 flex items-end justify-center relative max-w-sm lg:max-w-none w-full"
              >
                {/* Glow behind image */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
                {/* Floating card 1 */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute top-8 left-0 lg:-left-6 z-10 flex items-center gap-3 bg-[#1e2830]/90 border border-white/10 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-sm"
                >
                  <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Venta procesada</div>
                    <div className="text-sm font-bold text-white">$12,450 RD</div>
                  </div>
                </motion.div>
                {/* Floating card 2 */}
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className="absolute top-1/2 right-0 lg:-right-4 z-10 flex items-center gap-3 bg-[#1e2830]/90 border border-white/10 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-sm"
                >
                  <div className="w-9 h-9 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <Package className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Stock actualizado</div>
                    <div className="text-sm font-bold text-white">Automático ✓</div>
                  </div>
                </motion.div>
                {/* Businessman image */}
                <img
                  src={heroBg}
                  alt="Negocio moderno con Cobroapp"
                  className="w-full max-w-sm lg:max-w-md xl:max-w-lg rounded-3xl object-cover shadow-2xl"
                  style={{
                    maxHeight: '520px',
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.1)'
                  }}
                />
              </motion.div>
            </div>
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
                    <span className="text-4xl font-extrabold text-white">${isAnnual ? '14' : '17'}</span>
                    <span className="text-slate-400"> USD / mes</span>
                  </div>
                  {isAnnual && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col gap-2 items-start">
                      <span className="inline-block text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-400 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-emerald-400/50">
                        ✨ Ahorras $36 USD / año (17%)
                      </span>
                      <span className="text-sm text-slate-400 font-medium">
                        Pago único de $168 USD
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
                <h3 className="text-2xl font-bold mb-2">⭐ Plan Empresarial</h3>
                <p className="text-emerald-950/80 mb-6 h-12">Todo lo que necesitas para escalar.</p>
                <div className="mb-6">
                  <div>
                    <span className="text-4xl font-extrabold">${isAnnual ? '37' : '45'}</span>
                    <span className="text-emerald-950/80"> USD / mes</span>
                  </div>
                  {isAnnual && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col gap-2 items-start">
                      <span className="inline-block text-sm font-extrabold text-yellow-950 bg-yellow-400 px-3 py-1 rounded-full shadow-[0_4px_14px_rgba(250,204,21,0.5)] ring-2 ring-yellow-300/50">
                        🔥 Ahorras $96 USD / año (17%)
                      </span>
                      <span className="text-sm text-emerald-950/80 font-bold">
                        Pago único de $444 USD
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
                <div className="flex flex-col gap-2">
                  <a href="https://wa.me/18099175744?text=Hola!%20Estoy%20interesado%20en%20el%20Plan%20Corporativo%20de%20Cobroapp" target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-emerald-950 font-bold flex items-center justify-center gap-2 rounded-xl">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.835-4.321c1.8.107 3.53.626 5.2.629 5.485 0 9.948-4.414 9.95-9.847.002-2.63-1.018-5.101-2.871-6.958C17.258 1.643 14.778.641 12.01.64c-5.483 0-9.948 4.414-9.95 9.848-.001 2.228.616 4.4 1.783 6.285l-1.013 3.697 3.784-1.026c1.2.68 2.24.966 3.443.992zm12.01-6.126c-.322-.16-.1.897-.483-1.057-.1-.22-.26-.3-.48-.41s-1.48-.73-1.72-.82-.5-.14-.72.19-.84 1.05-1.03 1.27-.38.24-.7.08-1.36-.5-2.58-1.6c-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.5.14-.66.15-.14.32-.38.48-.57.16-.19.22-.32.33-.54.11-.22.05-.41-.03-.57-.08-.16-.72-1.74-.99-2.39-.26-.64-.52-.55-.72-.56l-.61-.01c-.22 0-.58.08-.88.41-.3.33-1.15 1.13-1.15 2.75s1.18 3.19 1.34 3.41c.16.22 2.32 3.54 5.62 4.97 3.3.1.2.33.66.5.9.15.54.49 1.34.81.33.32.33.56.33.74v.02c0 .18-.08.38-.24.54z"/>
                      </svg>
                      Contactar por WhatsApp
                    </Button>
                  </a>
                  <a href="https://mail.google.com/mail/?view=cm&fs=1&to=Haroldrospa@gmail.com&su=Plan%20Corporativo%20-%20Cobroapp" target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button variant="outline" className="w-full h-12 border-white/20 text-white hover:bg-white/10 flex items-center justify-center gap-2 rounded-xl">
                      ✉️ Escribir por Correo
                    </Button>
                  </a>
                </div>
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
      <footer className="bg-zinc-950 text-zinc-400 py-20 border-t border-zinc-900">
        <div className="container px-4 mx-auto">
          <div className="max-w-4xl mx-auto">
            {/* Creator Card */}
            <div className="relative bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-3xl p-8 md:p-10 shadow-2xl overflow-hidden group hover:border-emerald-500/20 transition-all duration-500">
              {/* Decorative backgrounds */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-500" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/10 transition-all duration-500" />
              
              <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
                {/* Badge/Flag Column */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="relative">
                    {/* Glowing effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-blue-500 rounded-full blur-md opacity-45 group-hover:opacity-75 transition-opacity duration-500" />
                    
                    {/* Flag Container */}
                    <div className="relative w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border-2 border-zinc-800 shadow-xl overflow-hidden group-hover:scale-105 group-hover:border-emerald-500/50 transition-all duration-500 p-0.5">
                      {/* Dominican Republic SVG Flag */}
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <defs>
                          <clipPath id="circleView">
                            <circle cx="50" cy="50" r="50" />
                          </clipPath>
                        </defs>
                        <g clipPath="url(#circleView)">
                          {/* Blue quadrants */}
                          <rect x="0" y="0" width="45" height="45" fill="#002F6C" />
                          <rect x="55" y="55" width="45" height="45" fill="#002F6C" />
                          {/* Red quadrants */}
                          <rect x="55" y="0" width="45" height="45" fill="#CE1126" />
                          <rect x="0" y="55" width="45" height="45" fill="#CE1126" />
                          {/* White cross */}
                          <rect x="45" y="0" width="10" height="100" fill="#FFFFFF" />
                          <rect x="0" y="45" width="100" height="10" fill="#FFFFFF" />
                          {/* Coat of arms representation in the center */}
                          <g transform="translate(50, 50)">
                            {/* Shield shape */}
                            <path d="M-5,-5 L5,-5 L5,1 C5,4 0,7 0,7 C0,7 -5,4 -5,1 Z" fill="#00843D" />
                            <path d="M-3,-3 L3,-3 L3,1 C3,3 0,5 0,5 C0,5 -3,3 -3,1 Z" fill="#CE1126" />
                            <rect x="-1.5" y="-1.5" width="3" height="3" fill="#002F6C" rx="0.5" />
                            <circle cx="0" cy="0" r="0.8" fill="#FFFFFF" />
                            {/* Mini cross & book detail */}
                            <rect x="-0.5" y="-0.5" width="1" height="1" fill="#FFCC00" />
                          </g>
                          {/* Premium 3D Glossy Dome Overlay */}
                          <path d="M0,0 Q50,40 100,0 L100,100 L0,100 Z" fill="rgba(255,255,255,0.06)" className="pointer-events-none" />
                          <path d="M0,0 Q50,30 100,0 Z" fill="rgba(255,255,255,0.15)" className="pointer-events-none" />
                        </g>
                      </svg>
                    </div>
                  </div>
                  
                  <span className="text-[10px] font-bold tracking-widest text-emerald-400/80 uppercase mt-3">
                    Orgullo RD
                  </span>
                </div>
                
                {/* Content Column */}
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800/40 border border-zinc-700/50 text-xs font-semibold text-zinc-300 mb-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Creado en República Dominicana
                  </div>
                  
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
                    Una iniciativa con visión de futuro
                  </h3>
                  
                  <p className="text-zinc-300 leading-relaxed mb-6 text-sm md:text-base">
                    <strong className="text-white">Cobroapp</strong> es una plataforma creada con pasión por <strong className="text-emerald-400 font-semibold font-sans">Harold Rosado</strong>, un emprendedor dominicano con la firme misión de ayudar financiera y sistemáticamente a los negocios a prosperar en la era digital.
                  </p>
                  
                  {/* Quote block */}
                  <div className="relative border-l-2 border-emerald-500/50 pl-4 py-1 text-left bg-emerald-500/[0.02] rounded-r-xl">
                    <p className="text-xs md:text-sm text-zinc-400 italic leading-relaxed">
                      "Detrás de cada negocio hay una familia y un sueño. Al apoyar y usar Cobroapp, no solo modernizas tu empresa, sino que me ayudas a seguir construyendo herramientas que empoderan a miles de comerciantes como tú. Únete a nuestra comunidad y crezcamos juntos."
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="w-full max-w-xs h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent my-10 mx-auto" />
            
            <div className="text-center">
              <p className="text-xs text-zinc-600 font-medium tracking-wide">
                &copy; {new Date().getFullYear()} Cobroapp por Harold Rosado. Todos los derechos reservados.
              </p>
              <p className="text-[11px] text-zinc-500 mt-1 flex items-center justify-center gap-1.5 font-semibold">
                Hecho con orgullo en la República Dominicana 🇩🇴
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
