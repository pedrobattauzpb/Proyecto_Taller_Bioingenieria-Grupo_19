import axios from 'axios';
import { Platform } from 'react-native';
import {
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

// Determinar URL del backend: En Web usa localhost:8000 por defecto
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

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
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});


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
      `/inspections/${inspectionId}/compliance`,
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
    const response = await apiClient.get<AuditLogEntry[]>('/audit-logs', { params });
    return response.data;
  },

  // Evidencia Multimedia (Objetivo 3)
  async uploadEvidence(
    inspectionId: number,
    file: { uri: string; name?: string; type?: string; blob?: Blob },
    itemId?: number,
    uploadedBy?: string
  ): Promise<InspectionEvidence> {
    const formData = new FormData();
    const fileName = file.name || `evidence_${Date.now()}.${file.type?.includes('video') ? 'mp4' : 'jpg'}`;
    const fileType = file.type || (fileName.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');

    if (Platform.OS === 'web' && file.blob) {
      formData.append('file', file.blob, fileName);
    } else if (Platform.OS === 'web' && file.uri.startsWith('blob:')) {
      const resp = await fetch(file.uri);
      const blob = await resp.blob();
      formData.append('file', blob, fileName);
    } else {
      formData.append('file', {
        uri: file.uri,
        name: fileName,
        type: fileType,
      } as any);
    }

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
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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

