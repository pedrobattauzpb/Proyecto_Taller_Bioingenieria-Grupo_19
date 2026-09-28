"""
Estilos tipográficos, paleta de colores y configuraciones de página para ReportLab.
Coherente con el sistema de diseño clínico de la aplicación.
"""

from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm

# Paleta clínica institucional
COLORS = {
    "primary": HexColor("#2f6f6b"),        # Verde azulado clínico (--accent)
    "primary_dark": HexColor("#1d5652"),   # (--accent-strong)
    "primary_soft": HexColor("#e3efee"),   # (--accent-soft)
    "ok": HexColor("#1f8a5a"),             # Conforme / Operativo (--ok)
    "ok_soft": HexColor("#e5f4ec"),        # (--ok-soft)
    "warn": HexColor("#b8770a"),           # Advertencia / Desvío menor (--warn)
    "warn_soft": HexColor("#fbf0dd"),      # (--warn-soft)
    "critical": HexColor("#b91c1c"),       # Desvío crítico (rojo normativo)
    "critical_soft": HexColor("#fef2f2"),
    "ink": HexColor("#16212b"),            # Texto principal (--ink)
    "ink_soft": HexColor("#55636e"),       # Subtítulos y metadatos (--ink-soft)
    "ink_faint": HexColor("#8b96a0"),      # Texto tenue (--ink-faint)
    "border": HexColor("#d1d9e0"),         # Bordes de tablas y cajas (--border)
    "surface": HexColor("#f8fafc"),        # Fondo alternado de filas (--bg)
    "surface_card": HexColor("#ffffff"),
    "white": HexColor("#ffffff"),
}

# Dimensiones de página
PAGE_MARGIN = 1.3 * cm
PAGE_WIDTH_PRINTABLE = 21.0 * cm - (2 * PAGE_MARGIN)  # ~18.4 cm


def get_report_styles():
    """Genera y retorna la hoja de estilos tipográficos para reportes técnicos."""
    base_styles = getSampleStyleSheet()

    styles = {
        "DocTitle": ParagraphStyle(
            "DocTitle",
            parent=base_styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=COLORS["primary_dark"],
            spaceAfter=4,
        ),
        "DocSubtitle": ParagraphStyle(
            "DocSubtitle",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=COLORS["ink_soft"],
            spaceAfter=10,
        ),
        "SectionHeading": ParagraphStyle(
            "SectionHeading",
            parent=base_styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=COLORS["primary_dark"],
            spaceBefore=10,
            spaceAfter=5,
            keepWithNext=True,
        ),
        "SubsectionHeading": ParagraphStyle(
            "SubsectionHeading",
            parent=base_styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=12,
            textColor=COLORS["ink"],
            spaceBefore=6,
            spaceAfter=3,
            keepWithNext=True,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=COLORS["ink"],
        ),
        "BodyBold": ParagraphStyle(
            "BodyBold",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=COLORS["ink"],
        ),
        "BodySmall": ParagraphStyle(
            "BodySmall",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=9.5,
            textColor=COLORS["ink_soft"],
        ),
        "MetaLabel": ParagraphStyle(
            "MetaLabel",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=10,
            textColor=COLORS["ink_soft"],
        ),
        "MetaValue": ParagraphStyle(
            "MetaValue",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10.5,
            textColor=COLORS["ink"],
        ),
        "TableCell": ParagraphStyle(
            "TableCell",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9.5,
            textColor=COLORS["ink"],
        ),
        "TableCellBold": ParagraphStyle(
            "TableCellBold",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9.5,
            textColor=COLORS["ink"],
        ),
        "TableCellCode": ParagraphStyle(
            "TableCellCode",
            parent=base_styles["Normal"],
            fontName="Courier",
            fontSize=7,
            leading=8.5,
            textColor=COLORS["ink_soft"],
        ),
        "BadgeOK": ParagraphStyle(
            "BadgeOK",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            textColor=COLORS["ok"],
            alignment=1,  # Center
        ),
        "BadgeWarn": ParagraphStyle(
            "BadgeWarn",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            textColor=COLORS["warn"],
            alignment=1,
        ),
        "BadgeCritical": ParagraphStyle(
            "BadgeCritical",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            textColor=COLORS["critical"],
            alignment=1,
        ),
        "CalloutText": ParagraphStyle(
            "CalloutText",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=COLORS["ink"],
        ),
    }

    return styles
