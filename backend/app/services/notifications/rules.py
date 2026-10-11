from dataclasses import dataclass, field
from typing import Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.notification import AlertSeverity, AlertRule


@dataclass
class RuleDefinition:
    rule_code: str
    name: str
    description: str
    default_severity: AlertSeverity
    notify_external: bool = True
    escalate_after_minutes: Optional[int] = None
    params: dict = field(default_factory=dict)


DEFAULT_RULES: Dict[str, RuleDefinition] = {
    # Reactivas
    "CMP-CRIT-NC": RuleDefinition(
        rule_code="CMP-CRIT-NC",
        name="Incumplimiento crítico de normativa en inspección",
        description="Detección de ítem NO CONFORME con severidad crítica según ISO 7396-1 / Res. 1130/2000.",
        default_severity=AlertSeverity.CRITICAL,
        notify_external=True,
        escalate_after_minutes=15,
        params={}
    ),
    "CMP-MAJOR-NC": RuleDefinition(
        rule_code="CMP-MAJOR-NC",
        name="Incumplimiento mayor de normativa en inspección",
        description="Detección de ítem NO CONFORME con severidad mayor.",
        default_severity=AlertSeverity.HIGH,
        notify_external=True,
        escalate_after_minutes=60,
        params={}
    ),
    "CMP-WARN-BAND": RuleDefinition(
        rule_code="CMP-WARN-BAND",
        name="Valor en banda preventiva de advertencia",
        description="Parámetro clínico/técnico dentro del 10% del límite de tolerancia.",
        default_severity=AlertSeverity.MEDIUM,
        notify_external=True,
        escalate_after_minutes=None,
        params={}
    ),
    "CMP-MINOR-NC": RuleDefinition(
        rule_code="CMP-MINOR-NC",
        name="Incumplimiento menor de normativa",
        description="Desvío menor estético o documental (sólo in-app).",
        default_severity=AlertSeverity.LOW,
        notify_external=False,
        escalate_after_minutes=None,
        params={}
    ),
    "INS-CLOSED-NC": RuleDefinition(
        rule_code="INS-CLOSED-NC",
        name="Inspección completada con desvíos reglamentarios",
        description="Dictamen final no conforme al completar la inspección.",
        default_severity=AlertSeverity.HIGH,
        notify_external=True,
        escalate_after_minutes=30,
        params={}
    ),
    "INS-CLOSED-OK": RuleDefinition(
        rule_code="INS-CLOSED-OK",
        name="Inspección completada satisfactoriamente",
        description="Inspección 100% conforme con la normativa vigente.",
        default_severity=AlertSeverity.INFO,
        notify_external=False,
        escalate_after_minutes=None,
        params={}
    ),

    # Programadas
    "AST-INSP-OVERDUE": RuleDefinition(
        rule_code="AST-INSP-OVERDUE",
        name="Inspección de activo vencida",
        description="Activo sin inspección completa dentro de su intervalo de mantenimiento reglamentario.",
        default_severity=AlertSeverity.HIGH,
        notify_external=True,
        escalate_after_minutes=120,
        params={}
    ),
    "AST-INSP-DUE-SOON": RuleDefinition(
        rule_code="AST-INSP-DUE-SOON",
        name="Próxima inspección de activo a vencer",
        description="La fecha de inspección periódica vencerá en los próximos días.",
        default_severity=AlertSeverity.LOW,
        notify_external=False,
        escalate_after_minutes=None,
        params={"due_soon_days": 7}
    ),
    "INS-STALE": RuleDefinition(
        rule_code="INS-STALE",
        name="Inspección en curso abandonada o demorada",
        description="Inspección iniciada sin avances ni cierre durante más del límite configurado.",
        default_severity=AlertSeverity.MEDIUM,
        notify_external=True,
        escalate_after_minutes=None,
        params={"stale_hours": 48}
    ),
    "CYL-HYDRO-EXPIRED": RuleDefinition(
        rule_code="CYL-HYDRO-EXPIRED",
        name="Prueba hidráulica de cilindro vencida",
        description="Cilindro con prueba hidráulica caducada (> 5 años) conforme IRAM 2529 / Res. 1130.",
        default_severity=AlertSeverity.CRITICAL,
        notify_external=True,
        escalate_after_minutes=30,
        params={"validity_years": 5}
    ),
    "CYL-HYDRO-SOON": RuleDefinition(
        rule_code="CYL-HYDRO-SOON",
        name="Prueba hidráulica de cilindro próxima a vencer",
        description="Cilindro con prueba hidráulica a vencer en menos de 60 días.",
        default_severity=AlertSeverity.MEDIUM,
        notify_external=True,
        escalate_after_minutes=None,
        params={"warn_days": 60}
    ),
    "NRM-SUPERSEDED": RuleDefinition(
        rule_code="NRM-SUPERSEDED",
        name="Plantilla activa con normativa no vigente o derogada",
        description="Plantilla de inspección referenciando una norma superada o no vigente.",
        default_severity=AlertSeverity.HIGH,
        notify_external=True,
        escalate_after_minutes=None,
        params={}
    ),
    "AST-RECURRENT-FAIL": RuleDefinition(
        rule_code="AST-RECURRENT-FAIL",
        name="Falla recurrente detectada en activo",
        description="Mismo punto o ítem fallando en 3 o más de las últimas 5 inspecciones cerradas.",
        default_severity=AlertSeverity.HIGH,
        notify_external=True,
        escalate_after_minutes=60,
        params={"threshold": 3, "window": 5}
    ),
    "SYS-TEST": RuleDefinition(
        rule_code="SYS-TEST",
        name="Alerta de prueba del sistema",
        description="Alerta sintética para validación de canales y diagnóstico de conectividad.",
        default_severity=AlertSeverity.INFO,
        notify_external=True,
        escalate_after_minutes=None,
        params={}
    ),
}


async def get_effective_rule(db: AsyncSession, rule_code: str) -> Optional[RuleDefinition]:
    """
    Recupera la regla combinando catálogo por defecto con personalizaciones en DB.
    """
    default_def = DEFAULT_RULES.get(rule_code)
    stmt = select(AlertRule).where(AlertRule.rule_code == rule_code)
    result = await db.execute(stmt)
    db_rule = result.scalars().first()

    if not db_rule and not default_def:
        return None

    if not db_rule:
        return default_def

    # Si está deshabilitada en DB, retornamos indicando is_enabled=False o None
    if not db_rule.is_enabled:
        return None

    eff_severity = db_rule.severity_override or (default_def.default_severity if default_def else AlertSeverity.MEDIUM)
    eff_notify = db_rule.notify_external if db_rule.notify_external is not None else (default_def.notify_external if default_def else True)
    eff_escalate = db_rule.escalate_after_minutes if db_rule.escalate_after_minutes is not None else (default_def.escalate_after_minutes if default_def else None)
    eff_params = db_rule.params if db_rule.params is not None else (default_def.params if default_def else {})

    return RuleDefinition(
        rule_code=rule_code,
        name=db_rule.name or (default_def.name if default_def else rule_code),
        description=db_rule.description or (default_def.description if default_def else ""),
        default_severity=eff_severity,
        notify_external=eff_notify,
        escalate_after_minutes=eff_escalate,
        params=eff_params or {},
    )
