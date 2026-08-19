export type AssetType =
  | 'MANIFOLD'
  | 'AVSU_VALVE'
  | 'TERMINAL_UNIT'
  | 'PRESSURE_REGULATOR'
  | 'GAS_CYLINDER';

export type ItemType = 'BOOLEAN' | 'NUMERIC' | 'TEXT';

export type InspectionStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';

export interface Asset {
  id: number;
  sector_id: number;
  tag_code: string;
  name: string;
  asset_type: AssetType;
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
  total_items: number;
  completed_items: number;
  progress_percentage: number;
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
}

export interface StatsOverviewResponse {
  total_assets: number;
  active_assets: number;
  total_inspections: number;
  completed_inspections: number;
  in_progress_inspections: number;
  draft_inspections: number;
  recent_inspections: InspectionHistoryItem[];
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
