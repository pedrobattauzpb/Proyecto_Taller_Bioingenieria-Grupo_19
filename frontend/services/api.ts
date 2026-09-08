import axios from 'axios';
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
} from './types';

// Determinar URL del backend: En Web usa localhost:8000 por defecto
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

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
};

