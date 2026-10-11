import React, { useState, useEffect, useCallback } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import {
  BellRing,
  Send,
  Mail,
  Sliders,
  History,
  Plus,
  Trash2,
  Play,
  RotateCw,
  Settings,
  Volume2,
  VolumeX,
  X,
  AlertTriangle,
} from 'lucide-react';
import { apiService } from '../services/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { AlertSeverityBadge } from '../components/alerts/AlertSeverityBadge';
import { formatRelativeTime } from '../utils/date';
import type {
  NotificationChannel,
  AlertRule,
  NotificationDelivery,
  AlertSeverity,
  ChannelType,
} from '../services/types';

export const NotificationSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('channels');

  // Canales
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState<boolean>(true);
  const [testingChannelId, setTestingChannelId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; msg: string; success: boolean } | null>(null);

  // Modal Canal (Crear / Editar)
  const [channelModalOpen, setChannelModalOpen] = useState<boolean>(false);
  const [channelName, setChannelName] = useState<string>('');
  const [channelType, setChannelType] = useState<ChannelType>('EMAIL');
  const [channelTarget, setChannelTarget] = useState<string>('');
  const [channelMinSev, setChannelMinSev] = useState<AlertSeverity>('HIGH');
  const [channelSecret, setChannelSecret] = useState<string>('');
  const [savingChannel, setSavingChannel] = useState<boolean>(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  // Reglas
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loadingRules, setLoadingRules] = useState<boolean>(true);
  const [updatingRuleCode, setUpdatingRuleCode] = useState<string | null>(null);

  // Bitácora de Envíos
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState<boolean>(true);

  // Preferencias locales
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    localStorage.getItem('gmao.alerts.soundEnabled') === 'true'
  );
  const [operatorName, setOperatorName] = useState<string>(
    localStorage.getItem('gmao.inspectorName') || 'Bioing. Santiago'
  );

  const loadChannels = useCallback(async () => {
    try {
      setLoadingChannels(true);
      const data = await apiService.getChannels();
      setChannels(data);
    } catch (err) {
      console.error('Error cargando canales:', err);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const loadRules = useCallback(async () => {
    try {
      setLoadingRules(true);
      const data = await apiService.getAlertRules();
      setRules(data);
    } catch (err) {
      console.error('Error cargando reglas:', err);
    } finally {
      setLoadingRules(false);
    }
  }, []);

  const loadDeliveries = useCallback(async () => {
    try {
      setLoadingDeliveries(true);
      const data = await apiService.getDeliveries({ limit: 50 });
      setDeliveries(data);
    } catch (err) {
      console.error('Error cargando bitácora de envíos:', err);
    } finally {
      setLoadingDeliveries(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
    loadRules();
    loadDeliveries();
  }, [loadChannels, loadRules, loadDeliveries]);

  // Probar canal
  const handleTestChannel = async (channelId: number) => {
    try {
      setTestingChannelId(channelId);
      setTestResult(null);
      const delivery = await apiService.testChannel(channelId);
      setTestResult({
        id: channelId,
        msg: `Prueba completada (${delivery.status}). ${delivery.error || ''}`,
        success: delivery.status === 'SENT',
      });
      loadDeliveries();
    } catch (err: any) {
      setTestResult({
        id: channelId,
        msg: err?.response?.data?.detail || 'Fallo al ejecutar la prueba de notificación.',
        success: false,
      });
    } finally {
      setTestingChannelId(null);
    }
  };

  // Crear nuevo canal
  const handleCreateChannel = async () => {
    if (!channelName.trim() || !channelTarget.trim()) {
      setChannelError('El nombre y el destino del canal son obligatorios.');
      return;
    }

    try {
      setSavingChannel(true);
      setChannelError(null);
      await apiService.createChannel({
        name: channelName.trim(),
        channel_type: channelType,
        target: channelTarget.trim(),
        min_severity: channelMinSev,
        secret: channelSecret.trim() || undefined,
        is_active: true,
      });
      setChannelModalOpen(false);
      setChannelName('');
      setChannelTarget('');
      setChannelSecret('');
      loadChannels();
    } catch (err: any) {
      setChannelError(err?.response?.data?.detail || 'Error al crear el canal de notificación.');
    } finally {
      setSavingChannel(false);
    }
  };

  // Eliminar canal
  const handleDeleteChannel = async (id: number) => {
    if (!confirm('¿Desea dar de baja este canal de notificación?')) return;
    try {
      await apiService.deleteChannel(id);
      loadChannels();
    } catch (err) {
      console.error('Error eliminando canal:', err);
    }
  };

  // Toggle regla
  const handleToggleRule = async (rule: AlertRule) => {
    try {
      setUpdatingRuleCode(rule.rule_code);
      await apiService.updateAlertRule(rule.rule_code, {
        is_enabled: !rule.is_enabled,
      });
      loadRules();
    } catch (err) {
      console.error('Error actualizando regla:', err);
    } finally {
      setUpdatingRuleCode(null);
    }
  };

  // Toggle notify_external en regla
  const handleToggleRuleExternal = async (rule: AlertRule) => {
    try {
      setUpdatingRuleCode(rule.rule_code);
      await apiService.updateAlertRule(rule.rule_code, {
        notify_external: !rule.notify_external,
      });
      loadRules();
    } catch (err) {
      console.error('Error actualizando regla externa:', err);
    } finally {
      setUpdatingRuleCode(null);
    }
  };

  // Guardar preferencias locales
  const handleSavePreferences = () => {
    localStorage.setItem('gmao.alerts.soundEnabled', String(soundEnabled));
    localStorage.setItem('gmao.inspectorName', operatorName.trim());
    alert('Preferencias locales guardadas correctamente.');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--ink)] tracking-tight m-0 flex items-center gap-2">
            <BellRing className="w-6 h-6 text-[var(--accent)]" />
            Configuración de Notificaciones y Reglas
          </h2>
          <p className="text-xs sm:text-sm text-[var(--ink-soft)] font-medium mt-1 mb-0">
            Administración de canales de despacho, catálogo de reglas normativas y bitácora técnica de envíos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            title="Nuevo Canal"
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setChannelError(null);
              setChannelModalOpen(true);
            }}
          />
        </div>
      </div>

      {/* Tabs Radix */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-5">
        <Tabs.List className="flex items-center gap-2 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] overflow-x-auto">
          <Tabs.Trigger
            value="channels"
            className={`py-2 px-4 rounded-lg text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center gap-2 whitespace-nowrap select-none ${
              activeTab === 'channels'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            <Send className="w-4 h-4 text-[var(--accent)]" />
            <span>Canales de Despacho ({channels.length})</span>
          </Tabs.Trigger>

          <Tabs.Trigger
            value="rules"
            className={`py-2 px-4 rounded-lg text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center gap-2 whitespace-nowrap select-none ${
              activeTab === 'rules'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            <Sliders className="w-4 h-4 text-[var(--accent)]" />
            <span>Catálogo de Reglas ({rules.length})</span>
          </Tabs.Trigger>

          <Tabs.Trigger
            value="deliveries"
            className={`py-2 px-4 rounded-lg text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center gap-2 whitespace-nowrap select-none ${
              activeTab === 'deliveries'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            <History className="w-4 h-4 text-[var(--accent)]" />
            <span>Bitácora de Envíos</span>
          </Tabs.Trigger>

          <Tabs.Trigger
            value="preferences"
            className={`py-2 px-4 rounded-lg text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center gap-2 whitespace-nowrap select-none ${
              activeTab === 'preferences'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            <Settings className="w-4 h-4 text-[var(--accent)]" />
            <span>Preferencias del Dispositivo</span>
          </Tabs.Trigger>
        </Tabs.List>

        {/* Tab 1: Canales */}
        <Tabs.Content value="channels" className="flex flex-col gap-4">
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                testResult.success
                  ? 'bg-[var(--ok-soft)] border-[var(--ok)]/30 text-[var(--ok)]'
                  : 'bg-[var(--danger-soft)] border-[var(--danger)]/30 text-[var(--danger)]'
              }`}
            >
              <span>{testResult.msg}</span>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="p-1 hover:opacity-70 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {loadingChannels ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[var(--ink-soft)]">Cargando canales configurados...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {channels.map((ch) => {
                const isTesting = testingChannelId === ch.id;
                const isEmail = ch.channel_type === 'EMAIL';
                const isWebhook = ch.channel_type === 'WEBHOOK';

                return (
                  <Card key={ch.id} className="p-4 flex flex-col justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isEmail ? (
                            <Mail className="w-4 h-4 text-[var(--accent)]" />
                          ) : isWebhook ? (
                            <Send className="w-4 h-4 text-[var(--accent)]" />
                          ) : (
                            <BellRing className="w-4 h-4 text-[var(--accent)]" />
                          )}
                          <h4 className="text-sm font-bold text-[var(--ink)] m-0">{ch.name}</h4>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ch.is_active
                                ? 'bg-[var(--ok-soft)] text-[var(--ok)]'
                                : 'bg-[var(--surface-2)] text-[var(--ink-faint)]'
                            }`}
                          >
                            {ch.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--ink-faint)]">Tipo:</span>
                          <span className="font-bold text-[var(--ink)]">{ch.channel_type}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--ink-faint)]">Destino:</span>
                          <span className="font-mono text-[var(--ink)] truncate max-w-[200px]">
                            {ch.target}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--ink-faint)]">Severidad Mínima:</span>
                          <AlertSeverityBadge severity={ch.min_severity} size="sm" />
                        </div>
                        {ch.has_secret && (
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--ink-faint)]">Firma HMAC:</span>
                            <span className="font-bold text-[var(--ok)]">Configurada</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                      {ch.channel_type !== 'IN_APP' ? (
                        <button
                          type="button"
                          onClick={() => handleTestChannel(ch.id)}
                          disabled={isTesting}
                          className="text-xs font-bold text-[var(--accent)] hover:text-[var(--accent-strong)] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>{isTesting ? 'Enviando...' : 'Enviar Prueba'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[var(--ink-faint)] italic">
                          Canal del sistema
                        </span>
                      )}

                      {ch.channel_type !== 'IN_APP' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteChannel(ch.id)}
                          className="p-1 text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded-lg cursor-pointer transition-colors"
                          title="Eliminar canal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Tabs.Content>

        {/* Tab 2: Reglas */}
        <Tabs.Content value="rules" className="flex flex-col gap-4">
          {loadingRules ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[var(--ink-soft)]">Cargando catálogo de reglas...</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-xs text-[var(--ink)]">
                <thead className="bg-[var(--surface-2)] border-b border-[var(--border)] font-bold uppercase text-[10px] text-[var(--ink-faint)]">
                  <tr>
                    <th className="p-3">Código</th>
                    <th className="p-3">Nombre y Descripción</th>
                    <th className="p-3">Severidad</th>
                    <th className="p-3 text-center">Notif. Externa</th>
                    <th className="p-3 text-center">Escalamiento</th>
                    <th className="p-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rules.map((rule) => {
                    const isUpdating = updatingRuleCode === rule.rule_code;
                    return (
                      <tr key={rule.rule_code} className="hover:bg-[var(--surface-2)]/60">
                        <td className="p-3 font-mono font-bold text-[var(--accent)]">
                          {rule.rule_code}
                        </td>
                        <td className="p-3 max-w-xs">
                          <span className="font-bold block text-[var(--ink)]">{rule.name}</span>
                          <span className="text-[11px] text-[var(--ink-soft)] line-clamp-1">
                            {rule.description || '—'}
                          </span>
                        </td>
                        <td className="p-3">
                          <AlertSeverityBadge
                            severity={rule.effective_severity || rule.severity_override || 'MEDIUM'}
                            size="sm"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleRuleExternal(rule)}
                            disabled={isUpdating}
                            className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-colors ${
                              rule.notify_external
                                ? 'bg-[var(--ok-soft)] text-[var(--ok)]'
                                : 'bg-[var(--surface-2)] text-[var(--ink-faint)]'
                            }`}
                          >
                            {rule.notify_external ? 'Email/Webhook' : 'Solo In-App'}
                          </button>
                        </td>
                        <td className="p-3 text-center font-mono">
                          {rule.escalate_after_minutes ? `${rule.escalate_after_minutes} min` : '—'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleRule(rule)}
                            disabled={isUpdating}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                              rule.is_enabled
                                ? 'bg-[var(--ok)] text-white hover:opacity-90'
                                : 'bg-[var(--surface-2)] text-[var(--ink-soft)] hover:bg-[var(--border)]'
                            }`}
                          >
                            {rule.is_enabled ? 'Habilitada' : 'Inactiva'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Content>

        {/* Tab 3: Bitácora de Envíos */}
        <Tabs.Content value="deliveries" className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[var(--ink-faint)]">
              Últimos despachos de alertas (In-App, Email, Webhook)
            </span>
            <Button
              title="Refrescar"
              variant="secondary"
              size="sm"
              icon={<RotateCw className="w-3.5 h-3.5" />}
              onClick={loadDeliveries}
              loading={loadingDeliveries}
            />
          </div>

          {loadingDeliveries ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[var(--ink-soft)]">Cargando bitácora...</span>
            </div>
          ) : deliveries.length === 0 ? (
            <Card className="p-8 text-center text-xs text-[var(--ink-soft)]">
              No existen envíos registrados en la bitácora todavía.
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-xs text-[var(--ink)]">
                <thead className="bg-[var(--surface-2)] border-b border-[var(--border)] font-bold uppercase text-[10px] text-[var(--ink-faint)]">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Alerta</th>
                    <th className="p-3">Canal</th>
                    <th className="p-3">Destino</th>
                    <th className="p-3">Evento</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Error / Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono">
                  {deliveries.map((d) => (
                    <tr key={d.id} className="hover:bg-[var(--surface-2)]/60 text-[11.5px]">
                      <td className="p-3 text-[var(--ink-faint)]">
                        {formatRelativeTime(d.sent_at || d.created_at)}
                      </td>
                      <td className="p-3 font-bold text-[var(--accent)]">#{d.alert_id}</td>
                      <td className="p-3 font-bold">{d.channel_type}</td>
                      <td className="p-3 max-w-[200px] truncate" title={d.target}>
                        {d.target}
                      </td>
                      <td className="p-3">{d.event}</td>
                      <td className="p-3">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            d.status === 'SENT'
                              ? 'bg-[var(--ok-soft)] text-[var(--ok)]'
                              : d.status === 'FAILED'
                              ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                              : 'bg-[var(--surface-2)] text-[var(--ink-faint)]'
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="p-3 text-[var(--ink-soft)] max-w-xs truncate">
                        {d.error || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Content>

        {/* Tab 4: Preferencias del Dispositivo */}
        <Tabs.Content value="preferences" className="flex flex-col gap-4 max-w-lg">
          <Card className="p-5 flex flex-col gap-4">
            <h4 className="text-sm font-bold text-[var(--ink)] m-0">
              Preferencias Locales de Alerta
            </h4>

            <div className="flex flex-col gap-3">
              <Input
                label="Nombre del Auditor / Bioingeniero Operador"
                value={operatorName}
                onChangeText={setOperatorName}
                placeholder="Ej: Bioing. Juan Pérez"
              />

              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  {soundEnabled ? (
                    <Volume2 className="w-5 h-5 text-[var(--accent)]" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-[var(--ink-faint)]" />
                  )}
                  <div>
                    <span className="text-xs font-bold text-[var(--ink)] block">
                      Sonido en Alertas Críticas
                    </span>
                    <span className="text-[11px] text-[var(--ink-soft)]">
                      Emite un aviso audible breve cuando se detecta una falla crítica.
                    </span>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button title="Guardar Preferencias" variant="primary" onClick={handleSavePreferences} />
            </div>
          </Card>
        </Tabs.Content>
      </Tabs.Root>

      {/* Modal de Creación de Canal */}
      <Dialog.Root open={channelModalOpen} onOpenChange={setChannelModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[var(--surface)] text-[var(--ink)] rounded-2xl shadow-2xl border border-[var(--border)] p-6 z-50 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
              <Dialog.Title className="text-base font-bold text-[var(--ink)] m-0">
                Nuevo Canal de Notificación
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

            {channelError && (
              <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-xl text-xs text-[var(--danger)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{channelError}</span>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Input
                label="Nombre Identificatorio"
                value={channelName}
                onChangeText={setChannelName}
                placeholder="Ej: Jefatura de Mantenimiento Hospitalario"
              />

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[var(--ink)]">Tipo de Canal</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannelType('EMAIL')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border cursor-pointer ${
                      channelType === 'EMAIL'
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--surface-2)] text-[var(--ink-soft)] border-[var(--border)]'
                    }`}
                  >
                    Correo SMTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannelType('WEBHOOK')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border cursor-pointer ${
                      channelType === 'WEBHOOK'
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--surface-2)] text-[var(--ink-soft)] border-[var(--border)]'
                    }`}
                  >
                    Webhook HTTP(S)
                  </button>
                </div>
              </div>

              <Input
                label={channelType === 'EMAIL' ? 'Dirección de Correo Electrónico' : 'URL Endpoint'}
                value={channelTarget}
                onChangeText={setChannelTarget}
                placeholder={
                  channelType === 'EMAIL'
                    ? 'ej: bioingenieria@hospital.gob.ar'
                    : 'https://webhook.site/...'
                }
              />

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[var(--ink)]">
                  Severidad Mínima para Disparar
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CRITICAL', 'HIGH', 'MEDIUM'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setChannelMinSev(sev)}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg border cursor-pointer ${
                        channelMinSev === sev
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--surface-2)] text-[var(--ink-soft)] border-[var(--border)]'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {channelType === 'WEBHOOK' && (
                <Input
                  label="Secreto HMAC-SHA256 (Opcional)"
                  value={channelSecret}
                  onChangeText={setChannelSecret}
                  placeholder="Clave para firma X-GMAO-Signature"
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button
                title="Cancelar"
                variant="secondary"
                onClick={() => setChannelModalOpen(false)}
                disabled={savingChannel}
              />
              <Button
                title="Guardar Canal"
                variant="primary"
                onClick={handleCreateChannel}
                loading={savingChannel}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};
