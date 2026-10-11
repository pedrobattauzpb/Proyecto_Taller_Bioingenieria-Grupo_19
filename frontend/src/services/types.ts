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
  hydraulic_test_date?: string | null;
  inspection_interval_days?: number | null;
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
  default_interval_days?: number | null;
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
  active_alerts?: Alert[];
}

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'WARNING' | 'NOT_EVALUATED';
export type ComplianceSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION';
export type AuditEventType =
  | 'VALIDATION_RUN'
  | 'COMPLIANCE_CHECK'
  | 'NORM_UPDATE'
  | 'TEMPLATE_VERSION_CHANGE'
  | 'INSPECTION_COMPLETED'
  | 'ALERT_RAISED'
  | 'ALERT_ACKNOWLEDGED'
  | 'ALERT_RESOLVED'
  | 'ALERT_ESCALATED'
  | 'ALERT_SILENCED';

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
  active_alerts?: Alert[];
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
  open_alerts?: number;
  critical_open_alerts?: number;
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

export interface SectorStat {
  sector_id: number;
  sector_name: string;
  floor_level: string;
  total_assets: number;
  total_inspections: number;
  completed_inspections: number;
  compliance_percentage: number;
}

export interface AssetTypeStat {
  asset_type: string;
  total_assets: number;
  total_inspections: number;
  compliance_percentage: number;
}

export interface TopRiskAsset {
  asset_id: number;
  asset_name: string;
  tag_code: string;
  sector_name: string;
  non_compliant_count: number;
  critical_count: number;
}

export interface ExecutiveReportData {
  hospital_name: string;
  hospital_code: string;
  generated_at: string;
  total_sectors: number;
  total_assets: number;
  active_assets: number;
  total_inspections: number;
  completed_inspections: number;
  in_progress_inspections: number;
  global_compliance_percentage: number;
  sector_stats: SectorStat[];
  asset_type_stats: AssetTypeStat[];
  severity_distribution: Record<string, number>;
  top_risk_assets: TopRiskAsset[];
}

// --- Subsistema de Notificaciones y Alertas (Objetivo Específico 5) ---

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'AUTO_RESOLVED' | 'SILENCED';

export type AlertSource =
  | 'COMPLIANCE'
  | 'SCHEDULER'
  | 'INSPECTION_LIFECYCLE'
  | 'NORMATIVE'
  | 'MANUAL';

export type AlertScopeType = 'INSPECTION' | 'ASSET' | 'TEMPLATE' | 'NORMATIVE' | 'SYSTEM';

export type ChannelType = 'IN_APP' | 'EMAIL' | 'WEBHOOK';

export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface Alert {
  id: number;
  fingerprint: string;
  rule_code: string;
  source: AlertSource;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  normative_ref?: string | null;
  scope_type: AlertScopeType;
  hospital_id?: number | null;
  sector_id?: number | null;
  asset_id?: number | null;
  inspection_id?: number | null;
  item_id?: number | null;
  template_id?: number | null;
  expected_value?: string | null;
  actual_value?: string | null;
  context?: Record<string, any>;
  is_provisional: boolean;
  occurrence_count: number;
  first_detected_at: string;
  last_detected_at: string;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolution_note?: string | null;
  escalation_level: number;
  last_escalated_at?: string | null;
  silenced_until?: string | null;
  created_at: string;
  updated_at: string;
  asset_tag?: string | null;
  asset_name?: string | null;
  sector_name?: string | null;
  hospital_code?: string | null;
  item_code?: string | null;
  item_title?: string | null;
}

export interface NotificationDelivery {
  id: number;
  alert_id: number;
  channel_id?: number | null;
  channel_type: ChannelType;
  target: string;
  event: 'RAISED' | 'ESCALATED' | 'RESOLVED' | 'DIGEST' | string;
  status: DeliveryStatus;
  attempts: number;
  error?: string | null;
  sent_at?: string | null;
  created_at: string;
}

export interface AlertDetail extends Alert {
  deliveries?: NotificationDelivery[];
  audit_trail?: AuditLogEntry[];
}

export interface AlertListResponse {
  items: Alert[];
  total: number;
  counts_by_severity: Record<AlertSeverity, number>;
  counts_by_status: Record<AlertStatus, number>;
}

export interface AlertSummary {
  open_total: number;
  open_by_severity: Record<AlertSeverity, number>;
  unacknowledged_critical: number;
  last_alert_at?: string | null;
  health: 'OK' | 'DEGRADED' | 'CRITICAL';
  mtta_minutes?: number | null;
  mttr_minutes?: number | null;
}

export interface NotificationChannel {
  id: number;
  name: string;
  channel_type: ChannelType;
  target: string;
  min_severity: AlertSeverity;
  hospital_id?: number | null;
  sector_id?: number | null;
  is_active: boolean;
  has_secret: boolean;
  created_at: string;
}

export interface AlertRule {
  id: number;
  rule_code: string;
  name: string;
  description?: string | null;
  is_enabled: boolean;
  severity_override?: AlertSeverity | null;
  effective_severity?: AlertSeverity;
  params: Record<string, any>;
  notify_external: boolean;
  escalate_after_minutes?: number | null;
}

export interface AlertStreamEvent {
  event: 'alert.raised' | 'alert.updated' | 'alert.resolved' | 'alert.escalated' | 'summary' | 'ping';
  data: any;
}

