import hashlib
from typing import Optional, Union
from app.models.notification import AlertScopeType


def build_fingerprint(
    rule_code: str,
    scope_type: Union[AlertScopeType, str],
    scope_id: Union[int, str],
    item_id: Optional[Union[int, str]] = None,
) -> str:
    """
    Genera un hash SHA-1 determinístico para deduplicación de alertas.
    fingerprint = sha1(rule_code | scope_type | scope_id | item_id?)
    """
    scope_type_str = scope_type.value if hasattr(scope_type, "value") else str(scope_type)
    item_str = str(item_id) if item_id is not None else ""
    raw = f"{rule_code}|{scope_type_str}|{scope_id}|{item_str}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()
