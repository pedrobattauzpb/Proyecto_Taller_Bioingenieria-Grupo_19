import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from '../components/auth/RoleBadge';
import { apiService } from '../services/api';
import type { Hospital } from '../services/types';
import {
  User,
  Mail,
  Award,
  Building2,
  KeyRound,
  LogOut,
  ShieldCheck,
  Globe2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, permissions, logout } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        setLoadingHospitals(true);
        const res = await apiService.getHierarchy();
        setHospitals(res.hospitals);
      } catch (err) {
        console.warn('No se pudo cargar la lista de hospitales para el perfil:', err);
      } finally {
        setLoadingHospitals(false);
      }
    };
    fetchHospitals();
  }, []);

  if (!user) return null;

  const assignedHospitals = user.has_global_scope
    ? hospitals
    : hospitals.filter((h) => user.hospital_ids.includes(h.id));

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 flex flex-col gap-6 select-none">
      {/* Cabecera de Identidad */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center font-bold text-2xl shadow-md">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)] m-0">
                {user.full_name}
              </h1>
              <RoleBadge role={user.role} size="md" />
            </div>
            <p className="text-xs sm:text-sm text-[var(--ink-soft)] font-medium mt-1 m-0">
              {user.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <Button
            title="Cerrar Sesión"
            variant="danger"
            onClick={logout}
            icon={<LogOut className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Tarjetas de Datos del Perfil y Alcance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Información Profesional */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
            <User className="w-4 h-4 text-[var(--accent)]" />
            <span className="font-bold text-sm text-[var(--ink)]">Datos Profesionales</span>
          </div>

          <div className="flex flex-col gap-3 text-xs">
            <div>
              <span className="text-[var(--ink-faint)] font-medium">Nombre Completo:</span>
              <p className="text-[var(--ink)] font-semibold text-sm m-0 mt-0.5">{user.full_name}</p>
            </div>

            <div>
              <span className="text-[var(--ink-faint)] font-medium">Correo Electrónico:</span>
              <p className="text-[var(--ink)] font-semibold text-sm m-0 mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
                <span>{user.email}</span>
              </p>
            </div>

            <div>
              <span className="text-[var(--ink-faint)] font-medium">Matrícula Profesional / Registro:</span>
              <p className="text-[var(--ink)] font-semibold text-sm m-0 mt-0.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
                <span>{user.professional_license || 'No especificada'}</span>
              </p>
            </div>

            <div>
              <span className="text-[var(--ink-faint)] font-medium">Estado de la Cuenta:</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--ok)] bg-[var(--ok-soft)] px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)] animate-pulse" />
                  Activa y Verificada
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border)] mt-auto">
            <Button
              title="Actualizar Contraseña"
              variant="outline"
              size="sm"
              className="w-full text-xs"
              icon={<KeyRound className="w-3.5 h-3.5" />}
              onClick={() => navigate('/change-password')}
            />
          </div>
        </div>

        {/* Alcance Hospitalario y Permisos */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
            <Building2 className="w-4 h-4 text-[var(--accent)]" />
            <span className="font-bold text-sm text-[var(--ink)]">Alcance Hospitalario</span>
          </div>

          <div className="flex flex-col gap-2.5 text-xs">
            {user.has_global_scope ? (
              <div className="p-3 bg-[var(--accent-soft)] border border-[var(--accent)]/30 rounded-xl flex items-start gap-2.5">
                <Globe2 className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[var(--accent-strong)] text-xs m-0">
                    Alcance Institucional Global
                  </p>
                  <p className="text-[11px] text-[var(--ink-soft)] m-0 mt-0.5">
                    Tiene acceso a todos los hospitales y sectores del sistema de gases medicinales.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <span className="text-[var(--ink-faint)] font-medium">Hospitales Asignados:</span>
                {loadingHospitals ? (
                  <p className="text-xs text-[var(--ink-soft)] mt-1">Cargando hospitales...</p>
                ) : assignedHospitals.length === 0 ? (
                  <p className="text-xs text-[var(--ink-soft)] mt-1">Sin hospitales asignados.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 mt-1.5">
                    {assignedHospitals.map((h) => (
                      <div
                        key={h.id}
                        className="p-2.5 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] flex items-center justify-between"
                      >
                        <span className="font-semibold text-[var(--ink)]">{h.name}</span>
                        <span className="font-mono text-[10px] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                          {h.code}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[var(--border)] mt-auto flex items-center justify-between text-xs text-[var(--ink-soft)]">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--ok)]" />
              <span>{permissions.length} permisos activos</span>
            </span>
            <span className="font-mono text-[10px] text-[var(--ink-faint)]">RBAC v1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
