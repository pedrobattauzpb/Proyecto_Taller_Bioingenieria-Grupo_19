from typing import Optional, Dict, Any
from app.core.config import settings
from app.models.notification import Alert, AlertSeverity


def render_alert_title(rule_code: str, asset_name: Optional[str] = None, item_title: Optional[str] = None) -> str:
    if rule_code == "CMP-CRIT-NC":
        prefix = f"Desvío crítico: {item_title}" if item_title else "Incumplimiento crítico detectado"
        return f"{prefix} — {asset_name}" if asset_name else prefix
    elif rule_code == "CMP-MAJOR-NC":
        prefix = f"Desvío mayor: {item_title}" if item_title else "Incumplimiento mayor detectado"
        return f"{prefix} — {asset_name}" if asset_name else prefix
    elif rule_code == "CMP-WARN-BAND":
        prefix = f"Alerta preventiva: {item_title}" if item_title else "Valor en banda de advertencia"
        return f"{prefix} — {asset_name}" if asset_name else prefix
    elif rule_code == "CMP-MINOR-NC":
        prefix = f"Desvío menor: {item_title}" if item_title else "Incumplimiento menor"
        return f"{prefix} — {asset_name}" if asset_name else prefix
    elif rule_code == "INS-CLOSED-NC":
        return f"Inspección no conforme completada — {asset_name}" if asset_name else "Inspección completada con desvíos"
    elif rule_code == "INS-CLOSED-OK":
        return f"Inspección conforme completada — {asset_name}" if asset_name else "Inspección completada conforme"
    elif rule_code == "AST-INSP-OVERDUE":
        return f"Inspección vencida — {asset_name}" if asset_name else "Inspección de activo vencida"
    elif rule_code == "AST-INSP-DUE-SOON":
        return f"Inspección próxima a vencer — {asset_name}" if asset_name else "Inspección próxima a vencer"
    elif rule_code == "INS-STALE":
        return f"Inspección demorada / en curso — {asset_name}" if asset_name else "Inspección demorada"
    elif rule_code == "CYL-HYDRO-EXPIRED":
        return f"Prueba hidráulica vencida (IRAM 2529) — {asset_name}" if asset_name else "Prueba hidráulica vencida"
    elif rule_code == "CYL-HYDRO-SOON":
        return f"Prueba hidráulica por vencer — {asset_name}" if asset_name else "Prueba hidráulica por vencer"
    elif rule_code == "NRM-SUPERSEDED":
        return f"Plantilla con normativa superada o derogada"
    elif rule_code == "AST-RECURRENT-FAIL":
        return f"Falla recurrente detectada — {asset_name}" if asset_name else "Falla recurrente"
    elif rule_code == "SYS-TEST":
        return "Alerta de prueba del sistema de notificaciones"
    return f"Alerta {rule_code} — {asset_name or 'General'}"


def render_email_subject(alert: Alert, event: str = "RAISED") -> str:
    sev_str = "CRÍTICA" if alert.severity == AlertSeverity.CRITICAL else (
        "ALTA" if alert.severity == AlertSeverity.HIGH else (
            "MEDIA" if alert.severity == AlertSeverity.MEDIUM else "INFO"
        )
    )
    event_prefix = ""
    if event == "ESCALATED":
        event_prefix = f"[ESCALADA Nvl {alert.escalation_level}] "
    elif event == "RESOLVED":
        event_prefix = "[RESUELTA] "

    norm_str = f" ({alert.normative_ref})" if alert.normative_ref else ""
    return f"{event_prefix}[GMAO][{sev_str}] {alert.title}{norm_str}"


def render_email_content(alert: Alert, event: str = "RAISED", deep_link: Optional[str] = None) -> tuple[str, str]:
    """Retorna (plain_text, html_body)"""
    url = deep_link or (
        f"{settings.FRONTEND_BASE_URL}/inspections/{alert.inspection_id}"
        if alert.inspection_id
        else f"{settings.FRONTEND_BASE_URL}/alerts?id={alert.id}"
    )

    plain = f"""GMAO - Protocolo de Inspección Digital de Gases Medicinales
===========================================================
Evento: {event}
Severidad: {alert.severity.value}
Regla: {alert.rule_code}
Título: {alert.title}

Detalle:
{alert.message}

Referencia Normativa: {alert.normative_ref or 'N/A'}
Valor Esperado: {alert.expected_value or 'N/A'}
Valor Medido: {alert.actual_value or 'N/A'}
Ocurrencias: {alert.occurrence_count}

Acceder a la plataforma:
{url}
"""

    badge_color = "#b42318" if alert.severity == AlertSeverity.CRITICAL else (
        "#b54708" if alert.severity == AlertSeverity.HIGH else (
            "#027a48" if alert.severity == AlertSeverity.INFO else "#344054"
        )
    )

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; }}
  .card {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
  .header {{ background-color: {badge_color}; color: #ffffff; padding: 16px 24px; }}
  .header h2 {{ margin: 0; font-size: 18px; }}
  .content {{ padding: 24px; }}
  .field {{ margin-bottom: 12px; }}
  .field-label {{ font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; }}
  .field-value {{ font-size: 15px; margin-top: 2px; }}
  .btn {{ display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 500; margin-top: 16px; }}
  .footer {{ padding: 16px 24px; background-color: #f1f5f9; font-size: 12px; color: #64748b; text-align: center; }}
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>{alert.severity.value} — {alert.rule_code}</h2>
    </div>
    <div class="content">
      <div class="field">
        <div class="field-label">Título</div>
        <div class="field-value" style="font-weight: 600;">{alert.title}</div>
      </div>
      <div class="field">
        <div class="field-label">Mensaje</div>
        <div class="field-value">{alert.message}</div>
      </div>
      <div class="field">
        <div class="field-label">Norma Aplicable</div>
        <div class="field-value">{alert.normative_ref or 'Sin referencia específica'}</div>
      </div>
      <div class="field">
        <div class="field-label">Valor Esperado / Medido</div>
        <div class="field-value">{alert.expected_value or 'N/A'} &rarr; <strong>{alert.actual_value or 'N/A'}</strong></div>
      </div>
      <a href="{url}" class="btn">Ver Alerta en GMAO</a>
    </div>
    <div class="footer">
      Sistema Automatizado de Notificaciones Clínicas &bull; Hospital Digital
    </div>
  </div>
</body>
</html>
"""
    return plain, html
