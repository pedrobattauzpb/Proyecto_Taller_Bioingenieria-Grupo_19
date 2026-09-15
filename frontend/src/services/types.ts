export type AssetType =
  | 'MANIFOLD'
  | 'AVSU_VALVE'
  | 'TERMINAL_UNIT'
  | 'PRESSURE_REGULATOR'
  | 'GAS_CYLINDER'
  | 'PANEL_ALARMA'
  | 'POLIDUCTO'
  | 'COMPRESOR';

export type ItemType = 'BOOLEAN' | 'NUMERIC' | 'TEXT';

export type InspectionStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';

export type FileType = 'IMAGE' | 'VIDEO';

export interface InspectionEvidence {
  id: number;
  inspection_id: number;
  item_id?: number | null;
  file_type: FileType;
  storage_url: string;
  presigned_url?: string | null;
  file_size_bytes?: number | null;
  uploaded_at: string;
  uploaded_by?: string | null;
}

export interface Asset {
  id: number;
  sector_id: number;
  tag_code: string;
  name: string;
  asset_type: AssetType;
  serial_number?: string | null;
  installation_date?: string | null;
  qr_code?: string | null;
  is_active: boolean;
}

export interface Sector {
  id: number;
  hospital_id: number;
  name: string;
  floor_level?: string | null;
  assets: Asset[];
}

export interface Hospital {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  created_at: string;
  sectors: Sector[];
}

export interface HierarchyMetrics {
  total_hospitals: number;
  total_sectors: number;
  total_assets: number;
  active_assets: number;
}

export interface HierarchyTreeResponse {
  hospitals: Hospital[];
  metrics: HierarchyMetrics;
}

export interface ChecklistItem {
  id: number;
  template_id: number;
  order_index: number;
  code: string;
  title: string;
  description?: string | null;
  input_type: ItemType;
  unit?: string | null;
  is_mandatory: boolean;
  referencia_normativa: string;
  min_value?: number | null;
  max_value?: number | null;
}

export interface ChecklistTemplate {
  id: number;
  title: string;
  asset_type: AssetType;
  version: string;
  description?: string | null;
  is_active: boolean;
  items: ChecklistItem[];
}

export interface InspectionResponse {
  id?: number;
  inspection_id?: number;
  item_id: number;
  val_boolean?: boolean | null;
  val_numeric?: number | null;
  val_text?: string | null;
  observations?: string | null;
  created_at?: string;
  item?: ChecklistItem;
}

export interface InspectionDetail {
  id: number;
  asset_id: number;
  template_id: number;
  inspector_name: string;
  status: InspectionStatus;
  started_at: string;
  completed_at?: string | null;
  notes?: string | null;
  asset?: Asset;
  template?: ChecklistTemplate;
  responses: InspectionResponse[];
  evidences?: InspectionEvidence[];
  total_items: number;
  completed_items: number;
  progress_percentage: number;
  compliance_summary?: ComplianceSummary | null;
}

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'WARNING' | 'NOT_EVALUATED';
export type ComplianceSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION';
export type AuditEventType =
  | 'VALIDATION_RUN'
  | 'COMPLIANCE_CHECK'
  | 'NORM_UPDATE'
  | 'TEMPLATE_VERSION_CHANGE'
  | 'INSPECTION_COMPLETED';

export interface NormativeVersion {
  id: number;
  reference_id: number;
  version_code: string;
  effective_date?: string | null;
  expiry_date?: string | null;
  changelog?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface NormativeReference {
  id: number;
  code: string;
  title: string;
  issuing_body: string;
  publication_date?: string | null;
  current_version: string;
  is_current: boolean;
  superseded_by_id?: number | null;
  url_reference?: string | null;
  description?: string | null;
  created_at: string;
  versions?: NormativeVersion[];
}

export interface NormativeClauseCheck {
  item_id: number;
  item_code: string;
  item_title: string;
  referencia_normativa: string;
  matched_norm_code?: string | null;
  is_current: boolean;
  status_message: string;
  suggested_replacement?: string | null;
}

export interface NormativeCurrencyReport {
  template_id: number;
  template_title: string;
  asset_type: string;
  all_current: boolean;
  total_items: number;
  current_items_count: number;
  outdated_items_count: number;
  clauses: NormativeClauseCheck[];
}

export interface ComplianceResult {
  id: number;
  inspection_id: number;
  item_id: number;
  response_id?: number | null;
  compliance_status: ComplianceStatus;
  normative_ref: string;
  expected_value?: string | null;
  actual_value?: string | null;
  deviation_detail?: string | null;
  severity: ComplianceSeverity;
  validated_at: string;
  normative_version_id?: number | null;
}

export interface ComplianceSummary {
  inspection_id: number;
  status: string;
  total_items: number;
  evaluated_items: number;
  compliant_items: number;
  non_compliant_items: number;
  warning_items: number;
  pending_items: number;
  compliance_percentage: number;
  is_fully_compliant: boolean;
  critical_deviations_count: number;
  major_deviations_count: number;
  minor_deviations_count: number;
  observation_deviations_count: number;
  normative_currency: NormativeCurrencyReport;
  results: ComplianceResult[];
}

export interface AuditLogEntry {
  id: number;
  inspection_id?: number | null;
  event_type: AuditEventType;
  event_detail: Record<string, any>;
  actor: string;
  created_at: string;
}

export interface InspectionHistoryItem {
  id: number;
  asset_id: number;
  asset_name: string;
  asset_tag: string;
  asset_type: string;
  template_title: string;
  inspector_name: string;
  status: InspectionStatus;
  started_at: string;
  completed_at?: string | null;
  total_items: number;
  evaluated_items: number;
  non_compliant_count: number;
  notes?: string | null;
  evidences?: InspectionEvidence[];
}

export interface StatsOverviewResponse {
  total_assets: number;
  active_assets: number;
  total_inspections: number;
  completed_inspections: number;
  in_progress_inspections: number;
  draft_inspections: number;
  recent_inspections: InspectionHistoryItem[];
  global_compliance_percentage?: number;
  active_outdated_norms_count?: number;
}

export interface CreateInspectionPayload {
  asset_id: number;
  template_id?: number;
  inspector_name: string;
  notes?: string;
}

export interface BatchResponsesPayload {
  responses: Array<{
    item_id: number;
    val_boolean?: boolean | null;
    val_numeric?: number | null;
    val_text?: string | null;
    observations?: string | null;
  }>;
}

export interface CompleteInspectionPayload {
  notes?: string;
  inspector_name?: string;
}
