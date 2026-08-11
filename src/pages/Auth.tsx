import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Building2, Mail, Lock, User, ArrowRight, ArrowLeft, ChevronRight, ChevronLeft, Check, Phone } from 'lucide-react';
import { z } from 'zod';
import cobroLogo from '@/assets/cobro-logo-dark.png';
import { fetchClientSecurityInfo, sendSecurityNotificationEmail } from '@/utils/masterSecurity';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
});

const step1Schema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos')
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
  phone: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos'),
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
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+1_do');
  const [companyName, setCompanyName] = useState('');
  const [rnc, setRnc] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('basic');
  const [selectedBusinessType, setSelectedBusinessType] = useState<'restaurant' | 'store' | 'supermarket'>('store');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot-password' | 'update-password'>(() => {
    const isRecovery = window.location.hash.includes('type=recovery') || 
                       window.location.href.includes('recovery') || 
                       window.location.search.includes('type=recovery');
    return isRecovery ? 'update-password' : (isSignup ? 'signup' : 'login');
  });

  useEffect(() => {
    setAuthView(isSignup ? 'signup' : 'login');
  }, [isSignup]);
  
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
      if (event === 'PASSWORD_RECOVERY') {
        setAuthView('update-password');
      } else if (session && event !== 'PASSWORD_RECOVERY' && authView !== 'update-password') {
        handleRedirect(session);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const isRecovery = window.location.hash.includes('type=recovery') || 
                         window.location.href.includes('recovery') || 
                         window.location.search.includes('type=recovery');
      if (session && !isRecovery && authView !== 'update-password') {
        handleRedirect(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, authView]);

  useEffect(() => {
    // Force dark mode on document element for the Auth page to keep styling premium and dark
    const htmlElement = document.documentElement;
    const hadDark = htmlElement.classList.contains('dark');
    if (!hadDark) {
      htmlElement.classList.add('dark');
    }
    return () => {
      // Restore previous state if needed
      if (!hadDark) {
        htmlElement.classList.remove('dark');
      }
    };
  }, []);

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

    // Interceptor de inicio de sesión para el Panel Maestro (cobroapp@cobroapp.com / 190421)
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();
    const isMasterEmail = cleanEmail === 'cobroapp@cobroapp.com' || cleanEmail === 'haroldrospa@gmail.com';
    const isMasterPass = cleanPass === '190421' || cleanPass === '2026' || cleanPass === 'admin123';

    if (isMasterEmail && isMasterPass) {
      toast({
        title: "🛡️ Autenticando Acceso Maestro...",
        description: "Obteniendo ubicación y enviando alerta a Haroldrospa@gmail.com",
      });

      try {
        const secInfo = await fetchClientSecurityInfo();
        const fullLoginInfo = {
          email: cleanEmail,
          ...secInfo,
          id: Date.now().toString()
        };

        sessionStorage.setItem("cobroapp_master_auth", "true");
        sessionStorage.setItem("cobroapp_master_session_info", JSON.stringify(fullLoginInfo));

        // Guardar logs de auditoría local
        const savedLogsStr = localStorage.getItem("cobroapp_master_security_logs");
        const currentLogs = savedLogsStr ? JSON.parse(savedLogsStr) : [];
        const newLogs = [fullLoginInfo, ...currentLogs].slice(0, 50);
        localStorage.setItem("cobroapp_master_security_logs", JSON.stringify(newLogs));

        // Enviar correo de alerta en segundo plano
        sendSecurityNotificationEmail(fullLoginInfo).catch(() => {});

        toast({
          title: "🔓 Acceso Concedido al Panel Maestro",
          description: `Ubicación: ${secInfo.location} | Alerta enviada a Haroldrospa@gmail.com`,
        });

        // Redirección directa al Panel Maestro
        window.location.href = '/admin/super-panel';
        return;
      } catch (err) {
        sessionStorage.setItem("cobroapp_master_auth", "true");
        window.location.href = '/admin/super-panel';
        return;
      } finally {
        setLoading(false);
      }
    }

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

  const handleNextStep = async () => {
    setErrors({});
    let hasError = false;
    let currentFieldErrors: Record<string, string> = {};
    
    try {
      if (step === 1) step1Schema.parse({ fullName, email, phone });
      if (step === 2) step2Schema.parse({ companyName, rnc });
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          if (err.path[0]) {
            currentFieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(currentFieldErrors);
        hasError = true;
      }
    }

    if (hasError) return;

    setLoading(true);

    try {
      if (step === 1) {
        const fullPhone = `${countryCode.split('_')[0]}${phone}`;
        const { data: existing, error } = await supabase.rpc('check_existing_user', {
          p_email: email,
          p_phone: fullPhone
        });
        
        if (existing) {
          const { emailExists, phoneExists } = existing as any;
          if (emailExists) currentFieldErrors.email = 'Este correo electrónico ya está registrado.';
          if (phoneExists) currentFieldErrors.phone = 'Este teléfono ya está registrado.';
          
          if (emailExists || phoneExists) {
            setErrors(currentFieldErrors);
            setLoading(false);
            return;
          }
        }
      }

      if (step === 2) {
        const { data: rncExists, error } = await supabase.rpc('check_existing_rnc', {
          p_rnc: rnc
        });
          
        if (rncExists) {
          setErrors({ rnc: 'Este RNC ya se encuentra registrado.' });
          setLoading(false);
          return;
        }
      }
    } catch (err) {
       console.error("Validation error", err);
    }
    
    setLoading(false);
    setDirection(1);
    setStep(s => s + 1);
  };

  const handlePrevStep = () => {
    setDirection(-1);
    setStep(s => s - 1);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      signupSchema.parse({ fullName, companyName, rnc, email, phone, password, confirmPassword });
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
            phone: `${countryCode.split('_')[0]}${phone}`,
            plan_id: 'basic',
            shop_type: selectedBusinessType,
            onboarding_completed: true
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

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!email || !email.trim()) {
      setErrors({ email: 'El correo electrónico es requerido' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast({
        title: "Correo enviado",
        description: "Revisa tu bandeja de entrada para restablecer tu contraseña.",
      });
      setAuthView('login');
    } catch (error: any) {
      toast({
        title: "Error al enviar correo",
        description: error.message || "Ha ocurrido un error inesperado.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (password.length < 6) {
      setErrors({ password: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Las contraseñas no coinciden' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido restablecida con éxito.",
      });
      // Clear hash/params to prevent loops
      window.location.hash = '';
      navigate('/app', { replace: true });
    } catch (error: any) {
      toast({
        title: "Error al actualizar",
        description: error.message || "Ha ocurrido un error al actualizar la contraseña.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Clean input style using dark glass background and emerald accents
  const inputCls = "pl-10 h-12 text-sm !bg-slate-950/40 !border-white/[0.08] text-white placeholder:text-slate-600 focus:!bg-slate-950/60 focus:!border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 focus-visible:ring-offset-0 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500/50 transition-all rounded-xl";

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-tr from-[#121619] via-[#1a2228] to-[#252f36] text-white px-4 py-8 overflow-y-auto font-sans selection:bg-emerald-500/30">
      {/* Structured dotted grid pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.2]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1.5px, transparent 0)',
        backgroundSize: '24px 24px'
      }} />

      {/* Soft emerald gradient glow auras in the corners */}
      <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Decorative center card background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] bg-emerald-500/[0.02] rounded-full blur-[60px] pointer-events-none z-0" />

      <motion.div
        className="relative w-full max-w-[420px] z-10 flex flex-col"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex flex-col items-center justify-center cursor-pointer"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => navigate('/')}
          >
            <div className="relative flex items-center justify-center mb-6">
              {/* Soft ambient logo glow */}
              <div className="absolute w-14 h-14 rounded-full bg-emerald-500/[0.08] blur-xl animate-pulse" />
              
              <img
                src={cobroLogo}
                alt="Cobro"
                className="relative h-14 w-auto object-contain rounded-xl z-10 filter drop-shadow-[0_4px_12px_rgba(16,185,129,0.15)] animate-[pulse_3s_infinite_ease-in-out]"
                loading="eager"
              />
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-3xl font-black tracking-tight text-white">Cobro<span className="text-emerald-400">app</span></span>
            </div>
            <p className="text-slate-400 text-[11px] mt-1.5 font-medium tracking-wide">Tu negocio en control, en cualquier lugar</p>
          </motion.div>
        </div>

        <Card className="bg-[#1e252b]/95 backdrop-blur-xl border border-white/[0.06] border-t-emerald-500/20 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.6)] overflow-hidden relative rounded-2xl w-full">
          <CardContent className="p-6 sm:p-8 relative z-10">
            <motion.div layout transition={{ type: "spring", stiffness: 350, damping: 40 }} className="w-full">
              {authView === 'forgot-password' ? (
              <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                <div className="space-y-2 mb-4">
                  <h3 className="text-lg font-bold text-white">Recuperar Contraseña</h3>
                  <p className="text-xs text-slate-400">Ingresa tu correo electrónico y te enviaremos un enlace de recuperación.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" strokeWidth={1.75} />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={loading}
                      className={inputCls}
                    />
                  </div>
                  {errors.email && <p className="text-[10px] text-red-400 mt-1">{errors.email}</p>}
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold shadow-[0_4px_20px_rgba(16,185,129,0.2)] transition-all active:scale-[0.98] rounded-xl mt-6 text-sm"
                  disabled={loading}
                >
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : 'Enviar enlace de recuperación'}
                </Button>
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setAuthView('login')}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Volver a iniciar sesión
                  </button>
                </div>
              </form>
            ) : authView === 'update-password' ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2 mb-4">
                  <h3 className="text-lg font-bold text-white">Establecer Nueva Contraseña</h3>
                  <p className="text-xs text-slate-400">Ingresa tu nueva contraseña para acceder a tu cuenta.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="update-password-input" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Nueva Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" strokeWidth={1.75} />
                    <Input
                      id="update-password-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={loading}
                      className={inputCls}
                    />
                  </div>
                  {errors.password && <p className="text-[10px] text-red-400 mt-1">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="update-confirm-input" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Confirmar Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" strokeWidth={1.75} />
                    <Input
                      id="update-confirm-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className={inputCls}
                    />
                  </div>
                  {errors.confirmPassword && <p className="text-[10px] text-red-400 mt-1">{errors.confirmPassword}</p>}
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold shadow-[0_4px_20px_rgba(16,185,129,0.2)] transition-all active:scale-[0.98] rounded-xl mt-6 text-sm"
                  disabled={loading}
                >
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : 'Actualizar y Entrar'}
                </Button>
              </form>
            ) : (
              <Tabs value={authView === 'signup' ? 'signup' : 'login'} onValueChange={(val) => setAuthView(val as any)} className="w-full">
                <TabsList className="flex justify-center w-full mb-8 bg-transparent border-b border-white/[0.06] p-0 rounded-none gap-8 h-10 relative">
                <TabsTrigger
                  value="login"
                  className="relative pb-3 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors duration-200 outline-none focus-visible:ring-0 !bg-transparent data-[state=active]:!bg-transparent data-[state=active]:!text-emerald-400 data-[state=active]:!shadow-none data-[state=active]:!border-0 rounded-none px-1"
                >
                  Iniciar Sesión
                  {authView === 'login' && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500 rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="relative pb-3 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors duration-200 outline-none focus-visible:ring-0 !bg-transparent data-[state=active]:!bg-transparent data-[state=active]:!text-emerald-400 data-[state=active]:!shadow-none data-[state=active]:!border-0 rounded-none px-1"
                >
                  Registrarse
                  {authView === 'signup' && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500 rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" strokeWidth={1.75} />
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
                    {errors.email && <p className="text-[10px] text-red-400 mt-1">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" strokeWidth={1.75} />
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
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 hover:bg-transparent text-slate-400 hover:text-slate-200"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4.5 w-4.5" strokeWidth={1.75} /> : <Eye className="h-4.5 w-4.5" strokeWidth={1.75} />}
                      </Button>
                    </div>
                    <div className="flex justify-between items-center mt-4 mb-2">
                      <label 
                        className="flex items-center gap-2.5 cursor-pointer group select-none"
                        onClick={() => setRememberMe(!rememberMe)}
                      >
                        <div className="relative">
                          {/* Outer ring */}
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-300 ease-out shadow-sm
                            ${rememberMe 
                              ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                              : 'bg-[#15171b] border-slate-700/60 group-hover:border-emerald-500/50'
                            }`}
                          >
                            <Check 
                              className={`w-3.5 h-3.5 text-slate-950 stroke-[4] transition-all duration-300
                                ${rememberMe ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
                              `}
                            />
                          </div>
                          {/* Ripple effect on check */}
                          {rememberMe && (
                            <div className="absolute inset-0 rounded-md ring-2 ring-emerald-500/30 animate-ping opacity-20 pointer-events-none" />
                          )}
                        </div>
                        <span className="text-[11.5px] text-slate-400 font-medium group-hover:text-slate-200 transition-colors">
                          Recordar sesión
                        </span>
                      </label>
                      
                      <button
                        type="button"
                        onClick={() => setAuthView('forgot-password')}
                        className="text-[11.5px] text-emerald-500/80 hover:text-emerald-400 transition-colors duration-200 font-semibold cursor-pointer tracking-tight"
                      >
                        ¿Olvidaste tu clave?
                      </button>
                    </div>
                    {errors.password && <p className="text-[10px] text-red-400 mt-1">{errors.password}</p>}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold shadow-[0_4px_20px_rgba(16,185,129,0.2)] transition-all active:scale-[0.98] rounded-xl mt-6 text-sm"
                    disabled={loading}
                  >
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Iniciando sesión...</> : 'Continuar'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0 relative overflow-hidden min-h-[380px]">
                <div className="mb-8 mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                      Paso {step} de 4
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {step === 1 && 'Información Básica'}
                      {step === 2 && 'Empresa'}
                      {step === 3 && 'Tipo de Negocio'}
                      {step === 4 && 'Seguridad'}
                    </span>
                  </div>
                  <div className="flex gap-1.5 h-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div 
                        key={i} 
                        className={`flex-1 rounded-full transition-colors duration-500 ${
                          step >= i ? 'bg-emerald-500' : 'bg-white/10'
                        }`} 
                      />
                    ))}
                  </div>
                  {step === 1 && (
                    <div className="mt-5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-3">
                      <span className="text-xl">🎁</span>
                      <p className="text-xs text-emerald-400 font-medium leading-relaxed">
                        ¡Crea tu cuenta ahora y disfruta de <strong className="text-white">15 días de prueba gratis</strong> con todas las funciones!
                      </p>
                    </div>
                  )}
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
                      <div className="space-y-2">
                        <Label htmlFor="signup-name" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Nombre Completo</Label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" strokeWidth={1.75} />
                          <Input
                            id="signup-name"
                            type="text"
                            placeholder="Ej. Juan Pérez"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            className={`${inputCls} ${errors.fullName ? '!border-red-500/60 focus:!border-red-500 focus:ring-red-500/20 focus-visible:border-red-500' : ''}`}
                          />
                        </div>
                        {errors.fullName && <p className="text-[10px] text-red-400">{errors.fullName}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-email" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Correo electrónico</Label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" strokeWidth={1.75} />
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className={`${inputCls} ${errors.email ? '!border-red-500/60 focus:!border-red-500 focus:ring-red-500/20 focus-visible:border-red-500' : ''}`}
                          />
                        </div>
                        {errors.email && <p className="text-[10px] text-red-400">{errors.email}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-phone" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Teléfono móvil</Label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 z-10" strokeWidth={1.75} />
                          
                          <div className="absolute left-9 top-1/2 -translate-y-1/2 z-10 flex items-center">
                            <Select value={countryCode} onValueChange={setCountryCode}>
                              <SelectTrigger className="h-8 border-0 bg-transparent text-slate-200 focus:ring-0 focus:ring-offset-0 px-2 shadow-none font-medium gap-1 text-[13px] hover:text-white transition-colors">
                                <SelectValue placeholder="País" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#121619] border-white/10 text-slate-200 max-h-[250px] shadow-xl">
                                {[
                                  { value: '+1_do', code: 'do', label: '+1', name: 'DO' },
                                  { value: '+1_us', code: 'us', label: '+1', name: 'US' },
                                  { value: '+34', code: 'es', label: '+34', name: 'ES' },
                                  { value: '+52', code: 'mx', label: '+52', name: 'MX' },
                                  { value: '+54', code: 'ar', label: '+54', name: 'AR' },
                                  { value: '+56', code: 'cl', label: '+56', name: 'CL' },
                                  { value: '+57', code: 'co', label: '+57', name: 'CO' },
                                ].map((country) => (
                                  <SelectItem key={country.value} value={country.value} className="cursor-pointer focus:bg-white/5 focus:text-white">
                                    <div className="flex items-center gap-2">
                                      <img 
                                        src={`https://flagcdn.com/w20/${country.code}.png`} 
                                        srcSet={`https://flagcdn.com/w40/${country.code}.png 2x`}
                                        width="16" 
                                        height="12" 
                                        alt={country.name} 
                                        className="rounded-[2px] shadow-sm"
                                      />
                                      <span>{country.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="h-5 w-[1px] bg-white/10 mx-1"></div>
                          </div>

                          <Input
                            id="signup-phone"
                            type="tel"
                            placeholder="809-555-1234"
                            value={phone}
                            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                            className={`${inputCls} !pl-[145px] ${errors.phone ? '!border-red-500/60 focus:!border-red-500 focus:ring-red-500/20 focus-visible:border-red-500' : ''}`}
                          />
                        </div>
                        {errors.phone && <p className="text-[10px] text-red-400">{errors.phone}</p>}
                      </div>

                      <Button
                        type="button"
                        onClick={handleNextStep}
                        disabled={loading}
                        className="w-full h-12 mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold shadow-[0_4px_20px_rgba(16,185,129,0.2)] transition-all rounded-xl group text-sm"
                      >
                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</> : <>Siguiente <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></>}
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
                      <div className="space-y-2">
                        <Label htmlFor="signup-company" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Nombre de la Empresa</Label>
                        <div className="relative">
                          <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" strokeWidth={1.75} />
                          <Input
                            id="signup-company"
                            type="text"
                            placeholder="Ej. Mi Tienda, S.R.L."
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                            className={`${inputCls} ${errors.companyName ? '!border-red-500/60 focus:!border-red-500 focus:ring-red-500/20 focus-visible:border-red-500' : ''}`}
                          />
                        </div>
                        {errors.companyName && <p className="text-[10px] text-red-400">{errors.companyName}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-rnc" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">RNC o Cédula</Label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" strokeWidth={1.75} />
                          <Input
                            id="signup-rnc"
                            type="text"
                            placeholder="Ej. 132456789"
                            value={rnc}
                            onChange={e => setRnc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            className={`${inputCls} ${errors.rnc ? '!border-red-500/60 focus:!border-red-500 focus:ring-red-500/20 focus-visible:border-red-500' : ''}`}
                          />
                        </div>
                        {errors.rnc && <p className="text-[10px] text-red-400">{errors.rnc}</p>}
                      </div>

                      <div className="flex gap-3 mt-6">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handlePrevStep}
                          className="flex-[1] h-12 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl group transition-all"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Atrás
                        </Button>
                        <Button
                          type="button"
                          onClick={handleNextStep}
                          disabled={loading}
                          className="flex-[2] h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold shadow-[0_4px_20px_rgba(16,185,129,0.2)] transition-all rounded-xl group text-sm"
                        >
                          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</> : <>Siguiente <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></>}
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
                          { id: 'store', label: 'Tienda', desc: 'Venta de productos, inventario y clientes', icon: '🛍️' },
                          { id: 'restaurant', label: 'Restaurante', desc: 'Mesas, cocina, pedidos y delivery', icon: '🍽️' },
                          { id: 'supermarket', label: 'Supermercado', desc: 'Gran inventario, categorías y cajas', icon: '🛒' },
                        ].map(type => {
                          const isSelected = selectedBusinessType === type.id;
                          return (
                            <div
                              key={type.id}
                              onClick={() => setSelectedBusinessType(type.id as any)}
                              className={`group cursor-pointer rounded-2xl border p-4 flex items-center gap-5 transition-all duration-300 ${
                                isSelected
                                  ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50'
                                  : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04] hover:shadow-lg hover:-translate-y-0.5'
                                }`}
                            >
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all duration-300 ${
                                isSelected 
                                  ? 'bg-emerald-500/20 scale-110 shadow-inner' 
                                  : 'bg-white/5 group-hover:scale-105 group-hover:bg-white/10'
                              }`}>
                                <span className={isSelected ? 'drop-shadow-lg' : ''}>{type.icon}</span>
                              </div>
                              <div className="flex-1">
                                <div className={`text-[15px] font-bold tracking-wide transition-colors ${isSelected ? 'text-emerald-400' : 'text-slate-200 group-hover:text-white'}`}>{type.label}</div>
                                <div className={`text-[13px] mt-1 transition-colors ${isSelected ? 'text-emerald-400/80' : 'text-slate-500'}`}>{type.desc}</div>
                              </div>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                                isSelected 
                                  ? 'border-emerald-500 bg-emerald-500 scale-110 shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
                                  : 'border-white/10 bg-transparent group-hover:border-white/30'
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-950" strokeWidth={4} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex gap-3 mt-6">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handlePrevStep}
                          className="flex-[1] h-12 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl group transition-all"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Atrás
                        </Button>
                        <Button
                          type="button"
                          onClick={handleNextStep}
                          className="flex-[2] h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold shadow-[0_4px_20px_rgba(16,185,129,0.2)] transition-all rounded-xl group text-sm"
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
                      <div className="space-y-2">
                        <Label htmlFor="signup-password" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Contraseña</Label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" strokeWidth={1.75} />
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
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 hover:bg-transparent text-slate-400 hover:text-slate-200"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4.5 w-4.5" strokeWidth={1.75} /> : <Eye className="h-4.5 w-4.5" strokeWidth={1.75} />}
                          </Button>
                        </div>
                        {errors.password && <p className="text-[10px] text-red-400">{errors.password}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Confirmar Contraseña</Label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" strokeWidth={1.75} />
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
                        {errors.confirmPassword && <p className="text-[10px] text-red-400">{errors.confirmPassword}</p>}
                      </div>

                      <div className="flex gap-3 mt-6">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handlePrevStep}
                          disabled={loading}
                          className="flex-[1] h-12 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl group transition-all"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Atrás
                        </Button>
                        <Button
                          type="submit"
                          disabled={loading}
                          className="flex-[2] h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold transition-all rounded-xl shadow-[0_4px_20px_rgba(16,185,129,0.2)] text-sm"
                        >
                          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : 'Crear Cuenta'}
                        </Button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </TabsContent>
            </Tabs>
            )}
            </motion.div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center mt-6">
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs font-semibold rounded-lg px-4 py-2 group"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Volver al inicio
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
