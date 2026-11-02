import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios';
import { authStorage } from './authStorage';
import type {
  HierarchyTreeResponse,
  ChecklistTemplate,
  InspectionDetail,
  StatsOverviewResponse,
  InspectionHistoryItem,
  CreateInspectionPayload,
  BatchResponsesPayload,
  CompleteInspectionPayload,
  AssetType,
  InspectionStatus,
  ComplianceSummary,
  NormativeReference,
  NormativeCurrencyReport,
  AuditLogEntry,
  InspectionEvidence,
  ExecutiveReportData,
  Alert,
  AlertDetail,
  AlertListResponse,
  AlertSummary,
  NotificationChannel,
  AlertRule,
  NotificationDelivery,
  AlertSeverity,
  ChannelType,
  DeliveryStatus,
  CurrentUser,
  LoginResponse,
  TokenPair,
  StreamTicketResponse,
  UserRead,
  UserCreate,
  UserUpdate,
  UserHospitalsUpdate,
  PasswordResetResponse,
  RoleInfo,
  UserRole,
} from './types';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const resolveMediaUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const base = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${base}${cleanUrl}`;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// Interceptores de Autenticación y Single-Flight Auto-Refresh (OE-6)
// ============================================================================

// Interceptor de Request: inyecta Bearer token desde memoria
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = authStorage.getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Variables para control de concurrencia en refresco (Single-Flight)
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor de Response: detección de 401 y reintento con refresh rotativo
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const requestUrl = originalRequest.url || '';

    // Si es un endpoint de autenticación que falló (login, refresh, logout), no reintentar
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/logout');

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Encolar solicitud hasta que finalice el refresco actual
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = await authStorage.getRefreshToken();
        if (!storedRefreshToken) {
          throw new Error('No refresh token available');
        }

        // Llamada directa sin interceptor para evitar bucles
        const refreshResponse = await axios.post<TokenPair>(
          `${API_BASE_URL}/auth/refresh`,
          { refresh_token: storedRefreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const { access_token, refresh_token: newRefreshToken } = refreshResponse.data;
        authStorage.setAccessToken(access_token);
        await authStorage.setRefreshToken(newRefreshToken);

        processQueue(null, access_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await authStorage.clearTokens();
        // Notificar cierre de sesión por token vencido/inválido
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('gmao:unauthorized'));
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    if (status === 403) {
      console.warn('[API HTTP 403 Forbidden]: Permisos insuficientes para la acción.');
    }

    if (error.response) {
      console.error(
        `[API HTTP ${error.response.status}]:`,
        error.response.data
      );
    } else if (error.code === 'ECONNABORTED') {
      console.error('[API Timeout]: La solicitud excedió el tiempo límite de conexión.');
    } else if (error.request) {
      console.error('[API Network Error]: No se pudo conectar con el servidor backend.');
    }

    return Promise.reject(error);
  }
);

export const apiService = {
  // ==========================================================================
  // Autenticación y Credenciales (OE-6)
  // ==========================================================================

  async login(username: string, password: string): Promise<LoginResponse> {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    const response = await apiClient.post<LoginResponse>('/auth/login', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = response.data;
    authStorage.setAccessToken(data.access_token);
    await authStorage.setRefreshToken(data.refresh_token);

    return data;
  },

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const response = await apiClient.post<TokenPair>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    const data = response.data;
    authStorage.setAccessToken(data.access_token);
    await authStorage.setRefreshToken(data.refresh_token);
    return data;
  },

  async logout(refreshToken?: string): Promise<void> {
    const token = refreshToken || (await authStorage.getRefreshToken());
    try {
      if (token) {
        await apiClient.post('/auth/logout', { refresh_token: token });
      }
    } catch (err) {
      console.warn('[apiService.logout] Error revocando sesión en servidor:', err);
    } finally {
      await authStorage.clearTokens();
    }
  },

  async getCurrentUser(): Promise<CurrentUser> {
    const response = await apiClient.get<CurrentUser>('/auth/me');
    return response.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.put('/auth/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  async getStreamTicket(): Promise<StreamTicketResponse> {
    const response = await apiClient.post<StreamTicketResponse>('/auth/stream-ticket');
    return response.data;
  },

  // ==========================================================================
  // Gestión de Usuarios y Roles (OE-6)
  // ==========================================================================

  async listUsers(params?: {
    role?: UserRole;
    is_active?: boolean;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserRead[]> {
    const response = await apiClient.get<UserRead[]>('/users', { params });
    return response.data;
  },

  async createUser(payload: UserCreate): Promise<UserRead> {
    const response = await apiClient.post<UserRead>('/users', payload);
    return response.data;
  },

  async getUser(id: number): Promise<UserRead> {
    const response = await apiClient.get<UserRead>(`/users/${id}`);
    return response.data;
  },

  async updateUser(id: number, payload: UserUpdate): Promise<UserRead> {
    const response = await apiClient.patch<UserRead>(`/users/${id}`, payload);
    return response.data;
  },

  async deactivateUser(id: number): Promise<UserRead> {
    const response = await apiClient.post<UserRead>(`/users/${id}/deactivate`);
    return response.data;
  },

  async activateUser(id: number): Promise<UserRead> {
    const response = await apiClient.post<UserRead>(`/users/${id}/activate`);
    return response.data;
  },

  async resetPassword(id: number): Promise<PasswordResetResponse> {
    const response = await apiClient.post<PasswordResetResponse>(`/users/${id}/reset-password`);
    return response.data;
  },

  async unlockUser(id: number): Promise<UserRead> {
    const response = await apiClient.post<UserRead>(`/users/${id}/unlock`);
    return response.data;
  },

  async updateUserHospitals(id: number, payload: UserHospitalsUpdate): Promise<UserRead> {
    const response = await apiClient.put<UserRead>(`/users/${id}/hospitals`, payload);
    return response.data;
  },

  async listRoles(): Promise<RoleInfo[]> {
    const response = await apiClient.get<RoleInfo[]>('/roles');
    return response.data;
  },

  // ==========================================================================
  // Jerarquía
  // ==========================================================================

  async getHierarchy(): Promise<HierarchyTreeResponse> {
    const response = await apiClient.get<HierarchyTreeResponse>('/hierarchy');
    return response.data;
  },

  // ==========================================================================
  // Plantillas de Checklist
  // ==========================================================================

  async getTemplateByAssetType(assetType: AssetType): Promise<ChecklistTemplate> {
    const response = await apiClient.get<ChecklistTemplate>(`/checklists/template?asset_type=${assetType}`);
    return response.data;
  },

  async getAllTemplates(): Promise<ChecklistTemplate[]> {
    const response = await apiClient.get<ChecklistTemplate[]>('/checklists/templates');
    return response.data;
  },

  // ==========================================================================
  // Inspecciones
  // ==========================================================================

  async createInspection(payload: CreateInspectionPayload): Promise<InspectionDetail> {
    const response = await apiClient.post<InspectionDetail>('/inspections', payload);
    return response.data;
  },

  async getInspection(id: number): Promise<InspectionDetail> {
    const response = await apiClient.get<InspectionDetail>(`/inspections/${id}`);
    return response.data;
  },

  async saveBatchResponses(id: number, payload: BatchResponsesPayload): Promise<InspectionDetail> {
    const response = await apiClient.put<InspectionDetail>(`/inspections/${id}/batch-responses`, payload);
    return response.data;
  },

  async completeInspection(id: number, payload?: CompleteInspectionPayload): Promise<InspectionDetail> {
    const response = await apiClient.post<InspectionDetail>(`/inspections/${id}/complete`, payload || {});
    return response.data;
  },

  async listInspections(params?: {
    asset_id?: number;
    status?: InspectionStatus;
    limit?: number;
    offset?: number;
  }): Promise<InspectionDetail[]> {
    const response = await apiClient.get<InspectionDetail[]>('/inspections', { params });
    return response.data;
  },

  // ==========================================================================
  // Estadísticas e Historial
  // ==========================================================================

  async getStats(): Promise<StatsOverviewResponse> {
    const response = await apiClient.get<StatsOverviewResponse>('/stats');
    return response.data;
  },

  async getAssetHistory(assetId: number): Promise<InspectionHistoryItem[]> {
    const response = await apiClient.get<InspectionHistoryItem[]>(`/assets/${assetId}/history`);
    return response.data;
  },

  // ==========================================================================
  // Auditoría Normativa y Cumplimiento Legal (Objetivo 2)
  // ==========================================================================

  async getInspectionCompliance(inspectionId: number, recalculate: boolean = true): Promise<ComplianceSummary> {
    const response = await apiClient.get<ComplianceSummary>(
      `/compliance/inspections/${inspectionId}/compliance`,
      { params: { recalculate } }
    );
    return response.data;
  },

  async getNormatives(isCurrent?: boolean): Promise<NormativeReference[]> {
    const response = await apiClient.get<NormativeReference[]>('/normatives', {
      params: isCurrent !== undefined ? { is_current: isCurrent } : {},
    });
    return response.data;
  },

  async checkTemplateNormativeCurrency(templateId: number): Promise<NormativeCurrencyReport> {
    const response = await apiClient.get<NormativeCurrencyReport>(
      `/normatives/templates/${templateId}/currency-check`
    );
    return response.data;
  },

  async listAuditLogs(params?: {
    inspection_id?: number;
    event_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]> {
    const response = await apiClient.get<AuditLogEntry[]>('/compliance/audit-logs', { params });
    return response.data;
  },

  // ==========================================================================
  // Evidencia Multimedia (Objetivo 3)
  // ==========================================================================

  async uploadEvidence(
    inspectionId: number,
    file: File | Blob,
    fileName?: string,
    itemId?: number,
    uploadedBy?: string
  ): Promise<InspectionEvidence> {
    const formData = new FormData();
    const name = fileName || (file instanceof File ? file.name : `evidence_${Date.now()}.jpg`);
    formData.append('file', file, name);

    if (itemId !== undefined && itemId !== null) {
      formData.append('item_id', String(itemId));
    }
    // uploaded_by se ignora en backend OE-6 (se toma del token), pero se conserva compatibilidad
    if (uploadedBy) {
      formData.append('uploaded_by', uploadedBy);
    }

    const response = await apiClient.post<InspectionEvidence>(
      `/inspections/${inspectionId}/evidence`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      }
    );
    return response.data;
  },

  async deleteEvidence(evidenceId: number): Promise<{ success: boolean; id: number; detail?: string }> {
    const response = await apiClient.delete<{ success: boolean; id: number; detail?: string }>(
      `/evidence/${evidenceId}`
    );
    return response.data;
  },

  async getEvidence(evidenceId: number): Promise<InspectionEvidence> {
    const response = await apiClient.get<InspectionEvidence>(`/evidence/${evidenceId}`);
    return response.data;
  },

  // ==========================================================================
  // Motor de Reportes (Objetivo 4)
  // ==========================================================================

  async downloadInspectionPDF(inspectionId: number): Promise<Blob> {
    const response = await apiClient.get(`/reports/inspections/${inspectionId}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async downloadInspectionExcel(inspectionId: number): Promise<Blob> {
    const response = await apiClient.get(`/reports/inspections/${inspectionId}/excel`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async downloadAssetHistoryPDF(assetId: number): Promise<Blob> {
    const response = await apiClient.get(`/reports/assets/${assetId}/history-pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async downloadExecutivePDF(hospitalId?: number): Promise<Blob> {
    const params = hospitalId ? { hospital_id: hospitalId } : {};
    const response = await apiClient.get('/reports/executive/pdf', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  async downloadExecutiveExcel(hospitalId?: number): Promise<Blob> {
    const params = hospitalId ? { hospital_id: hospitalId } : {};
    const response = await apiClient.get('/reports/executive/excel', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  async getExecutiveReportData(hospitalId?: number): Promise<ExecutiveReportData> {
    const params = hospitalId ? { hospital_id: hospitalId } : {};
    const response = await apiClient.get<ExecutiveReportData>('/reports/executive/data', {
      params,
    });
    return response.data;
  },

  // ==========================================================================
  // Subsistema de Notificaciones y Alertas (Objetivo 5 y 6)
  // ==========================================================================

  async getAlerts(params?: {
    status?: string | string[];
    severity?: string | string[];
    rule_code?: string;
    hospital_id?: number;
    sector_id?: number;
    asset_id?: number;
    inspection_id?: number;
    include_provisional?: boolean;
    q?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }): Promise<AlertListResponse> {
    const response = await apiClient.get<AlertListResponse>('/alerts', { params });
    return response.data;
  },

  async getAlertSummary(hospitalId?: number, withMetrics: boolean = false): Promise<AlertSummary> {
    const params: Record<string, any> = {};
    if (hospitalId !== undefined && hospitalId !== null) params.hospital_id = hospitalId;
    if (withMetrics) params.with_metrics = true;
    const response = await apiClient.get<AlertSummary>('/alerts/summary', { params });
    return response.data;
  },

  async getAlert(id: number): Promise<AlertDetail> {
    const response = await apiClient.get<AlertDetail>(`/alerts/${id}`);
    return response.data;
  },

  async acknowledgeAlert(id: number, body?: { note?: string }): Promise<Alert> {
    const response = await apiClient.post<Alert>(`/alerts/${id}/acknowledge`, body || {});
    return response.data;
  },

  async resolveAlert(id: number, body: { note: string }): Promise<Alert> {
    const response = await apiClient.post<Alert>(`/alerts/${id}/resolve`, body);
    return response.data;
  },

  async silenceAlert(
    id: number,
    body: { until: string; note?: string }
  ): Promise<Alert> {
    const response = await apiClient.post<Alert>(`/alerts/${id}/silence`, body);
    return response.data;
  },

  async bulkAcknowledgeAlerts(ids: number[]): Promise<{ updated: number }> {
    const response = await apiClient.post<{ updated: number }>('/alerts/bulk-acknowledge', {
      ids,
    });
    return response.data;
  },

  async runAlertChecks(): Promise<Record<string, number>> {
    const response = await apiClient.post<Record<string, number>>('/alerts/run-checks');
    return response.data;
  },

  async getAssetAlerts(assetId: number, status?: string): Promise<Alert[]> {
    const params = status ? { status } : {};
    const response = await apiClient.get<Alert[]>(`/assets/${assetId}/alerts`, { params });
    return response.data;
  },

  async getChannels(): Promise<NotificationChannel[]> {
    const response = await apiClient.get<NotificationChannel[]>('/notifications/channels');
    return response.data;
  },

  async createChannel(data: {
    name: string;
    channel_type: ChannelType;
    target: string;
    min_severity: AlertSeverity;
    hospital_id?: number | null;
    sector_id?: number | null;
    is_active?: boolean;
    secret?: string;
  }): Promise<NotificationChannel> {
    const response = await apiClient.post<NotificationChannel>('/notifications/channels', data);
    return response.data;
  },

  async updateChannel(
    id: number,
    data: Partial<{
      name: string;
      channel_type: ChannelType;
      target: string;
      min_severity: AlertSeverity;
      hospital_id?: number | null;
      sector_id?: number | null;
      is_active?: boolean;
      secret?: string;
    }>
  ): Promise<NotificationChannel> {
    const response = await apiClient.put<NotificationChannel>(`/notifications/channels/${id}`, data);
    return response.data;
  },

  async deleteChannel(id: number): Promise<{ success: boolean; id: number }> {
    const response = await apiClient.delete<{ success: boolean; id: number }>(
      `/notifications/channels/${id}`
    );
    return response.data;
  },

  async testChannel(id: number): Promise<NotificationDelivery> {
    const response = await apiClient.post<NotificationDelivery>(
      `/notifications/channels/${id}/test`
    );
    return response.data;
  },

  async getAlertRules(): Promise<AlertRule[]> {
    const response = await apiClient.get<AlertRule[]>('/notifications/rules');
    return response.data;
  },

  async updateAlertRule(
    ruleCode: string,
    data: Partial<{
      is_enabled: boolean;
      severity_override?: AlertSeverity | null;
      params?: Record<string, any>;
      notify_external?: boolean;
      escalate_after_minutes?: number | null;
    }>
  ): Promise<AlertRule> {
    const response = await apiClient.put<AlertRule>(`/notifications/rules/${ruleCode}`, data);
    return response.data;
  },

  async getDeliveries(params?: {
    alert_id?: number;
    status?: DeliveryStatus;
    channel_type?: ChannelType;
    limit?: number;
    offset?: number;
  }): Promise<NotificationDelivery[]> {
    const response = await apiClient.get<NotificationDelivery[]>('/notifications/deliveries', {
      params,
    });
    return response.data;
  },

  alertStreamUrl(hospitalId?: number, ticket?: string): string {
    const base = API_BASE_URL.startsWith('http')
      ? `${API_BASE_URL}/alerts/stream`
      : `${window.location.origin}${API_BASE_URL.startsWith('/') ? API_BASE_URL : '/' + API_BASE_URL}/alerts/stream`;

    const params = new URLSearchParams();
    if (hospitalId) {
      params.append('hospital_id', String(hospitalId));
    }
    if (ticket) {
      params.append('ticket', ticket);
    }

    const query = params.toString();
    return query ? `${base}?${query}` : base;
  },
};
