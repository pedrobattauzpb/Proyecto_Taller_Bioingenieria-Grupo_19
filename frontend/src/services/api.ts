import axios from 'axios';
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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(
        `[API HTTP ${error.response.status}]:`,
        error.response.data?.detail || error.response.data
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
  // Jerarquía
  async getHierarchy(): Promise<HierarchyTreeResponse> {
    const response = await apiClient.get<HierarchyTreeResponse>('/hierarchy');
    return response.data;
  },

  // Plantillas de Checklist
  async getTemplateByAssetType(assetType: AssetType): Promise<ChecklistTemplate> {
    const response = await apiClient.get<ChecklistTemplate>(`/checklists/template?asset_type=${assetType}`);
    return response.data;
  },

  async getAllTemplates(): Promise<ChecklistTemplate[]> {
    const response = await apiClient.get<ChecklistTemplate[]>('/checklists/templates');
    return response.data;
  },

  // Inspecciones
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

  // Estadísticas e Historial
  async getStats(): Promise<StatsOverviewResponse> {
    const response = await apiClient.get<StatsOverviewResponse>('/stats');
    return response.data;
  },

  async getAssetHistory(assetId: number): Promise<InspectionHistoryItem[]> {
    const response = await apiClient.get<InspectionHistoryItem[]>(`/assets/${assetId}/history`);
    return response.data;
  },

  // Auditoría Normativa y Cumplimiento Legal en Tiempo Real (Objetivo Específico 2)
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

  // Evidencia Multimedia (Objetivo 3)
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
};
