import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import {
  KeyRound,
  ShieldAlert,
  Check,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshSession } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isMustChange = Boolean(user?.must_change_password);

  // Validaciones de la política de seguridad
  const hasMinLength = newPassword.length >= 10;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isDifferentFromEmail =
    !user?.email || newPassword.toLowerCase() !== user.email.toLowerCase();
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid =
    currentPassword.length > 0 &&
    hasMinLength &&
    hasLetter &&
    hasNumber &&
    isDifferentFromEmail &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    try {
      setLoading(true);
      setError(null);
      await apiService.changePassword(currentPassword, newPassword);
      setSuccess(true);
      await refreshSession();

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
    } catch (err: any) {
      console.error('Error cambiando contraseña:', err);
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : 'No se pudo actualizar la contraseña. Verifique que su contraseña actual sea correcta.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-6 px-4 select-none">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col gap-6">
        {/* Cabecera */}
        <div className="flex items-start gap-4 pb-4 border-b border-[var(--border)]">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--ink)] m-0">
              {isMustChange ? 'Actualización Obligatoria de Contraseña' : 'Cambiar Contraseña'}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--ink-soft)] font-medium mt-1 m-0">
              {isMustChange
                ? 'Por requerimiento de seguridad clínica, debe definir una contraseña personal en su primer acceso.'
                : 'Actualice su clave de acceso para resguardar la firma técnica de sus auditorías.'}
            </p>
          </div>
        </div>

        {/* Banner informativo de primer login */}
        {isMustChange && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">
              Esta cuenta posee una contraseña temporal provista por el administrador. Ingrese una
              nueva clave segura que cumpla con los estándares normativos.
            </span>
          </div>
        )}

        {/* Mensaje de éxito */}
        {success && (
          <div className="p-4 bg-[var(--ok-soft)] border border-[var(--ok)]/30 text-[var(--ok)] rounded-xl text-xs font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <span>¡Contraseña actualizada exitosamente! Redirigiendo al panel principal...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Contraseña actual */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[var(--ink)]">
              Contraseña Actual o Temporal
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Ingrese su clave actual"
                required
                className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] text-sm focus:outline-hidden focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)] p-1 rounded-md cursor-pointer"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Nueva contraseña */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[var(--ink)]">Nueva Contraseña</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 10 caracteres alfanuméricos"
                required
                className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] text-sm focus:outline-hidden focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)] p-1 rounded-md cursor-pointer"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirmar nueva contraseña */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[var(--ink)]">
              Confirmar Nueva Contraseña
            </label>
            <input
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita la nueva contraseña"
              required
              className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] text-sm focus:outline-hidden focus:border-[var(--accent)]"
            />
          </div>

          {/* Indicador de requisitos normativos */}
          <div className="p-3.5 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
              Política de Seguridad de Contraseñas
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div
                className={`flex items-center gap-2 ${
                  hasMinLength ? 'text-[var(--ok)] font-semibold' : 'text-[var(--ink-faint)]'
                }`}
              >
                {hasMinLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                <span>Mínimo 10 caracteres</span>
              </div>
              <div
                className={`flex items-center gap-2 ${
                  hasLetter ? 'text-[var(--ok)] font-semibold' : 'text-[var(--ink-faint)]'
                }`}
              >
                {hasLetter ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                <span>Al menos una letra</span>
              </div>
              <div
                className={`flex items-center gap-2 ${
                  hasNumber ? 'text-[var(--ok)] font-semibold' : 'text-[var(--ink-faint)]'
                }`}
              >
                {hasNumber ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                <span>Al menos un número</span>
              </div>
              <div
                className={`flex items-center gap-2 ${
                  passwordsMatch ? 'text-[var(--ok)] font-semibold' : 'text-[var(--ink-faint)]'
                }`}
              >
                {passwordsMatch ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                <span>Contraseñas coinciden</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
            {!isMustChange && (
              <Button
                type="button"
                title="Cancelar"
                variant="secondary"
                onClick={() => navigate('/dashboard')}
                disabled={loading}
              />
            )}
            <Button
              type="submit"
              title="Guardar Nueva Contraseña"
              variant="primary"
              loading={loading}
              disabled={!isFormValid || loading}
              icon={<ArrowRight className="w-4 h-4" />}
            />
          </div>
        </form>
      </div>
    </div>
  );
};
