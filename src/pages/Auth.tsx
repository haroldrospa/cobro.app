import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Building2, Mail, Lock, User, ArrowRight, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { z } from 'zod';
import cobroLogo from '@/assets/cobro-logo-light.png';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
});

const step1Schema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido')
});

const step2Schema = z.object({
  companyName: z.string().min(2, 'El nombre de la empresa debe tener al menos 2 caracteres'),
  rnc: z.string().min(9, 'El RNC/Cédula es obligatorio y debe tener mínimo 9 dígitos')
});

const step4Schema = z.object({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword']
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
  
  // Wizard state
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(0); // 1 for forward, -1 for backward

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

  const handleNextStep = () => {
    setErrors({});
    let hasError = false;
    try {
      if (step === 1) step1Schema.parse({ fullName, email });
      if (step === 2) step2Schema.parse({ companyName, rnc });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        hasError = true;
      }
    }
    if (!hasError) {
      setDirection(1);
      setStep(s => s + 1);
    }
  };

  const handlePrevStep = () => {
    setDirection(-1);
    setStep(s => s - 1);
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

  // Clean input style using light gray background and emerald accents
  const inputCls = "pl-9 h-11 text-sm bg-slate-50/50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/10 transition-all rounded-lg";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f8fafc] text-slate-900 px-4 py-8 relative overflow-y-auto font-sans selection:bg-emerald-500/30">
      {/* Subtle emerald glow behind the card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[400px] h-[400px] bg-emerald-500/[0.04] rounded-full blur-[100px]" />
      </div>

      <motion.div
        className="relative w-full max-w-[420px] z-10 flex flex-col"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center cursor-pointer"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => navigate('/')}
          >
            <img
              src={cobroLogo}
              alt="Cobro"
              className="h-10 sm:h-12 w-auto mx-auto"
              loading="eager"
            />
          </motion.div>
        </div>

        <Card className="bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative rounded-2xl">
          <CardContent className="p-6 sm:p-8 relative z-10">
            <Tabs defaultValue={isSignup ? "signup" : "login"} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8 bg-slate-100/80 border border-slate-200/60 p-1 rounded-xl relative gap-1 h-auto">
                <TabsTrigger
                  value="login"
                  className="data-[state=active]:!bg-white data-[state=active]:!text-slate-900 data-[state=active]:shadow-sm transition-all duration-300 rounded-lg py-2 px-4 text-sm font-medium text-slate-500 hover:text-slate-800 outline-none ring-0 focus-visible:ring-0"
                >
                  Iniciar Sesión
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="data-[state=active]:!bg-white data-[state=active]:!text-slate-900 data-[state=active]:shadow-sm transition-all duration-300 rounded-lg py-2 px-4 text-sm font-medium text-slate-500 hover:text-slate-800 outline-none ring-0 focus-visible:ring-0"
                >
                  Registrarse
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-xs font-medium text-slate-600">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" strokeWidth={1.5} />
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
                    {errors.email && <p className="text-[10px] text-red-600 mt-1">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="text-xs font-medium text-slate-600">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" strokeWidth={1.5} />
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
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-slate-400 hover:text-slate-600"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                      </Button>
                    </div>
                    {errors.password && <p className="text-[10px] text-red-600 mt-1">{errors.password}</p>}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-[0_4px_12px_rgba(16,185,129,0.12)] transition-all rounded-lg mt-2"
                    disabled={loading}
                  >
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Iniciando sesión...</> : 'Continuar'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0 relative overflow-hidden min-h-[380px]">
                <div className="mb-8 mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      Paso {step} de 4
                    </span>
                    <span className="text-xs font-medium text-emerald-600">
                      {step === 1 && 'Información Básica'}
                      {step === 2 && 'Empresa'}
                      {step === 3 && 'Selección de Plan'}
                      {step === 4 && 'Seguridad'}
                    </span>
                  </div>
                  <div className="flex gap-1.5 h-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div 
                        key={i} 
                        className={`flex-1 rounded-full transition-colors duration-500 ${
                          step >= i ? 'bg-emerald-500' : 'bg-slate-200'
                        }`} 
                      />
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait" custom={direction}>
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      custom={direction}
                      initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-name" className="text-xs font-medium text-slate-600">Nombre Completo</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" strokeWidth={1.5} />
                          <Input
                            id="signup-name"
                            type="text"
                            placeholder="Ej. Juan Pérez"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            className={inputCls}
                          />
                        </div>
                        {errors.fullName && <p className="text-[10px] text-red-600">{errors.fullName}</p>}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="signup-email" className="text-xs font-medium text-slate-600">Correo electrónico</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" strokeWidth={1.5} />
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className={inputCls}
                          />
                        </div>
                        {errors.email && <p className="text-[10px] text-red-600">{errors.email}</p>}
                      </div>

                      <Button
                        type="button"
                        onClick={handleNextStep}
                        className="w-full h-11 mt-6 bg-emerald-500 hover:bg-emerald-600 text-white transition-all rounded-lg font-bold group shadow-[0_4px_12px_rgba(16,185,129,0.12)]"
                      >
                        Siguiente <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      custom={direction}
                      initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-company" className="text-xs font-medium text-slate-600">Nombre de la Empresa</Label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" strokeWidth={1.5} />
                          <Input
                            id="signup-company"
                            type="text"
                            placeholder="Ej. Mi Tienda, S.R.L."
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                            className={inputCls}
                          />
                        </div>
                        {errors.companyName && <p className="text-[10px] text-red-600">{errors.companyName}</p>}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="signup-rnc" className="text-xs font-medium text-slate-600">RNC o Cédula</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" strokeWidth={1.5} />
                          <Input
                            id="signup-rnc"
                            type="text"
                            placeholder="Ej. 132456789"
                            value={rnc}
                            onChange={e => setRnc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            className={inputCls}
                          />
                        </div>
                        {errors.rnc && <p className="text-[10px] text-red-600">{errors.rnc}</p>}
                      </div>

                      <div className="flex gap-3 mt-6">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handlePrevStep}
                          className="flex-[1] h-11 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg group transition-all"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Atrás
                        </Button>
                        <Button
                          type="button"
                          onClick={handleNextStep}
                          className="flex-[2] h-11 bg-emerald-500 hover:bg-emerald-600 text-white transition-all rounded-lg font-bold group shadow-[0_4px_12px_rgba(16,185,129,0.12)]"
                        >
                          Siguiente <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      custom={direction}
                      initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { id: 'basic', label: 'Emprendedor', price: '$29 USD/mes', icon: '🌱' },
                          { id: 'pro', label: 'Negocio', price: '$59 USD/mes', icon: '⭐' },
                          { id: 'enterprise', label: 'Corporativo', price: 'Personalizado', icon: '🏢' },
                        ].map(plan => (
                          <div
                            key={plan.id}
                            onClick={() => setSelectedPlan(plan.id)}
                            className={`cursor-pointer rounded-xl border p-4 flex items-center gap-4 transition-all duration-200 ${
                              selectedPlan === plan.id
                                ? 'border-emerald-500 bg-emerald-50/40 shadow-[0_4px_20px_rgba(16,185,129,0.06)]'
                                : 'border-slate-200 bg-slate-50/20 hover:border-slate-300 hover:bg-slate-50/50'
                              }`}
                          >
                             <div className="text-2xl opacity-90">{plan.icon}</div>
                             <div className="flex-1">
                               <div className={`text-sm font-semibold tracking-wide ${selectedPlan === plan.id ? 'text-emerald-950 font-bold' : 'text-slate-700'}`}>{plan.label}</div>
                               <div className={`text-xs mt-0.5 ${selectedPlan === plan.id ? 'text-emerald-600' : 'text-slate-500'}`}>{plan.price}</div>
                             </div>
                             <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                               selectedPlan === plan.id ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-transparent'
                             }`}>
                               {selectedPlan === plan.id && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                             </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-3 mt-4">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handlePrevStep}
                          className="flex-[1] h-11 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg group transition-all"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Atrás
                        </Button>
                        <Button
                          type="button"
                          onClick={handleNextStep}
                          className="flex-[2] h-11 bg-emerald-500 hover:bg-emerald-600 text-white transition-all rounded-lg font-bold group shadow-[0_4px_12px_rgba(16,185,129,0.12)]"
                        >
                          Siguiente <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.form
                      key="step4"
                      onSubmit={handleSignup}
                      custom={direction}
                      initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-password" className="text-xs font-medium text-slate-600">Contraseña</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" strokeWidth={1.5} />
                          <Input
                            id="signup-password"
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
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-slate-400 hover:text-slate-600"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                          </Button>
                        </div>
                        {errors.password && <p className="text-[10px] text-red-600">{errors.password}</p>}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="signup-confirm" className="text-xs font-medium text-slate-600">Confirmar Contraseña</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" strokeWidth={1.5} />
                          <Input
                            id="signup-confirm"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            disabled={loading}
                            className={inputCls}
                          />
                        </div>
                        {errors.confirmPassword && <p className="text-[10px] text-red-600">{errors.confirmPassword}</p>}
                      </div>

                      <div className="flex gap-3 mt-6">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handlePrevStep}
                          disabled={loading}
                          className="flex-[1] h-11 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg group transition-all"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Atrás
                        </Button>
                        <Button
                          type="submit"
                          disabled={loading}
                          className="flex-[2] h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all rounded-lg shadow-[0_4px_12px_rgba(16,185,129,0.12)]"
                        >
                          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : 'Crear Cuenta'}
                        </Button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center mt-6">
          <Button
            variant="link"
            className="text-slate-400 hover:text-slate-700 transition-colors text-xs font-medium"
            onClick={() => navigate('/')}
          >
            <ArrowRight className="mr-2 h-3.5 w-3.5 rotate-180" />
            Volver al inicio
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
