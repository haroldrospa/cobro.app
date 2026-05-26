import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Building2, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { z } from 'zod';
import cobroLogo from '@/assets/cobro-logo-dark.png';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  companyName: z.string().min(2, 'El nombre de la empresa debe tener al menos 2 caracteres'),
  rnc: z.string().min(9, 'El RNC/Cédula es obligatorio y debe tener mínimo 9 dígitos'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword']
});

const Auth = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const isSignup = searchParams.get('signup') === 'true';
  const defaultPlan = searchParams.get('plan') || 'basic';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [rnc, setRnc] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(defaultPlan);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let redirected = false;
    const handleRedirect = (session: any) => {
      if (session && !redirected) {
        redirected = true;
        navigate('/app', { replace: true });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) handleRedirect(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) handleRedirect(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      loginSchema.parse({ email, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setLoading(true);

    try {
      localStorage.removeItem('sb-hkzgxdmnvyoviwketxva-auth-token');

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      if (data.session) {
        navigate('/app');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setLoading(false);

      let errorMessage = error.message;
      let errorTitle = 'Error al iniciar sesión';

      if (error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError') ||
        error.message?.includes('fetch') ||
        error.name === 'AuthRetryableFetchError') {
        errorTitle = 'Error de conexión';
        errorMessage = `No se puede conectar con el servidor. Por favor, verifica la configuración de URLs en Supabase Dashboard → Authentication → URL Configuration`;
      } else if (errorMessage === 'Invalid login credentials') {
        errorMessage = 'Credenciales inválidas. Verifica tu email y contraseña.';
      } else if (error.name === 'AbortError') {
        errorMessage = 'La conexión fue interrumpida. Por favor intenta de nuevo.';
      }

      toast({
        title: errorTitle,
        description: errorMessage || 'Ha ocurrido un error inesperado',
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      signupSchema.parse({ fullName, companyName, rnc, email, password, confirmPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            company_name: companyName,
            rnc: rnc,
            plan_id: selectedPlan
          }
        }
      });

      if (error) {
        throw error;
      }

      setLoading(false);
      toast({
        title: 'Registro exitoso',
        description: 'Te hemos enviado un email de confirmación. Revisa tu bandeja de entrada.'
      });

    } catch (error: any) {
      setLoading(false);

      if (error.message && error.message.includes('already registered')) {
        toast({
          title: 'Usuario ya registrado',
          description: 'Este email ya está registrado. Intenta iniciar sesión.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Error al registrarse',
          description: error.message || 'Ha ocurrido un error inesperado',
          variant: 'destructive'
        });
      }
    }
  };

  // Input class shared for compactness
  const inputCls = "pl-9 h-9 sm:h-10 text-sm bg-[#1E293B]/60 border-white/10 text-white placeholder:text-gray-500 focus:bg-[#1E293B] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 transition-all rounded-xl";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8 relative overflow-y-auto">
      {/* Ambient blobs */}
      <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.18) 0%, transparent 70%)', animation: 'blob-pulse 12s ease-in-out infinite' }}
      />
      <div className="absolute -bottom-[20%] -left-[10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34,197,120,0.15) 0%, transparent 70%)', animation: 'blob-pulse 14s ease-in-out infinite reverse' }}
      />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(52,211,153,0.06) 0%, transparent 70%)' }}
      />

      <motion.div
        className="relative w-full max-w-md z-10 flex flex-col"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className="text-center mb-3 sm:mb-5">
          <motion.div
            className="inline-flex items-center justify-center mb-1 sm:mb-2 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => navigate('/')}
          >
            <img
              src={cobroLogo}
              alt="Cobro"
              className="h-12 sm:h-16 lg:h-20 w-auto mx-auto"
              loading="eager"
            />
          </motion.div>
          <p className="text-gray-400 text-[10px] sm:text-xs font-semibold tracking-[0.15em] sm:tracking-[0.2em] uppercase">
            Sistema de facturación inteligente
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="backdrop-blur-3xl bg-[#0F172A]/70 border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden relative rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <CardContent className="p-4 sm:p-6 relative z-10">
              <Tabs defaultValue={isSignup ? "signup" : "login"} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-5 bg-[#162032] border border-white/[0.05] p-1 rounded-2xl shadow-inner relative gap-1 h-auto">
                  <TabsTrigger
                    value="login"
                    className="data-[state=active]:!bg-emerald-500 data-[state=active]:!text-emerald-950 data-[state=active]:!shadow-[0_4px_15px_rgba(52,211,153,0.3)] transition-all duration-300 rounded-xl py-2 sm:py-2.5 px-4 text-sm font-bold text-gray-400 hover:text-gray-300 outline-none ring-0 focus-visible:ring-0"
                  >
                    Iniciar Sesión
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="data-[state=active]:!bg-emerald-500 data-[state=active]:!text-emerald-950 data-[state=active]:!shadow-[0_4px_15px_rgba(52,211,153,0.3)] transition-all duration-300 rounded-xl py-2 sm:py-2.5 px-4 text-sm font-bold text-gray-400 hover:text-gray-300 outline-none ring-0 focus-visible:ring-0"
                  >
                    Registrarse
                  </TabsTrigger>
                </TabsList>

                {/* ── LOGIN ── */}
                <TabsContent value="login" className="mt-0">
                  <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="login-email" className="text-xs sm:text-sm font-medium text-gray-200">Correo electrónico</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="tu@email.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          disabled={loading}
                          className={inputCls}
                        />
                      </div>
                      {errors.email && <p className="text-[10px] text-red-400">{errors.email}</p>}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="login-password" className="text-xs sm:text-sm font-medium text-gray-200">Contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          disabled={loading}
                          className={`${inputCls} pr-10`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-2.5 hover:bg-transparent text-gray-400 hover:text-white"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      {errors.password && <p className="text-[10px] text-red-400">{errors.password}</p>}
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-10 sm:h-11 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-emerald-950 font-bold shadow-[0_4px_15px_rgba(52,211,153,0.3)] hover:shadow-[0_4px_25px_rgba(52,211,153,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 rounded-xl mt-1"
                      disabled={loading}
                    >
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Iniciando sesión...</> : 'Iniciar Sesión'}
                    </Button>
                  </form>
                </TabsContent>

                {/* ── REGISTRO ── */}
                <TabsContent value="signup" className="mt-0">
                  <motion.form
                    onSubmit={handleSignup}
                    className="space-y-2 sm:space-y-2.5"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="space-y-1">
                      <Label htmlFor="signup-name" className="text-[10px] sm:text-xs font-medium text-gray-300">Nombre Completo</Label>
                      <div className="relative">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Juan Pérez"
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          disabled={loading}
                          className="pl-8 h-9 text-xs bg-[#1E293B]/60 border-white/10 text-white placeholder:text-gray-600 focus:bg-[#1E293B] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 transition-all rounded-xl"
                        />
                      </div>
                      {errors.fullName && <p className="text-[9px] text-red-400">{errors.fullName}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="signup-company" className="text-[10px] sm:text-xs font-medium text-gray-300">Empresa</Label>
                        <div className="relative">
                          <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
                          <Input
                            id="signup-company"
                            type="text"
                            placeholder="Mi Tienda, S.R.L."
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                            disabled={loading}
                            className="pl-8 h-9 text-xs bg-[#1E293B]/60 border-white/10 text-white placeholder:text-gray-600 focus:bg-[#1E293B] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 transition-all rounded-xl"
                          />
                        </div>
                        {errors.companyName && <p className="text-[9px] text-red-400">{errors.companyName}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="signup-rnc" className="text-[10px] sm:text-xs font-medium text-gray-300">RNC o Cédula</Label>
                        <div className="relative">
                          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
                          <Input
                            id="signup-rnc"
                            type="text"
                            placeholder="132456789"
                            value={rnc}
                            onChange={e => setRnc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            disabled={loading}
                            className="pl-8 h-9 text-xs bg-[#1E293B]/60 border-white/10 text-white placeholder:text-gray-600 focus:bg-[#1E293B] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 transition-all rounded-xl"
                          />
                        </div>
                        {errors.rnc && <p className="text-[9px] text-red-400">{errors.rnc}</p>}
                      </div>
                    </div>

                    {/* Plan selector compacto */}
                    <div className="space-y-1">
                      <Label className="text-[10px] sm:text-xs font-medium text-gray-300">Plan</Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'basic', label: 'Emprendedor', price: '$29 USD' },
                          { id: 'pro', label: 'Negocio', price: '$59 USD' },
                          { id: 'enterprise', label: 'Corporativo', price: 'Personalizado' },
                        ].map(plan => (
                          <div
                            key={plan.id}
                            onClick={() => setSelectedPlan(plan.id)}
                            className={`cursor-pointer rounded-xl border p-1.5 text-center transition-all flex flex-col justify-center items-center ${selectedPlan === plan.id
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-white/10 hover:border-white/20 hover:bg-white/5 text-gray-400'
                              }`}
                          >
                            <div className={`text-[10px] font-bold ${selectedPlan === plan.id ? 'text-white' : ''}`}>{plan.label}</div>
                            <div className="text-[8px] mt-0.5 opacity-70">{plan.price}{plan.price !== 'Personalizado' ? '/mes' : ''}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                      <Label htmlFor="signup-email" className="text-[10px] sm:text-xs font-medium text-gray-300">Correo electrónico</Label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="tu@email.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          disabled={loading}
                          className="pl-8 h-9 text-xs bg-[#1E293B]/60 border-white/10 text-white placeholder:text-gray-600 focus:bg-[#1E293B] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 transition-all rounded-xl"
                        />
                      </div>
                      {errors.email && <p className="text-[9px] text-red-400">{errors.email}</p>}
                    </div>

                    {/* Contraseñas en grid 2 cols */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="signup-password" className="text-[10px] sm:text-xs font-medium text-gray-300">Contraseña</Label>
                        <div className="relative">
                          <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
                          <Input
                            id="signup-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            disabled={loading}
                            className="pl-8 pr-8 h-9 text-xs bg-[#1E293B]/60 border-white/10 text-white placeholder:text-gray-600 focus:bg-[#1E293B] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 transition-all rounded-xl"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-2 hover:bg-transparent text-gray-400 hover:text-white"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        </div>
                        {errors.password && <p className="text-[9px] text-red-400">{errors.password}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="signup-confirm" className="text-[10px] sm:text-xs font-medium text-gray-300">Confirmar</Label>
                        <div className="relative">
                          <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
                          <Input
                            id="signup-confirm"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            disabled={loading}
                            className="pl-8 h-9 text-xs bg-[#1E293B]/60 border-white/10 text-white placeholder:text-gray-600 focus:bg-[#1E293B] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 transition-all rounded-xl"
                          />
                        </div>
                        {errors.confirmPassword && <p className="text-[9px] text-red-400">{errors.confirmPassword}</p>}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-10 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-emerald-950 font-bold shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:shadow-[0_0_30px_rgba(52,211,153,0.5)] hover:-translate-y-0.5 transition-all duration-300 rounded-xl"
                      disabled={loading}
                    >
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : 'Crear Cuenta'}
                    </Button>
                  </motion.form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer compacto */}
        <div className="flex items-center justify-between mt-2.5 px-1">
          <p className="text-[10px] text-gray-600">© {new Date().getFullYear()} Cobro</p>
          <Button
            variant="link"
            className="text-gray-500 hover:text-emerald-400 transition-colors text-[10px] h-auto p-0"
            onClick={() => navigate('/')}
          >
            <ArrowRight className="mr-1 h-3 w-3 rotate-180" />
            Volver al inicio
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
