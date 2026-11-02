import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import type {
  UserRead,
  UserRole,
  RoleInfo,
  Hospital,
  UserCreate,
  UserUpdate,
} from '../../services/types';
import { RoleBadge } from '../../components/auth/RoleBadge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Users,
  UserPlus,
  Search,
  KeyRound,
  Lock,
  Unlock,
  ShieldAlert,
  X,
  Copy,
  Check,
  RotateCw,
  AlertCircle,
  UserCheck,
  UserX,
  Award,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const UsersAdminPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { can, hasRole } = usePermission();

  const isSupervisorOnly = hasRole('SUPERVISOR') && !can('users:manage');
  const canManage = can('users:manage') || can('users:manage_technicians');

  const [users, setUsers] = useState<UserRead[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [rolesInfo, setRolesInfo] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRead | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Estados de formulario de creación
  const [createEmail, setCreateEmail] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createLicense, setCreateLicense] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('TECHNICIAN');
  const [createHospitals, setCreateHospitals] = useState<number[]>([]);
  const [createGlobalScope, setCreateGlobalScope] = useState(false);
  const [createPassword, setCreatePassword] = useState('');
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Estados de formulario de edición
  const [editFullName, setEditFullName] = useState('');
  const [editLicense, setEditLicense] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('TECHNICIAN');
  const [editHospitals, setEditHospitals] = useState<number[]>([]);
  const [editGlobalScope, setEditGlobalScope] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, hierData, rolesData] = await Promise.all([
        apiService.listUsers(),
        apiService.getHierarchy().catch(() => ({ hospitals: [] as Hospital[] })),
        apiService.listRoles().catch(() => [] as RoleInfo[]),
      ]);
      setUsers(usersData);
      setHospitals(hierData.hospitals);
      setRolesInfo(rolesData);
    } catch (err: any) {
      console.error('Error cargando usuarios:', err);
      setError('No se pudo cargar el listado de usuarios del sistema.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lista de hospitales elegibles según alcance del operador
  const eligibleHospitals = isSupervisorOnly
    ? hospitals.filter((h) => currentUser?.hospital_ids.includes(h.id))
    : hospitals;

  // Acciones sobre usuarios
  const handleOpenCreateModal = () => {
    setCreateEmail('');
    setCreateFullName('');
    setCreateLicense('');
    setCreateRole('TECHNICIAN');
    setCreatePassword('');
    // Si es supervisor, preseleccionar su hospital
    if (isSupervisorOnly && eligibleHospitals.length > 0) {
      setCreateHospitals([eligibleHospitals[0].id]);
      setCreateGlobalScope(false);
    } else {
      setCreateHospitals([]);
      setCreateGlobalScope(false);
    }
    setCreateError(null);
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail.trim() || !createFullName.trim()) {
      setCreateError('Nombre completo y email son requeridos.');
      return;
    }

    try {
      setSubmittingCreate(true);
      setCreateError(null);
      const payload: UserCreate = {
        email: createEmail.trim(),
        full_name: createFullName.trim(),
        professional_license: createLicense.trim() || undefined,
        role: isSupervisorOnly ? 'TECHNICIAN' : createRole,
        password: createPassword.trim() || undefined,
        hospital_ids: createGlobalScope ? [] : createHospitals,
        has_global_scope: isSupervisorOnly ? false : createGlobalScope,
      };

      const created = await apiService.createUser(payload);
      setCreateModalOpen(false);

      if (created.temporary_password) {
        setSelectedUser(created);
        setTempPassword(created.temporary_password);
        setResetModalOpen(true);
      }

      await loadData();
    } catch (err: any) {
      console.error('Error creando usuario:', err);
      const detail = err?.response?.data?.detail;
      setCreateError(typeof detail === 'string' ? detail : 'Error al dar de alta el usuario.');
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleOpenEditModal = (targetUser: UserRead) => {
    setSelectedUser(targetUser);
    setEditFullName(targetUser.full_name);
    setEditLicense(targetUser.professional_license || '');
    setEditRole(targetUser.role);
    setEditHospitals(targetUser.hospital_ids || []);
    setEditGlobalScope(targetUser.has_global_scope);
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setSubmittingEdit(true);
      setEditError(null);

      // 1. Actualizar datos básicos y rol
      const updatePayload: UserUpdate = {
        full_name: editFullName.trim(),
        professional_license: editLicense.trim() || undefined,
        role: isSupervisorOnly ? undefined : editRole,
      };
      await apiService.updateUser(selectedUser.id, updatePayload);

      // 2. Actualizar alcance hospitalario
      await apiService.updateUserHospitals(selectedUser.id, {
        hospital_ids: isSupervisorOnly ? editHospitals : (editGlobalScope ? [] : editHospitals),
        has_global_scope: isSupervisorOnly ? false : editGlobalScope,
      });

      setEditModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Error actualizando usuario:', err);
      const detail = err?.response?.data?.detail;
      setEditError(typeof detail === 'string' ? detail : 'Error al guardar los cambios.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleToggleActive = async (targetUser: UserRead) => {
    const actionLabel = targetUser.is_active ? 'desactivar' : 'activar';
    const confirm = window.confirm(`¿Está seguro de que desea ${actionLabel} la cuenta de ${targetUser.full_name}?`);
    if (!confirm) return;

    try {
      if (targetUser.is_active) {
        await apiService.deactivateUser(targetUser.id);
      } else {
        await apiService.activateUser(targetUser.id);
      }
      await loadData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'No se pudo modificar el estado de la cuenta.';
      alert(`Error: ${detail}`);
    }
  };

  const handleResetPassword = async (targetUser: UserRead) => {
    const confirm = window.confirm(
      `¿Desea restablecer la contraseña de ${targetUser.full_name}? Se generará una clave temporal y se invalidarán sus sesiones activas.`
    );
    if (!confirm) return;

    try {
      const res = await apiService.resetPassword(targetUser.id);
      setSelectedUser(targetUser);
      setTempPassword(res.temporary_password);
      setCopiedPass(false);
      setResetModalOpen(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Error al restablecer contraseña.';
      alert(`Error: ${detail}`);
    }
  };

  const handleUnlock = async (targetUser: UserRead) => {
    try {
      await apiService.unlockUser(targetUser.id);
      await loadData();
      alert(`La cuenta de ${targetUser.full_name} ha sido desbloqueada.`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Error al desbloquear usuario.';
      alert(`Error: ${detail}`);
    }
  };

  const handleCopyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  // Filtrado
  const filteredUsers = users.filter((u) => {
    // Filtro por texto
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = u.full_name.toLowerCase().includes(term);
      const matchEmail = u.email.toLowerCase().includes(term);
      const matchLicense = (u.professional_license || '').toLowerCase().includes(term);
      if (!matchName && !matchEmail && !matchLicense) return false;
    }

    // Filtro por rol
    if (roleFilter !== 'ALL' && u.role !== roleFilter) {
      return false;
    }

    // Filtro por estado activo
    if (activeFilter === 'ACTIVE' && !u.is_active) return false;
    if (activeFilter === 'INACTIVE' && u.is_active) return false;

    return true;
  });

  return (
    <div className="flex flex-col gap-5 select-none">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)] m-0 flex items-center gap-2">
            <Users className="w-6 h-6 text-[var(--accent)]" />
            <span>{isSupervisorOnly ? 'Técnicos de mi Hospital' : 'Administración de Usuarios y Accesos'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink-soft)] font-medium mt-0.5 m-0">
            {isSupervisorOnly
              ? 'Gestión y alta de bioingenieros y técnicos asignados a sus establecimientos'
              : 'Control de identidades, roles funcionales, matriz de permisos y alcance hospitalario'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            title="Actualizar"
            variant="outline"
            size="sm"
            onClick={loadData}
            loading={loading}
            icon={<RotateCw className="w-3.5 h-3.5" />}
          />
          {canManage && (
            <Button
              title={isSupervisorOnly ? 'Nuevo Técnico' : 'Crear Usuario'}
              variant="primary"
              size="sm"
              onClick={handleOpenCreateModal}
              icon={<UserPlus className="w-4 h-4" />}
            />
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs: Directorio de Usuarios y Matriz de Permisos */}
      <Tabs.Root defaultValue="users" className="flex flex-col gap-4">
        <Tabs.List className="flex items-center gap-2 border-b border-[var(--border)] pb-1">
          <Tabs.Trigger
            value="users"
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-transparent transition-all cursor-pointer text-[var(--ink-soft)] data-[state=active]:bg-[var(--accent-soft)] data-[state=active]:text-[var(--accent-strong)] data-[state=active]:border-[var(--accent)]/30"
          >
            Directorio de Usuarios ({filteredUsers.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="matrix"
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-transparent transition-all cursor-pointer text-[var(--ink-soft)] data-[state=active]:bg-[var(--accent-soft)] data-[state=active]:text-[var(--accent-strong)] data-[state=active]:border-[var(--accent)]/30"
          >
            Matriz de Roles y Permisos (RBAC)
          </Tabs.Trigger>
        </Tabs.List>

        {/* Tab 1: Listado de usuarios */}
        <Tabs.Content value="users" className="flex flex-col gap-4">
          {/* Barra de Búsqueda y Filtros */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="flex-1 max-w-md relative">
              <Search className="w-4 h-4 text-[var(--ink-faint)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-[var(--surface)] text-[var(--ink)] border border-[var(--border)] text-xs focus:outline-hidden focus:border-[var(--accent)] transition-all"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!isSupervisorOnly && (
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="h-9 px-2.5 rounded-lg bg-[var(--surface)] text-[var(--ink)] border border-[var(--border)] text-xs font-semibold focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Todos los Roles</option>
                  <option value="TECHNICIAN">Técnicos</option>
                  <option value="SUPERVISOR">Supervisores</option>
                  <option value="AUDITOR">Auditores</option>
                  <option value="ADMIN">Administradores</option>
                </select>
              )}

              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as any)}
                className="h-9 px-2.5 rounded-lg bg-[var(--surface)] text-[var(--ink)] border border-[var(--border)] text-xs font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="ACTIVE">Activos</option>
                <option value="INACTIVE">Inactivos</option>
              </select>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          {loading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-2.5 bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
              <div className="w-7 h-7 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[var(--ink-soft)] font-medium">Cargando directorio de usuarios...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)] text-xs text-[var(--ink-soft)]">
              No se encontraron usuarios que coincidan con los filtros seleccionados.
            </div>
          ) : (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-soft)] font-bold">
                      <th className="py-3 px-4">Usuario / Identidad</th>
                      <th className="py-3 px-4">Rol Funcional</th>
                      <th className="py-3 px-4">Alcance Hospitalario</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredUsers.map((u) => {
                      const isSelf = currentUser?.id === u.id;
                      const isLocked = Boolean(u.locked_until && new Date(u.locked_until) > new Date());
                      const userHospitals = hospitals.filter((h) => u.hospital_ids.includes(h.id));

                      return (
                        <tr key={u.id} className="hover:bg-[var(--surface-2)]/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-[var(--ink)] text-sm flex items-center gap-1.5">
                                {u.full_name}
                                {isSelf && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[var(--accent-soft)] text-[var(--accent)]">
                                    Tú
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-[var(--ink-soft)] font-mono">{u.email}</span>
                              {u.professional_license && (
                                <span className="text-[10.5px] text-[var(--ink-faint)] flex items-center gap-1 mt-0.5">
                                  <Award className="w-3 h-3" />
                                  <span>Mat: {u.professional_license}</span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <RoleBadge role={u.role} size="sm" />
                          </td>

                          <td className="py-3 px-4">
                            {u.has_global_scope ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent-strong)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-full">
                                Alcance Global
                              </span>
                            ) : userHospitals.length === 0 ? (
                              <span className="text-[11px] text-[var(--ink-faint)]">Sin asignación</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {userHospitals.map((h) => (
                                  <span
                                    key={h.id}
                                    className="text-[10.5px] font-semibold bg-[var(--surface-2)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[var(--ink-soft)]"
                                    title={h.name}
                                  >
                                    {h.code}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              {u.is_active ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--ok)] bg-[var(--ok-soft)] px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)]" />
                                  Activa
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--ink-faint)] bg-[var(--surface-2)] px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-faint)]" />
                                  Inactiva
                                </span>
                              )}

                              {isLocked && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                  <Lock className="w-3 h-3" />
                                  Bloqueada
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isLocked && (
                                <button
                                  type="button"
                                  onClick={() => handleUnlock(u)}
                                  className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] hover:bg-amber-500/10 hover:border-amber-500/30 text-amber-600 cursor-pointer transition-colors"
                                  title="Desbloquear cuenta bloqueada"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleResetPassword(u)}
                                className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer transition-colors"
                                title="Restablecer contraseña (generar temporal)"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(u)}
                                className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer transition-colors"
                                title="Editar datos y alcance"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>

                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(u)}
                                  className={cn(
                                    'p-1.5 rounded-lg border cursor-pointer transition-colors',
                                    u.is_active
                                      ? 'border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
                                      : 'border-[var(--ok)]/20 bg-[var(--ok-soft)] text-[var(--ok)] hover:bg-[var(--ok-soft)]/80'
                                  )}
                                  title={u.is_active ? 'Desactivar cuenta' : 'Activar cuenta'}
                                >
                                  {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Tabs.Content>

        {/* Tab 2: Matriz RBAC */}
        <Tabs.Content value="matrix" className="flex flex-col gap-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-6">
            <div>
              <h2 className="text-base font-bold text-[var(--ink)] m-0">
                Matriz de Control de Acceso Basado en Roles (RBAC)
              </h2>
              <p className="text-xs text-[var(--ink-soft)] mt-1 m-0">
                Resumen de capacidades y permisos según ISO 7396-1 y perfil institucional.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {rolesInfo.map((r) => (
                <div
                  key={r.role}
                  className="p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <RoleBadge role={r.role as UserRole} size="md" />
                    <span className="font-mono text-[10px] text-[var(--ink-faint)]">
                      {r.permissions.length} perms
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-soft)] leading-snug m-0">{r.description}</p>
                  <div className="pt-2 border-t border-[var(--border)] flex flex-col gap-1 max-h-56 overflow-y-auto scrollbar-thin">
                    {r.permissions.map((p) => (
                      <span key={p} className="text-[10.5px] font-mono text-[var(--ink-soft)] flex items-center gap-1">
                        <Check className="w-3 h-3 text-[var(--ok)] shrink-0" />
                        <span>{p}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {/* Modal 1: Alta de Usuario */}
      <Dialog.Root open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[var(--surface)] text-[var(--ink)] rounded-2xl shadow-2xl border border-[var(--border)] p-6 z-50 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
              <Dialog.Title className="text-base font-bold text-[var(--ink)] m-0">
                {isSupervisorOnly ? 'Alta de Nuevo Técnico de Campo' : 'Crear Nueva Cuenta de Usuario'}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 text-[var(--ink-soft)] hover:text-[var(--ink)] rounded-lg hover:bg-[var(--surface-2)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            {createError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3.5">
              <Input
                label="Nombre Completo"
                value={createFullName}
                onChangeText={setCreateFullName}
                placeholder="Ej: Ing. Laura Gómez"
                required
              />

              <Input
                label="Correo Electrónico Institucional"
                type="email"
                value={createEmail}
                onChangeText={setCreateEmail}
                placeholder="ej: lgomez@gmao.local"
                required
              />

              <Input
                label="Matrícula Profesional / Registro (Opcional)"
                value={createLicense}
                onChangeText={setCreateLicense}
                placeholder="Ej: MP 1284 / COPITEC"
              />

              {!isSupervisorOnly ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[var(--ink)]">Rol Funcional</label>
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as UserRole)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] text-xs font-semibold focus:outline-hidden cursor-pointer"
                  >
                    <option value="TECHNICIAN">Técnico (Inspección y firmas propias)</option>
                    <option value="SUPERVISOR">Supervisor (Control total hospitalario)</option>
                    <option value="AUDITOR">Auditor (Solo lectura y exportación)</option>
                    <option value="ADMIN">Administrador (Control total del sistema)</option>
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] text-xs text-[var(--ink-soft)] flex items-center justify-between">
                  <span>Rol asignado por Supervisor:</span>
                  <RoleBadge role="TECHNICIAN" size="sm" />
                </div>
              )}

              {/* Asignación de Hospitales */}
              {!isSupervisorOnly && (
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--ink)] pt-1">
                  <input
                    type="checkbox"
                    checked={createGlobalScope}
                    onChange={(e) => setCreateGlobalScope(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--accent)]"
                  />
                  <span>Alcance Global (Acceso a todos los hospitales)</span>
                </label>
              )}

              {!createGlobalScope && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-[var(--ink)]">Hospitales Asignados</span>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-2 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
                    {eligibleHospitals.map((h) => {
                      const checked = createHospitals.includes(h.id);
                      return (
                        <label
                          key={h.id}
                          className="flex items-center gap-2 text-xs text-[var(--ink)] cursor-pointer py-1 px-1.5 rounded hover:bg-[var(--surface-3)]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCreateHospitals([...createHospitals, h.id]);
                              } else {
                                setCreateHospitals(createHospitals.filter((id) => id !== h.id));
                              }
                            }}
                            className="w-4 h-4 rounded text-[var(--accent)]"
                          />
                          <span className="font-semibold">{h.name}</span>
                          <span className="text-[10px] text-[var(--ink-faint)] font-mono">({h.code})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <Input
                label="Contraseña Inicial (Opcional, se genera automáticamente si se deja en blanco)"
                type="password"
                value={createPassword}
                onChangeText={setCreatePassword}
                placeholder="Dejar vacío para contraseña temporal segura"
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)] mt-2">
                <Button
                  title="Cancelar"
                  variant="secondary"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={submittingCreate}
                />
                <Button
                  title="Dar de Alta"
                  variant="primary"
                  type="submit"
                  loading={submittingCreate}
                />
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal 2: Edición de Usuario */}
      <Dialog.Root open={editModalOpen} onOpenChange={setEditModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[var(--surface)] text-[var(--ink)] rounded-2xl shadow-2xl border border-[var(--border)] p-6 z-50 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
              <Dialog.Title className="text-base font-bold text-[var(--ink)] m-0">
                Editar Datos de Usuario
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 text-[var(--ink-soft)] hover:text-[var(--ink)] rounded-lg hover:bg-[var(--surface-2)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            {editError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            {selectedUser && (
              <form onSubmit={handleEditSubmit} className="flex flex-col gap-3.5">
                <div className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] text-xs">
                  <span className="text-[var(--ink-faint)]">Correo Electrónico (No editable):</span>
                  <p className="font-mono font-bold text-[var(--ink)] m-0 mt-0.5">{selectedUser.email}</p>
                </div>

                <Input
                  label="Nombre Completo"
                  value={editFullName}
                  onChangeText={setEditFullName}
                  required
                />

                <Input
                  label="Matrícula Profesional / Registro"
                  value={editLicense}
                  onChangeText={setEditLicense}
                  placeholder="Ej: MP 1284"
                />

                {!isSupervisorOnly && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[var(--ink)]">Rol Funcional</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full h-10 px-3 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] text-xs font-semibold focus:outline-hidden cursor-pointer"
                    >
                      <option value="TECHNICIAN">Técnico</option>
                      <option value="SUPERVISOR">Supervisor</option>
                      <option value="AUDITOR">Auditor</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </div>
                )}

                {!isSupervisorOnly && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--ink)] pt-1">
                    <input
                      type="checkbox"
                      checked={editGlobalScope}
                      onChange={(e) => setEditGlobalScope(e.target.checked)}
                      className="w-4 h-4 rounded text-[var(--accent)]"
                    />
                    <span>Alcance Global (Todos los hospitales)</span>
                  </label>
                )}

                {!editGlobalScope && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-[var(--ink)]">Hospitales Asignados</span>
                    <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-2 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
                      {eligibleHospitals.map((h) => {
                        const checked = editHospitals.includes(h.id);
                        return (
                          <label
                            key={h.id}
                            className="flex items-center gap-2 text-xs text-[var(--ink)] cursor-pointer py-1 px-1.5 rounded hover:bg-[var(--surface-3)]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditHospitals([...editHospitals, h.id]);
                                } else {
                                  setEditHospitals(editHospitals.filter((id) => id !== h.id));
                                }
                              }}
                              className="w-4 h-4 rounded text-[var(--accent)]"
                            />
                            <span className="font-semibold">{h.name}</span>
                            <span className="text-[10px] text-[var(--ink-faint)] font-mono">({h.code})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)] mt-2">
                  <Button
                    title="Cancelar"
                    variant="secondary"
                    onClick={() => setEditModalOpen(false)}
                    disabled={submittingEdit}
                  />
                  <Button
                    title="Guardar Cambios"
                    variant="primary"
                    type="submit"
                    loading={submittingEdit}
                  />
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal 3: Notificación de Contraseña Temporal (Reset o Creación) */}
      <Dialog.Root open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[var(--surface)] text-[var(--ink)] rounded-2xl shadow-2xl border border-[var(--border)] p-6 z-50 flex flex-col gap-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border)]">
              <div className="p-2 rounded-xl bg-[var(--ok-soft)] text-[var(--ok)]">
                <KeyRound className="w-5 h-5" />
              </div>
              <Dialog.Title className="text-base font-bold text-[var(--ink)] m-0">
                Contraseña Temporal Generada
              </Dialog.Title>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Atención:</strong> Esta contraseña solo se mostrará una vez. Comuníquela de
                forma segura al usuario ({selectedUser?.full_name}). El sistema le solicitará cambiarla
                en su primer inicio de sesión.
              </span>
            </div>

            <div className="p-3.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl flex items-center justify-between gap-3">
              <span className="font-mono text-base font-bold tracking-wider text-[var(--accent-strong)] select-all">
                {tempPassword}
              </span>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="py-1 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-3)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                {copiedPass ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[var(--ok)]" />
                    <span>Copiada</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border)]">
              <Button
                title="Entendido y Cerrar"
                variant="primary"
                onClick={() => setResetModalOpen(false)}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};
