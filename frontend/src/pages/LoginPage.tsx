import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Activity,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Sun,
  Moon,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const demoAccounts = [
    { label: 'Administrador (Global)', email: 'admin@gmao.local' },
    { label: 'Supervisor (HAC-AO-01)', email: 'supervisor@gmao.local' },
    { label: 'Técnico 1 (HAC-AO-01)', email: 'tecnico@gmao.local' },
    { label: 'Técnico 2 (HAC-AO-01)', email: 'tecnico2@gmao.local' },
    { label: 'Auditor (Global)', email: 'auditor@gmao.local' },
  ];

  const handleSelectDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Demo2026!');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Por favor ingrese su correo electrónico y contraseña.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const user = await login(email.trim(), password);

      if (user.must_change_password) {
        navigate('/change-password', { replace: true });
        return;
      }

      const next = searchParams.get('next');
      const target = next ? decodeURIComponent(next) : '/dashboard';
      navigate(target, { replace: true });
    } catch (err: any) {
      console.error('Error de login:', err);
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;

      if (status === 423 || (detail && typeof detail === 'string' && detail.includes('bloqueada'))) {
        setErrorMessage(
          detail || 'Su cuenta ha sido bloqueada temporalmente por exceso de intentos fallidos (15 min).'
        );
      } else if (status === 401) {
        setErrorMessage('Credenciales inválidas. Verifique su email y contraseña.');
      } else if (err.code === 'ECONNABORTED' || !err.response) {
        setErrorMessage('No se pudo establecer conexión con el servidor. Verifique su red.');
      } else {
        setErrorMessage(
          typeof detail === 'string' ? detail : 'Ocurrió un error al iniciar sesión. Inténtelo nuevamente.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--surface-2)] flex flex-col justify-between p-4 sm:p-6 transition-colors select-none">
      {/* Barra superior con selector de tema */}
      <div className="flex justify-between items-center max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white shadow-xs">
            <Activity className="w-4.5 h-4.5" />
          </div>
          <span className="font-bold text-sm tracking-tight text-[var(--ink)]">
            GMAO Gases Medicinales
          </span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-3)] cursor-pointer transition-all flex items-center gap-2 text-xs font-semibold"
          title={`Cambiar a ${theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-[var(--accent)]" />
          )}
          <span className="hidden sm:inline">
            {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
          </span>
        </button>
      </div>

      {/* Contenedor Central */}
      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col gap-6">
          {/* Header del Formulario */}
          <div className="flex flex-col gap-1.5 text-center">
            <div className="inline-flex w-12 h-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)] m-0">
              Control de Acceso Seguro
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-soft)] font-medium m-0">
              Plataforma de inspección técnica hospitalaria y verificación normativa
            </p>
          </div>

          {/* Mensaje de Error */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1 leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-email"
                className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
                <span>Correo Electrónico Institucional</span>
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ej: usuario@gmao.local"
                required
                autoComplete="username"
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] text-sm focus:outline-hidden focus:border-[var(--accent)] transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-password"
                className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
                <span>Contraseña</span>
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] text-sm focus:outline-hidden focus:border-[var(--accent)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)] p-1 rounded-md cursor-pointer transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              title="Iniciar Sesión"
              variant="primary"
              className="w-full h-11 mt-2 text-sm font-bold shadow-md cursor-pointer"
              loading={loading}
              icon={<ArrowRight className="w-4 h-4" />}
            />
          </form>

          {/* Cuentas de demostración rápida */}
          <div className="pt-4 border-t border-[var(--border)] flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] text-center">
              Cuentas de demostración (Desarrollo)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleSelectDemo(acc.email)}
                  className="py-1.5 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-left cursor-pointer transition-all text-xs flex flex-col"
                >
                  <span className="font-bold text-[var(--ink)]">{acc.label}</span>
                  <span className="text-[10px] text-[var(--ink-faint)] font-mono">{acc.email}</span>
                </button>
              ))}
            </div>
            <p className="text-[10.5px] text-center text-[var(--ink-faint)] m-0">
              Clave demo por defecto: <code className="font-mono font-bold">Demo2026!</code>
            </p>
          </div>
        </div>
      </div>

      {/* Footer Normativo */}
      <footer className="text-center text-xs text-[var(--ink-faint)] max-w-4xl w-full mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 pt-4">
        <span>GMAO Gases Medicinales · Grupo 19 · Taller de Bioingeniería</span>
        <span>Conforme a ISO 7396-1:2016 y Res. MSAL 1130/2000</span>
      </footer>
    </div>
  );
};
