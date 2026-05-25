import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Store,
    Zap,
    ShieldCheck,
    BarChart3,
    Smartphone,
    Globe,
    CheckCircle2,
    Star,
    ArrowRight,
    Menu,
    X,
    FileText,
    DollarSign,
    Receipt,
    TrendingUp,
    ShoppingCart,
    CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import cobroLogo from '@/assets/cobro-logo-dark.png';
import { useState } from 'react';

const LandingPage = () => {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

    useEffect(() => {
        // Check if user is already logged in, redirect to POS if so
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                navigate('/pos');
            }
        };
        checkSession();
    }, [navigate]);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setIsMenuOpen(false);
        }
    };

    const fadeInUp = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
    };

    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 overflow-x-hidden font-sans selection:bg-emerald-500/30">

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
                <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
                        <img src={cobroLogo} alt="Logo" className="h-8 w-auto" />
                        <span className="font-bold text-xl tracking-tight hidden sm:block">Cobro App</span>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-8">
                        <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Funcionalidades</button>
                        <button onClick={() => scrollToSection('pricing')} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Precios</button>
                        <button onClick={() => scrollToSection('testimonials')} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Reseñas</button>
                        <button onClick={() => scrollToSection('about')} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Nosotros</button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            onClick={() => navigate('/auth')}
                        >
                            Iniciar Sesión
                        </Button>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button className="md:hidden p-2 text-gray-300" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>

                {/* Mobile Menu Dropdown */}
                {isMenuOpen && (
                    <div className="md:hidden bg-gray-900 border-b border-gray-800">
                        <div className="flex flex-col p-4 gap-4">
                            <button onClick={() => scrollToSection('features')} className="text-left py-2 text-gray-300">Funcionalidades</button>
                            <button onClick={() => scrollToSection('pricing')} className="text-left py-2 text-gray-300">Precios</button>
                            <button onClick={() => scrollToSection('testimonials')} className="text-left py-2 text-gray-300">Reseñas</button>
                            <button onClick={() => scrollToSection('about')} className="text-left py-2 text-gray-300">Nosotros</button>
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2"
                                onClick={() => navigate('/auth')}
                            >
                                Iniciar Sesión
                            </Button>
                        </div>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
                {/* Background Elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
                    {/* Gradient Blobs */}
                    <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />

                    {/* Floating Icons - Invoices & Accounting */}
                    <motion.div
                        className="absolute top-20 left-[10%] text-emerald-500/20"
                        animate={{
                            y: [0, -20, 0],
                            rotate: [0, 5, 0]
                        }}
                        transition={{
                            duration: 6,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        <FileText size={60} />
                    </motion.div>

                    <motion.div
                        className="absolute top-40 right-[15%] text-blue-500/20"
                        animate={{
                            y: [0, 20, 0],
                            rotate: [0, -5, 0]
                        }}
                        transition={{
                            duration: 7,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 1
                        }}
                    >
                        <DollarSign size={50} />
                    </motion.div>

                    <motion.div
                        className="absolute bottom-32 left-[20%] text-cyan-500/20"
                        animate={{
                            y: [0, -15, 0],
                            rotate: [0, 3, 0]
                        }}
                        transition={{
                            duration: 5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 0.5
                        }}
                    >
                        <Receipt size={45} />
                    </motion.div>

                    <motion.div
                        className="absolute top-1/3 left-[5%] text-emerald-400/15"
                        animate={{
                            y: [0, 25, 0],
                            x: [0, 10, 0]
                        }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 2
                        }}
                    >
                        <TrendingUp size={55} />
                    </motion.div>

                    <motion.div
                        className="absolute bottom-20 right-[10%] text-purple-500/20"
                        animate={{
                            y: [0, -18, 0],
                            rotate: [0, -3, 0]
                        }}
                        transition={{
                            duration: 6.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 1.5
                        }}
                    >
                        <ShoppingCart size={48} />
                    </motion.div>

                    <motion.div
                        className="absolute top-1/2 right-[8%] text-teal-500/15"
                        animate={{
                            y: [0, 22, 0],
                            rotate: [0, 4, 0]
                        }}
                        transition={{
                            duration: 7.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 0.8
                        }}
                    >
                        <CreditCard size={52} />
                    </motion.div>
                </div>

                <div className="container mx-auto px-4 md:px-6 text-center">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={staggerContainer}
                        className="max-w-4xl mx-auto space-y-8"
                    >
                        <motion.div variants={fadeInUp} className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-4">
                            🚀 La solución #1 para tu negocio
                        </motion.div>

                        <motion.h1 variants={fadeInUp} className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight">
                            Control total de tu negocio <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">en una sola plataforma</span>
                        </motion.h1>

                        <motion.p variants={fadeInUp} className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
                            Gestiona ventas, inventario, facturación y pedidos web desde cualquier lugar.
                            Moderniza tu punto de venta y haz crecer tu empresa hoy mismo.
                        </motion.p>

                        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                            <Button
                                size="lg"
                                className="h-14 px-8 text-lg bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
                                onClick={() => navigate('/auth')}
                            >
                                Comenzar Gratis <ArrowRight className="ml-2 w-5 h-5" />
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="h-14 px-8 text-lg border-gray-700 bg-gray-900/50 hover:bg-gray-800 text-gray-300"
                                onClick={() => scrollToSection('features')}
                            >
                                Ver Funcionalidades
                            </Button>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 bg-gray-900/50">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Todo lo que necesitas para vender más</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">Herramientas potentes diseñadas para simplificar tu operación diaria.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Store className="w-10 h-10 text-emerald-400" />}
                            title="Punto de Venta Ágil"
                            description="Vende rápido y sin complicaciones. Interfaz intuitiva optimizada para velocidad."
                        />
                        <FeatureCard
                            icon={<Globe className="w-10 h-10 text-blue-400" />}
                            title="Pedidos Web"
                            description="Recibe pedidos en línea directamente en tu POS. Sincronización en tiempo real."
                        />
                        <FeatureCard
                            icon={<Zap className="w-10 h-10 text-yellow-400" />}
                            title="Modo Offline"
                            description="¿Sin internet? No hay problema. Sigue vendiendo y sincroniza cuando vuelvas a estar en línea."
                        />
                        <FeatureCard
                            icon={<BarChart3 className="w-10 h-10 text-purple-400" />}
                            title="Reportes Detallados"
                            description="Analiza tus ventas, productos más vendidos y rendimiento de empleados."
                        />
                        <FeatureCard
                            icon={<ShieldCheck className="w-10 h-10 text-green-400" />}
                            title="Seguridad Total"
                            description="Tus datos están encriptados y seguros en la nube. Copias de seguridad automáticas."
                        />
                        <FeatureCard
                            icon={<Smartphone className="w-10 h-10 text-pink-400" />}
                            title="Multi-dispositivo"
                            description="Accede desde tu computadora, tablet o celular. Tu negocio siempre contigo."
                        />
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-20 relative">
                <div className="absolute inset-0 bg-emerald-900/5 skew-y-3 transform origin-top-left -z-10" />
                <div className="container mx-auto px-4 md:px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Planes simples y transparentes</h2>
                        <p className="text-gray-400">Elige el plan que mejor se adapte al tamaño de tu negocio.</p>
                    </div>

                    <div className="flex justify-center mb-12">
                        <div className="inline-flex bg-gray-800 p-1 rounded-lg gap-1">
                            {/* Monthly Button */}
                            <button
                                onClick={() => setBillingCycle('monthly')}
                                className={`
                                    px-8 py-3 rounded-md text-sm font-medium transition-all duration-200
                                    ${billingCycle === 'monthly'
                                        ? 'bg-emerald-500 text-white shadow-lg'
                                        : 'text-gray-400 hover:text-white'
                                    }
                                `}
                            >
                                Mensual
                            </button>

                            {/* Annual Button */}
                            <button
                                onClick={() => setBillingCycle('annual')}
                                className={`
                                    px-8 py-3 rounded-md text-sm font-medium transition-all duration-200
                                    flex items-center gap-2
                                    ${billingCycle === 'annual'
                                        ? 'bg-emerald-500 text-white shadow-lg'
                                        : 'text-gray-400 hover:text-white'
                                    }
                                `}
                            >
                                <span>Anual</span>
                                <span className="text-xs bg-emerald-400 text-gray-900 px-2 py-0.5 rounded-full font-bold">
                                    -20%
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        <PricingCard
                            title="Emprendedor"
                            price={billingCycle === 'monthly' ? "$9.99" : "$95.90"}
                            period={billingCycle === 'monthly' ? "/mes" : "/año"}
                            savings={billingCycle === 'annual' ? "Ahorras $23.98" : null}
                            description="Perfecto para negocios que inician"
                            features={['1 Usuario', 'Hasta 500 productos', 'Ventas ilimitadas', 'Soporte por email']}
                            buttonText="Crear Cuenta"
                            onClick={() => navigate('/auth')}
                        />
                        <PricingCard
                            title="Pro"
                            price={billingCycle === 'monthly' ? "$39.99" : "$383.90"}
                            period={billingCycle === 'monthly' ? "/mes" : "/año"}
                            savings={billingCycle === 'annual' ? "Ahorras $95.98" : null}
                            description="Para negocios en expansión"
                            isPopular={true}
                            features={['3 Usuarios', 'Productos ilimitados', 'Facturación NCF', 'Reportes avanzados', 'Tienda Web']}
                            buttonText="Comenzar Prueba Gratis"
                            onClick={() => navigate('/auth')}
                        />
                        <PricingCard
                            title="Empresarial"
                            price={billingCycle === 'monthly' ? "$99.99" : "$959.90"}
                            period={billingCycle === 'monthly' ? "/mes" : "/año"}
                            savings={billingCycle === 'annual' ? "Ahorras $239.98" : null}
                            description="Máximo control y potencia"
                            features={['Usuarios ilimitados', 'Múltiples sucursales', 'API Access', 'Soporte prioritario 24/7', 'Gestor de cuenta']}
                            buttonText="Contactar Ventas"
                            onClick={() => navigate('/auth')}
                        />
                    </div>
                </div>
            </section>

            {/* About / Mission Section */}
            <section id="about" className="py-20 bg-gray-800/30">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <h2 className="text-3xl md:text-4xl font-bold">Nuestra Misión</h2>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                Empoderar a los pequeños y medianos negocios con tecnología de clase mundial,
                                haciendo que la gestión empresarial sea simple, accesible y eficiente.
                            </p>
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400">
                                        <Star className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">Visión</h4>
                                        <p className="text-gray-400 text-sm">Ser la plataforma líder en Latinoamérica para el crecimiento de MIPYMES.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">Valores</h4>
                                        <p className="text-gray-400 text-sm">Innovación, Transparencia, y Obsesión por el Cliente.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl blur-2xl opacity-20 transform rotate-6"></div>
                            <div className="relative bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl">
                                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-600 mb-4">
                                    +5,000
                                </div>
                                <p className="text-xl font-medium text-gray-300 mb-8">Negocios confían en nosotros</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-800 p-4 rounded-xl text-center">
                                        <div className="text-2xl font-bold text-emerald-400 mb-1">99.9%</div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wider">Uptime</div>
                                    </div>
                                    <div className="bg-gray-800 p-4 rounded-xl text-center">
                                        <div className="text-2xl font-bold text-blue-400 mb-1">24/7</div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wider">Soporte</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section id="testimonials" className="py-20">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Lo que dicen nuestros clientes</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        <TestimonialCard
                            quote="Desde que usamos esta app, nuestro tiempo de facturación se redujo a la mitad. ¡Es increíble!"
                            author="María González"
                            role="Dueña de Minimarket El Sol"
                            rating={5}
                        />
                        <TestimonialCard
                            quote="El soporte offline es un salvavidas. Nunca paramos de vender, incluso cuando falla el internet."
                            author="Carlos Rodríguez"
                            role="Gerente, Farmacia Salud"
                            rating={5}
                        />
                        <TestimonialCard
                            quote="Me encanta poder ver las ventas desde mi celular mientras estoy de viaje. Control total."
                            author="Ana Martínez"
                            role="CEO, Boutique Moda"
                            rating={5}
                        />
                    </div>
                </div>
            </section>

            {/* Made in Dominican Republic Section */}
            <section className="py-16 border-t border-gray-900">
                <div className="container mx-auto px-4 md:px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center max-w-3xl mx-auto"
                    >
                        {/* Dominican Flag */}
                        <div className="flex justify-center mb-6">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="flex items-center gap-4 bg-gray-800/50 px-8 py-4 rounded-2xl border border-gray-700/50"
                            >
                                <span className="text-6xl">🇩🇴</span>
                                <div className="text-left">
                                    <p className="text-sm text-gray-400">Hecho con orgullo en</p>
                                    <p className="text-2xl font-bold text-white">República Dominicana</p>
                                    <p className="text-xs text-emerald-400 mt-1">por Harold Rosado</p>
                                </div>
                            </motion.div>
                        </div>

                        {/* Dominican Phrase */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                            className="bg-gradient-to-r from-blue-600/20 via-red-600/20 to-blue-600/20 p-6 rounded-xl border border-gray-700/50"
                        >
                            <p className="text-xl md:text-2xl font-medium text-emerald-400 mb-2">
                                "De aquí pal mundo 🚀"
                            </p>
                            <p className="text-gray-400 text-sm md:text-base">
                                Una solución dominicana para emprendedores dominicanos.
                                Creada por nosotros, para nosotros. ¡Apoye lo nuestro! 🇩🇴
                            </p>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* CTA Footer */}
            <footer className="bg-gray-950 py-12 border-t border-gray-900">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-2">
                            <img src={cobroLogo} alt="Logo" className="h-8 w-auto grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all" />
                            <span className="font-bold text-xl text-gray-600">Cobro App</span>
                        </div>
                        <div className="flex gap-8 text-gray-500 text-sm">
                            <a href="#" className="hover:text-emerald-500 transition-colors">Términos</a>
                            <a href="#" className="hover:text-emerald-500 transition-colors">Privacidad</a>
                            <a
                                href="https://wa.me/18099175744?text=Hola,%20me%20interesa%20Cobro%20App"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-emerald-500 transition-colors flex items-center gap-1"
                            >
                                Contacto
                                <span className="text-xs">📱</span>
                            </a>
                        </div>
                        <div className="text-gray-600 text-sm">
                            © {new Date().getFullYear()} Cobro App Inc.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// Subcomponents

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="p-6 rounded-2xl bg-gray-800/50 border border-gray-700/50 hover:border-emerald-500/30 hover:bg-gray-800 transition-all duration-300"
    >
        <div className="bg-gray-900 w-16 h-16 rounded-xl flex items-center justify-center mb-6 shadow-inner">
            {icon}
        </div>
        <h3 className="text-xl font-bold mb-3 text-gray-100">{title}</h3>
        <p className="text-gray-400 leading-relaxed">{description}</p>
    </motion.div>
);

const PricingCard = ({ title, price, period, savings, description, features, isPopular, buttonText, onClick }: any) => (
    <motion.div
        whileHover={{ y: -5 }}
        className={`relative p-8 rounded-2xl border ${isPopular ? 'border-emerald-500 bg-gray-800/80 shadow-2xl shadow-emerald-900/40' : 'border-gray-800 bg-gray-900/50'} flex flex-col`}
    >
        {isPopular && (
            <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2">
                <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Más Popular</span>
            </div>
        )}
        <h3 className="text-2xl font-bold mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-6">{description}</p>
        <div className="mb-6">
            <div className="flex items-baseline">
                <span className="text-4xl font-extrabold">{price}</span>
                <span className="text-gray-500 ml-1">{period}</span>
            </div>
            {savings && (
                <div className="text-emerald-400 text-sm font-medium mt-2 bg-emerald-500/10 inline-block px-2 py-1 rounded">
                    {savings}
                </div>
            )}
        </div>
        <ul className="space-y-4 mb-8 flex-1">
            {features.map((feature: string, i: number) => (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    {feature}
                </li>
            ))}
        </ul>
        <Button
            variant={isPopular ? "default" : "outline"}
            className={`w-full ${isPopular ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-gray-700 hover:bg-gray-800'}`}
            onClick={onClick}
        >
            {buttonText}
        </Button>
    </motion.div>
);

const TestimonialCard = ({ quote, author, role, rating }: any) => (
    <div className="p-6 rounded-2xl bg-gray-800/30 border border-gray-800">
        <div className="flex gap-1 mb-4">
            {[...Array(rating)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            ))}
        </div>
        <p className="text-gray-300 italic mb-6">"{quote}"</p>
        <div>
            <h4 className="font-bold text-white">{author}</h4>
            <p className="text-xs text-emerald-400">{role}</p>
        </div>
    </div>
);

export default LandingPage;
