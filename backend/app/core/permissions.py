import enum
from typing import Dict, FrozenSet
from app.models.user import UserRole


class Permission(str, enum.Enum):
    HIERARCHY_READ = "hierarchy:read"
    HIERARCHY_WRITE = "hierarchy:write"
    TEMPLATES_READ = "templates:read"
    TEMPLATES_WRITE = "templates:write"
    NORMATIVES_READ = "normatives:read"
    NORMATIVES_WRITE = "normatives:write"
    INSPECTIONS_READ_OWN = "inspections:read_own"
    INSPECTIONS_READ_COMPLETED = "inspections:read_completed"
    INSPECTIONS_READ_ALL = "inspections:read_all"
    INSPECTIONS_CREATE = "inspections:create"
    INSPECTIONS_EXECUTE_OWN = "inspections:execute_own"
    INSPECTIONS_EXECUTE_ALL = "inspections:execute_all"
    INSPECTIONS_COMPLETE_OWN = "inspections:complete_own"
    INSPECTIONS_COMPLETE_ALL = "inspections:complete_all"
    EVIDENCE_READ = "evidence:read"
    EVIDENCE_DELETE_OWN = "evidence:delete_own"
    EVIDENCE_DELETE_ALL = "evidence:delete_all"
    COMPLIANCE_READ = "compliance:read"
    COMPLIANCE_RECALCULATE = "compliance:recalculate"
    AUDIT_LOGS_READ = "audit_logs:read"
    REPORTS_INSPECTION = "reports:inspection"
    REPORTS_ASSET_HISTORY = "reports:asset_history"
    REPORTS_EXECUTIVE = "reports:executive"
    STATS_READ = "stats:read"
    ALERTS_READ = "alerts:read"
    ALERTS_ACKNOWLEDGE = "alerts:acknowledge"
    ALERTS_RESOLVE = "alerts:resolve"
    ALERTS_SILENCE = "alerts:silence"
    ALERTS_RUN_CHECKS = "alerts:run_checks"
    NOTIFICATIONS_MANAGE = "notifications:manage"
    USERS_READ = "users:read"
    USERS_MANAGE_TECHNICIANS = "users:manage_technicians"
    USERS_MANAGE = "users:manage"


ROLE_PERMISSIONS: Dict[UserRole, FrozenSet[Permission]] = {
    UserRole.TECHNICIAN: frozenset({
        Permission.HIERARCHY_READ,
        Permission.TEMPLATES_READ,
        Permission.NORMATIVES_READ,
        Permission.INSPECTIONS_READ_OWN,
        Permission.INSPECTIONS_READ_COMPLETED,
        Permission.INSPECTIONS_CREATE,
        Permission.INSPECTIONS_EXECUTE_OWN,
        Permission.INSPECTIONS_COMPLETE_OWN,
        Permission.EVIDENCE_READ,
        Permission.EVIDENCE_DELETE_OWN,
        Permission.COMPLIANCE_READ,
        Permission.COMPLIANCE_RECALCULATE,
        Permission.REPORTS_INSPECTION,
        Permission.REPORTS_ASSET_HISTORY,
        Permission.STATS_READ,
        Permission.ALERTS_READ,
        Permission.ALERTS_ACKNOWLEDGE,
    }),
    UserRole.SUPERVISOR: frozenset({
        Permission.HIERARCHY_READ,
        Permission.HIERARCHY_WRITE,
        Permission.TEMPLATES_READ,
        Permission.TEMPLATES_WRITE,
        Permission.NORMATIVES_READ,
        Permission.INSPECTIONS_READ_OWN,
        Permission.INSPECTIONS_READ_COMPLETED,
        Permission.INSPECTIONS_READ_ALL,
        Permission.INSPECTIONS_CREATE,
        Permission.INSPECTIONS_EXECUTE_OWN,
        Permission.INSPECTIONS_EXECUTE_ALL,
        Permission.INSPECTIONS_COMPLETE_OWN,
        Permission.INSPECTIONS_COMPLETE_ALL,
        Permission.EVIDENCE_READ,
        Permission.EVIDENCE_DELETE_OWN,
        Permission.EVIDENCE_DELETE_ALL,
        Permission.COMPLIANCE_READ,
        Permission.COMPLIANCE_RECALCULATE,
        Permission.AUDIT_LOGS_READ,
        Permission.REPORTS_INSPECTION,
        Permission.REPORTS_ASSET_HISTORY,
        Permission.REPORTS_EXECUTIVE,
        Permission.STATS_READ,
        Permission.ALERTS_READ,
        Permission.ALERTS_ACKNOWLEDGE,
        Permission.ALERTS_RESOLVE,
        Permission.ALERTS_SILENCE,
        Permission.ALERTS_RUN_CHECKS,
        Permission.NOTIFICATIONS_MANAGE,
        Permission.USERS_READ,
        Permission.USERS_MANAGE_TECHNICIANS,
    }),
    UserRole.AUDITOR: frozenset({
        Permission.HIERARCHY_READ,
        Permission.TEMPLATES_READ,
        Permission.NORMATIVES_READ,
        Permission.INSPECTIONS_READ_OWN,
        Permission.INSPECTIONS_READ_COMPLETED,
        Permission.INSPECTIONS_READ_ALL,
        Permission.EVIDENCE_READ,
        Permission.COMPLIANCE_READ,
        Permission.AUDIT_LOGS_READ,
        Permission.REPORTS_INSPECTION,
        Permission.REPORTS_ASSET_HISTORY,
        Permission.REPORTS_EXECUTIVE,
        Permission.STATS_READ,
        Permission.ALERTS_READ,
    }),
    UserRole.ADMIN: frozenset(Permission),
}
