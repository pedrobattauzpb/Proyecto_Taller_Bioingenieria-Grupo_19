"""
Generador de documentos PDF para Actas de Inspección Técnica,
Historial de Componentes e Informes Ejecutivos Institucionales.
Utiliza ReportLab Platypus con diseño clínico profesional.
"""

from io import BytesIO
from datetime import datetime
from typing import List, Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Table,
    TableStyle,
    Spacer,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas

from app.schemas.reports import (
    InspectionReportData,
    AssetHistoryReportData,
    ExecutiveReportData,
)
from .styles import COLORS, PAGE_MARGIN, PAGE_WIDTH_PRINTABLE, get_report_styles


class NumberedCanvas(canvas.Canvas):
    """
    Canvas de dos pasadas para calcular e imprimir dinámicamente
    el número total de páginas ('Página X de Y') y encabezado/pie institucional.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 7.5)
        self.setFillColor(COLORS["ink_faint"])

        # Línea superior de cabecera
        self.setStrokeColor(COLORS["border"])
        self.setLineWidth(0.5)
        self.line(
            PAGE_MARGIN,
            A4[1] - 1.2 * cm,
            A4[0] - PAGE_MARGIN,
            A4[1] - 1.2 * cm,
        )

        # Texto de cabecera superior
        self.drawString(
            PAGE_MARGIN,
            A4[1] - 1.0 * cm,
            "SISTEMA DE INSPECCIÓN DIGITAL DE GASES MEDICINALES — RES. MSAL 1130/2000 & ISO 7396-1",
        )

        # Línea inferior de pie de página
        self.line(
            PAGE_MARGIN,
            1.2 * cm,
            A4[0] - PAGE_MARGIN,
            1.2 * cm,
        )

        # Pie de página: Fecha de emisión a la izquierda, Paginación a la derecha
        now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
        self.drawString(
            PAGE_MARGIN,
            0.8 * cm,
            f"Documento técnico oficial autogenerado · Emisión: {now_str} hs",
        )

        page_text = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(A4[0] - PAGE_MARGIN, 0.8 * cm, page_text)

        self.restoreState()


class InspectionPDFGenerator:
    """Generador del Acta Formal de Inspección Técnica en formato PDF A4."""

    def __init__(self):
        self.styles = get_report_styles()

    def generate(self, data: InspectionReportData) -> BytesIO:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=PAGE_MARGIN,
            rightMargin=PAGE_MARGIN,
            topMargin=1.6 * cm,
            bottomMargin=1.6 * cm,
        )

        story = []

        # 1. Cabecera del Documento
        story.extend(self._build_header(data))
        story.append(Spacer(1, 8))

        # 2. Datos Generales y de Identificación del Activo
        story.extend(self._build_metadata_section(data))
        story.append(Spacer(1, 10))

        # 3. Resumen Ejecutivo de Conformidad Normativa
        story.extend(self._build_compliance_summary_card(data))
        story.append(Spacer(1, 12))

        # 4. Tabla Detallada de Ítems Verificados
        story.extend(self._build_items_table(data))
        story.append(Spacer(1, 10))

        # 5. Detalle de No Conformidades y Desvíos
        deviations = [
            it
            for it in data.items
            if it.compliance_status in ("NON_COMPLIANT", "WARNING")
        ]
        if deviations:
            story.extend(self._build_deviations_section(deviations))
            story.append(Spacer(1, 10))

        # 6. Evidencias Multimedia
        if data.evidences:
            story.extend(self._build_evidences_section(data.evidences))
            story.append(Spacer(1, 10))

        # 7. Vigencia Normativa
        if data.normative_currency:
            story.extend(
                self._build_normative_currency_section(data.normative_currency)
            )
            story.append(Spacer(1, 10))

        # 8. Observaciones y Firmas
        story.extend(self._build_signatures_section(data))

        # 9. Bitácora de Trazabilidad
        if data.audit_trail:
            story.append(Spacer(1, 8))
            story.extend(self._build_audit_trail_section(data.audit_trail))

        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer

    def _build_header(self, data: InspectionReportData) -> List[Any]:
        title = "ACTA DE INSPECCIÓN TÉCNICA"
        subtitle = (
            f"Protocolo de Auditoría y Verificación Normativa de Gases Medicinales · "
            f"Inspección #{data.inspection_id} ({data.status})"
        )

        return [
            Paragraph(title, self.styles["DocTitle"]),
            Paragraph(subtitle, self.styles["DocSubtitle"]),
            HRFlowable(
                width="100%",
                thickness=1.5,
                color=COLORS["primary"],
                spaceBefore=1,
                spaceAfter=6,
            ),
        ]

    def _build_metadata_section(self, data: InspectionReportData) -> List[Any]:
        completed_str = (
            data.completed_at.strftime("%d/%m/%Y %H:%M hs")
            if data.completed_at
            else "En Curso (No sellada)"
        )
        started_str = data.started_at.strftime("%d/%m/%Y %H:%M hs")

        # Tabla de 4 columnas (2 pares Label / Value)
        table_data = [
            [
                Paragraph("Institución Hospitalaria:", self.styles["MetaLabel"]),
                Paragraph(
                    f"<b>{data.hospital_name}</b> ({data.hospital_code})",
                    self.styles["MetaValue"],
                ),
                Paragraph("Inspector Actuante:", self.styles["MetaLabel"]),
                Paragraph(data.inspector_name, self.styles["MetaValue"]),
            ],
            [
                Paragraph("Sector / Ubicación:", self.styles["MetaLabel"]),
                Paragraph(
                    f"{data.sector_name} {f'· Piso {data.sector_floor}' if data.sector_floor else ''}",
                    self.styles["MetaValue"],
                ),
                Paragraph("Fecha Inicio:", self.styles["MetaLabel"]),
                Paragraph(started_str, self.styles["MetaValue"]),
            ],
            [
                Paragraph("Activo Auditado:", self.styles["MetaLabel"]),
                Paragraph(
                    f"<b>{data.asset_name}</b> (TAG: {data.asset_tag})",
                    self.styles["MetaValue"],
                ),
                Paragraph("Fecha Finalización:", self.styles["MetaLabel"]),
                Paragraph(completed_str, self.styles["MetaValue"]),
            ],
            [
                Paragraph("Tipo de Componente:", self.styles["MetaLabel"]),
                Paragraph(data.asset_type, self.styles["MetaValue"]),
                Paragraph("Plantilla Normativa:", self.styles["MetaLabel"]),
                Paragraph(
                    f"{data.template_title} (v{data.template_version})",
                    self.styles["MetaValue"],
                ),
            ],
        ]

        if data.asset_serial or data.asset_qr:
            table_data.append([
                Paragraph("N° Serie / Fabricante:", self.styles["MetaLabel"]),
                Paragraph(data.asset_serial or "No informado", self.styles["MetaValue"]),
                Paragraph("Código QR / Ident.:", self.styles["MetaLabel"]),
                Paragraph(data.asset_qr or "No asignado", self.styles["MetaValue"]),
            ])

        col_w = [4.0 * cm, 5.2 * cm, 3.8 * cm, 5.4 * cm]
        t = Table(table_data, colWidths=col_w)
        t.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("BACKGROUND", (0, 0), (-1, -1), COLORS["surface"]),
                ("BOX", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
            ])
        )

        return [
            Paragraph("1. DATOS GENERALES Y UBICACIÓN CLÍNICA", self.styles["SectionHeading"]),
            t,
        ]

    def _build_compliance_summary_card(self, data: InspectionReportData) -> List[Any]:
        cs = data.compliance_summary

        is_ok = cs.is_fully_compliant
        pct = cs.compliance_percentage

        status_text = (
            "✅ INSTALACIÓN PLENAMENTE CONFORME"
            if is_ok
            else "⚠️ NO CONFORME — REQUIERE ACCIÓN CORRECTIVA"
        )
        status_color = COLORS["ok"] if is_ok else COLORS["warn"]
        status_bg = COLORS["ok_soft"] if is_ok else COLORS["warn_soft"]

        summary_table_data = [
            [
                Paragraph("DICTAMEN NORMATIVO:", self.styles["MetaLabel"]),
                Paragraph(
                    f"<font color='{status_color.hexval()}'><b>{status_text}</b></font>",
                    self.styles["MetaValue"],
                ),
                Paragraph("NIVEL DE CUMPLIMIENTO:", self.styles["MetaLabel"]),
                Paragraph(
                    f"<b>{pct:.1f}%</b> ({cs.compliant_items} de {cs.total_items} conformes)",
                    self.styles["MetaValue"],
                ),
            ],
            [
                Paragraph("Ítems Evaluados:", self.styles["MetaLabel"]),
                Paragraph(f"{cs.evaluated_items} de {cs.total_items}", self.styles["MetaValue"]),
                Paragraph("Desvíos Críticos:", self.styles["MetaLabel"]),
                Paragraph(
                    f"<font color='{COLORS['critical'].hexval()}'><b>{cs.critical_deviations_count}</b></font>",
                    self.styles["MetaValue"],
                ),
            ],
            [
                Paragraph("No Conformidades:", self.styles["MetaLabel"]),
                Paragraph(
                    f"{cs.non_compliant_items} (Mayor: {cs.major_deviations_count} · Menor: {cs.minor_deviations_count})",
                    self.styles["MetaValue"],
                ),
                Paragraph("Advertencias Preventivas:", self.styles["MetaLabel"]),
                Paragraph(f"{cs.warning_items} (tolerancia ±10%)", self.styles["MetaValue"]),
            ],
        ]

        col_w = [4.0 * cm, 5.2 * cm, 3.8 * cm, 5.4 * cm]
        t = Table(summary_table_data, colWidths=col_w)
        t.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("BACKGROUND", (0, 0), (-1, -1), status_bg),
                ("BOX", (0, 0), (-1, -1), 1.0, status_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
            ])
        )

        return [
            Paragraph("2. DICTAMEN Y RESUMEN EJECUTIVO DE CUMPLIMIENTO", self.styles["SectionHeading"]),
            t,
        ]

    def _build_items_table(self, data: InspectionReportData) -> List[Any]:
        headers = [
            Paragraph("<b>Cód.</b>", self.styles["TableCellBold"]),
            Paragraph("<b>Punto de Control / Cláusula</b>", self.styles["TableCellBold"]),
            Paragraph("<b>Tipo</b>", self.styles["TableCellBold"]),
            Paragraph("<b>Valor Medido</b>", self.styles["TableCellBold"]),
            Paragraph("<b>Esperado / Rango</b>", self.styles["TableCellBold"]),
            Paragraph("<b>Dictamen</b>", self.styles["TableCellBold"]),
        ]

        rows = [headers]

        for it in data.items:
            # Formatear valor medido
            if it.input_type == "BOOLEAN":
                if it.val_boolean is None:
                    val_str = "<font color='#8b96a0'>Sin evaluar</font>"
                elif it.val_boolean:
                    val_str = "Sí (PASA)"
                else:
                    val_str = "No (FALLA)"
            elif it.input_type == "NUMERIC":
                if it.val_numeric is None:
                    val_str = "<font color='#8b96a0'>Sin evaluar</font>"
                else:
                    val_str = f"<b>{it.val_numeric}</b> {it.unit or ''}"
            else:
                val_str = it.val_text or "<font color='#8b96a0'>Sin texto</font>"

            # Formatear esperado
            if it.input_type == "NUMERIC":
                if it.min_value is not None and it.max_value is not None:
                    exp_str = f"{it.min_value} – {it.max_value} {it.unit or ''}"
                elif it.min_value is not None:
                    exp_str = f"≥ {it.min_value} {it.unit or ''}"
                elif it.max_value is not None:
                    exp_str = f"≤ {it.max_value} {it.unit or ''}"
                else:
                    exp_str = "Reglamentario"
            elif it.input_type == "BOOLEAN":
                exp_str = "Conforme (Sí)"
            else:
                exp_str = "Dato registrado"

            # Badge de dictamen
            if it.compliance_status == "COMPLIANT":
                dictamen = f"<font color='{COLORS['ok'].hexval()}'><b>CONFORME</b></font>"
            elif it.compliance_status == "NON_COMPLIANT":
                if it.severity == "CRITICAL":
                    dictamen = f"<font color='{COLORS['critical'].hexval()}'><b>NO CONF. (CRÍT)</b></font>"
                else:
                    dictamen = f"<font color='{COLORS['critical'].hexval()}'><b>NO CONFORME</b></font>"
            elif it.compliance_status == "WARNING":
                dictamen = f"<font color='{COLORS['warn'].hexval()}'><b>ADVERTENCIA</b></font>"
            else:
                dictamen = "<font color='#8b96a0'>PENDIENTE</font>"

            title_cell = [
                Paragraph(f"<b>{it.title}</b>", self.styles["TableCellBold"]),
                Paragraph(
                    f"<font color='#55636e'>{it.normative_ref}</font>",
                    self.styles["TableCellCode"],
                ),
            ]
            if it.observations:
                title_cell.append(
                    Paragraph(
                        f"<i>Obs: {it.observations}</i>",
                        self.styles["BodySmall"],
                    )
                )

            rows.append([
                Paragraph(it.code, self.styles["TableCellCode"]),
                title_cell,
                Paragraph(it.input_type, self.styles["TableCell"]),
                Paragraph(val_str, self.styles["TableCell"]),
                Paragraph(exp_str, self.styles["TableCell"]),
                Paragraph(dictamen, self.styles["TableCell"]),
            ])

        col_w = [1.5 * cm, 6.5 * cm, 1.8 * cm, 2.8 * cm, 3.2 * cm, 2.6 * cm]
        t = Table(rows, colWidths=col_w, repeatRows=1)

        t_style = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ("BACKGROUND", (0, 0), (-1, 0), COLORS["primary_soft"]),
            ("BOX", (0, 0), (-1, -1), 0.5, COLORS["border"]),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
        ]

        # Alternar color de filas
        for idx in range(1, len(rows)):
            bg = COLORS["surface"] if idx % 2 == 1 else COLORS["white"]
            t_style.append(("BACKGROUND", (0, idx), (-1, idx), bg))

        t.setStyle(TableStyle(t_style))

        return [
            Paragraph("3. DETALLE DE PUNTOS DE CONTROL VERIFICADOS", self.styles["SectionHeading"]),
            t,
        ]

    def _build_deviations_section(
        self, deviations: List[Any]
    ) -> List[Any]:
        rows = [
            [
                Paragraph("<b>Cód.</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Punto Normativo / Referencia</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Severidad</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Detalle del Desvío Constatado</b>", self.styles["TableCellBold"]),
            ]
        ]

        for d in deviations:
            sev_color = (
                COLORS["critical"] if d.severity == "CRITICAL" else COLORS["warn"]
            )
            rows.append([
                Paragraph(d.code, self.styles["TableCellCode"]),
                [
                    Paragraph(f"<b>{d.title}</b>", self.styles["TableCellBold"]),
                    Paragraph(d.normative_ref, self.styles["TableCellCode"]),
                ],
                Paragraph(
                    f"<font color='{sev_color.hexval()}'><b>{d.severity}</b></font>",
                    self.styles["TableCell"],
                ),
                Paragraph(
                    d.deviation_detail or "Desvío respecto a tolerancia reglamentaria.",
                    self.styles["TableCell"],
                ),
            ])

        col_w = [1.5 * cm, 6.0 * cm, 2.5 * cm, 8.4 * cm]
        t = Table(rows, colWidths=col_w, repeatRows=1)
        t.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("BACKGROUND", (0, 0), (-1, 0), COLORS["warn_soft"]),
                ("BOX", (0, 0), (-1, -1), 0.5, COLORS["warn"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
            ])
        )

        return [
            Paragraph(
                "4. NO CONFORMIDADES Y DESVÍOS CRÍTICOS DETECTADOS",
                self.styles["SectionHeading"],
            ),
            t,
        ]

    def _build_evidences_section(self, evidences: List[Any]) -> List[Any]:
        rows = [
            [
                Paragraph("<b>ID</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Tipo</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Identificador de Archivo / Almacenamiento</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Fecha Carga</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Autor</b>", self.styles["TableCellBold"]),
            ]
        ]

        for e in evidences:
            rows.append([
                Paragraph(f"#{e.id}", self.styles["TableCellCode"]),
                Paragraph(e.file_type, self.styles["TableCell"]),
                Paragraph(e.storage_url.split("/")[-1], self.styles["TableCellCode"]),
                Paragraph(e.uploaded_at.strftime("%d/%m/%Y %H:%M"), self.styles["TableCell"]),
                Paragraph(e.uploaded_by or "Inspector", self.styles["TableCell"]),
            ])

        col_w = [1.2 * cm, 2.0 * cm, 9.2 * cm, 3.2 * cm, 2.8 * cm]
        t = Table(rows, colWidths=col_w, repeatRows=1)
        t.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                ("BACKGROUND", (0, 0), (-1, 0), COLORS["surface"]),
                ("BOX", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
            ])
        )

        return [
            Paragraph("5. EVIDENCIAS MULTIMEDIA ADJUNTAS", self.styles["SectionHeading"]),
            t,
        ]

    def _build_normative_currency_section(
        self, nc: Any
    ) -> List[Any]:
        clauses = getattr(nc, "clauses", []) or []
        if not clauses:
            return []

        rows = [
            [
                Paragraph("<b>Referencia</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Norma Raíz</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Estado de Vigencia</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Observación / Reemplazo</b>", self.styles["TableCellBold"]),
            ]
        ]

        for c in clauses:
            is_cur = getattr(c, "is_current", True)
            status_p = (
                f"<font color='{COLORS['ok'].hexval()}'><b>Vigente</b></font>"
                if is_cur
                else f"<font color='{COLORS['warn'].hexval()}'><b>Superada / Derogada</b></font>"
            )
            reemp = (
                f"Sustituida por: {getattr(c, 'suggested_replacement', '')}"
                if not is_cur
                else "Norma de aplicación obligatoria"
            )

            rows.append([
                Paragraph(getattr(c, "referencia_normativa", ""), self.styles["TableCellCode"]),
                Paragraph(getattr(c, "norm_code", ""), self.styles["TableCell"]),
                Paragraph(status_p, self.styles["TableCell"]),
                Paragraph(reemp, self.styles["TableCell"]),
            ])

        col_w = [4.0 * cm, 3.5 * cm, 4.0 * cm, 6.9 * cm]
        t = Table(rows, colWidths=col_w, repeatRows=1)
        t.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                ("BACKGROUND", (0, 0), (-1, 0), COLORS["surface"]),
                ("BOX", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
            ])
        )

        return [
            Paragraph("6. VIGENCIA Y ACTUALIZACIÓN NORMATIVA", self.styles["SectionHeading"]),
            t,
        ]

    def _build_signatures_section(self, data: InspectionReportData) -> List[Any]:
        notes_text = (
            f"«{data.notes}»" if data.notes else "Sin observaciones registradas."
        )

        sig_table_data = [
            [
                Paragraph("<b>OBSERVACIONES GENERALES:</b>", self.styles["MetaLabel"]),
                Paragraph("<b>FIRMA Y SELLO TÉCNICO:</b>", self.styles["MetaLabel"]),
            ],
            [
                Paragraph(notes_text, self.styles["Body"]),
                Paragraph(
                    f"<br/><br/>________________________________________<br/>"
                    f"<b>{data.inspector_name}</b><br/>"
                    f"Bioingeniería / Inspector Técnico Responsable<br/>"
                    f"Matrícula Profesional / Dirección de Tecnología Médica",
                    self.styles["BodySmall"],
                ),
            ],
        ]

        col_w = [9.4 * cm, 9.0 * cm]
        t = Table(sig_table_data, colWidths=col_w)
        t.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("BOX", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                ("BACKGROUND", (0, 0), (-1, -1), COLORS["surface"]),
            ])
        )

        return [
            KeepTogether([
                Paragraph("7. OBSERVACIONES FINALES Y DICTAMEN DE CIERRE", self.styles["SectionHeading"]),
                t,
            ])
        ]

    def _build_audit_trail_section(self, audit: List[Any]) -> List[Any]:
        rows = [
            [
                Paragraph("<b>Evento</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Actor</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Fecha y Hora</b>", self.styles["TableCellBold"]),
            ]
        ]

        for a in audit[-5:]:  # Mostrar últimos 5 eventos
            rows.append([
                Paragraph(a.event_type, self.styles["TableCellCode"]),
                Paragraph(a.actor, self.styles["TableCell"]),
                Paragraph(a.created_at.strftime("%d/%m/%Y %H:%M:%S"), self.styles["TableCell"]),
            ])

        col_w = [8.4 * cm, 5.0 * cm, 5.0 * cm]
        t = Table(rows, colWidths=col_w)
        t.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("BACKGROUND", (0, 0), (-1, 0), COLORS["surface"]),
                ("BOX", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
            ])
        )

        return [
            KeepTogether([
                Paragraph("8. BITÁCORA INMUTABLE DE TRAZABILIDAD (AUDIT TRAIL)", self.styles["SectionHeading"]),
                t,
            ])
        ]


class AssetHistoryPDFGenerator:
    """Generador del Informe Histórico de un Activo Clínico."""

    def __init__(self):
        self.styles = get_report_styles()

    def generate(self, data: AssetHistoryReportData) -> BytesIO:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=PAGE_MARGIN,
            rightMargin=PAGE_MARGIN,
            topMargin=1.6 * cm,
            bottomMargin=1.6 * cm,
        )

        story = [
            Paragraph("INFORME HISTÓRICO DE COMPONENTE", self.styles["DocTitle"]),
            Paragraph(
                f"Trazabilidad Técnica y Evolución de Cumplimiento · {data.asset_name} ({data.asset_tag})",
                self.styles["DocSubtitle"],
            ),
            HRFlowable(
                width="100%",
                thickness=1.5,
                color=COLORS["primary"],
                spaceBefore=1,
                spaceAfter=8,
            ),
        ]

        # Resumen del Activo
        meta_table = [
            [
                Paragraph("Hospital / Sector:", self.styles["MetaLabel"]),
                Paragraph(f"{data.hospital_name} · {data.sector_name}", self.styles["MetaValue"]),
                Paragraph("Estado Operativo:", self.styles["MetaLabel"]),
                Paragraph("Operativo" if data.is_active else "Inactivo", self.styles["MetaValue"]),
            ],
            [
                Paragraph("Tipo de Activo:", self.styles["MetaLabel"]),
                Paragraph(data.asset_type, self.styles["MetaValue"]),
                Paragraph("Cumplimiento Promedio:", self.styles["MetaLabel"]),
                Paragraph(f"<b>{data.average_compliance_percentage:.1f}%</b>", self.styles["MetaValue"]),
            ],
            [
                Paragraph("Inspecciones Totales:", self.styles["MetaLabel"]),
                Paragraph(f"{data.total_inspections} ({data.completed_inspections} cerradas)", self.styles["MetaValue"]),
                Paragraph("Última Inspección:", self.styles["MetaLabel"]),
                Paragraph(
                    data.last_inspection_date.strftime("%d/%m/%Y")
                    if data.last_inspection_date
                    else "Sin registros",
                    self.styles["MetaValue"],
                ),
            ],
        ]

        col_w = [4.0 * cm, 5.2 * cm, 4.0 * cm, 5.2 * cm]
        t_meta = Table(meta_table, colWidths=col_w)
        t_meta.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                ("BACKGROUND", (0, 0), (-1, -1), COLORS["surface"]),
                ("BOX", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
            ])
        )

        story.append(Paragraph("1. FICHA TÉCNICA DEL COMPONENTE", self.styles["SectionHeading"]))
        story.append(t_meta)
        story.append(Spacer(1, 12))

        # Tabla Cronológica de Inspecciones
        story.append(Paragraph("2. LÍNEA DE TIEMPO DE INSPECCIONES", self.styles["SectionHeading"]))

        if not data.history_entries:
            story.append(Paragraph("No se registran inspecciones históricas para este equipo.", self.styles["Body"]))
        else:
            h_rows = [
                [
                    Paragraph("<b>ID</b>", self.styles["TableCellBold"]),
                    Paragraph("<b>Fecha</b>", self.styles["TableCellBold"]),
                    Paragraph("<b>Inspector</b>", self.styles["TableCellBold"]),
                    Paragraph("<b>Protocolo</b>", self.styles["TableCellBold"]),
                    Paragraph("<b>Cumplimiento</b>", self.styles["TableCellBold"]),
                    Paragraph("<b>Desvíos</b>", self.styles["TableCellBold"]),
                ]
            ]
            for ent in data.history_entries:
                pct = ent["compliance_percentage"]
                pct_str = (
                    f"<font color='{COLORS['ok'].hexval()}'><b>{pct}%</b></font>"
                    if pct >= 100
                    else f"<font color='{COLORS['warn'].hexval()}'><b>{pct}%</b></font>"
                )
                h_rows.append([
                    Paragraph(f"#{ent['id']}", self.styles["TableCellCode"]),
                    Paragraph(ent["started_at"], self.styles["TableCell"]),
                    Paragraph(ent["inspector_name"], self.styles["TableCell"]),
                    Paragraph(ent["template_title"], self.styles["TableCell"]),
                    Paragraph(pct_str, self.styles["TableCell"]),
                    Paragraph(f"{ent['non_compliant_count']} desvíos", self.styles["TableCell"]),
                ])

            col_w_h = [1.5 * cm, 3.2 * cm, 4.2 * cm, 4.5 * cm, 2.5 * cm, 2.5 * cm]
            t_hist = Table(h_rows, colWidths=col_w_h, repeatRows=1)
            t_hist.setStyle(
                TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("BACKGROUND", (0, 0), (-1, 0), COLORS["primary_soft"]),
                    ("BOX", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                ])
            )
            story.append(t_hist)

        story.append(Spacer(1, 12))

        # Desvíos Recurrentes
        if data.recurrent_deviations:
            story.append(
                Paragraph(
                    "3. ANÁLISIS DE NO CONFORMIDADES RECURRENTES",
                    self.styles["SectionHeading"],
                )
            )
            rec_rows = [
                [
                    Paragraph("<b>Referencia Normativa</b>", self.styles["TableCellBold"]),
                    Paragraph("<b>Frecuencia</b>", self.styles["TableCellBold"]),
                    Paragraph("<b>Severidad</b>", self.styles["TableCellBold"]),
                    Paragraph("<b>Último Desvío Registrado</b>", self.styles["TableCellBold"]),
                ]
            ]
            for r in data.recurrent_deviations:
                rec_rows.append([
                    Paragraph(r["normative_ref"], self.styles["TableCellCode"]),
                    Paragraph(f"{r['count']} veces", self.styles["TableCellBold"]),
                    Paragraph(r["severity"], self.styles["TableCell"]),
                    Paragraph(r["last_detail"], self.styles["TableCell"]),
                ])

            col_w_r = [4.5 * cm, 2.5 * cm, 2.5 * cm, 8.9 * cm]
            t_rec = Table(rec_rows, colWidths=col_w_r, repeatRows=1)
            t_rec.setStyle(
                TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("BACKGROUND", (0, 0), (-1, 0), COLORS["warn_soft"]),
                    ("BOX", (0, 0), (-1, -1), 0.5, COLORS["warn"]),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                ])
            )
            story.append(t_rec)

        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer


class ExecutivePDFGenerator:
    """Generador del Informe Ejecutivo Institucional de Calidad y Cumplimiento Normativo."""

    def __init__(self):
        self.styles = get_report_styles()

    def generate(self, data: ExecutiveReportData) -> BytesIO:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=PAGE_MARGIN,
            rightMargin=PAGE_MARGIN,
            topMargin=1.6 * cm,
            bottomMargin=1.6 * cm,
        )

        now_str = data.generated_at.strftime("%d/%m/%Y %H:%M")

        story = [
            Paragraph("INFORME EJECUTIVO DE CUMPLIMIENTO NORMATIVO", self.styles["DocTitle"]),
            Paragraph(
                f"Auditoría Global de Redes de Gases Medicinales · {data.hospital_name} ({data.hospital_code}) · {now_str} hs",
                self.styles["DocSubtitle"],
            ),
            HRFlowable(
                width="100%",
                thickness=1.5,
                color=COLORS["primary"],
                spaceBefore=1,
                spaceAfter=8,
            ),
        ]

        # 1. KPIs Globales
        kpi_table = [
            [
                Paragraph("<b>Sectores Monitoreados:</b>", self.styles["TableCell"]),
                Paragraph(str(data.total_sectors), self.styles["TableCellBold"]),
                Paragraph("<b>Total de Activos:</b>", self.styles["TableCell"]),
                Paragraph(f"{data.total_assets} ({data.active_assets} operativos)", self.styles["TableCellBold"]),
            ],
            [
                Paragraph("<b>Inspecciones Totales:</b>", self.styles["TableCell"]),
                Paragraph(
                    f"{data.total_inspections} ({data.completed_inspections} cerradas)",
                    self.styles["TableCellBold"],
                ),
                Paragraph("<b>Cumplimiento Global:</b>", self.styles["TableCell"]),
                Paragraph(f"<b>{data.global_compliance_percentage:.1f}%</b>", self.styles["TableCellBold"]),
            ],
        ]

        col_w = [4.5 * cm, 4.7 * cm, 4.5 * cm, 4.7 * cm]
        t_kpi = Table(kpi_table, colWidths=col_w)
        t_kpi.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("BACKGROUND", (0, 0), (-1, -1), COLORS["primary_soft"]),
                ("BOX", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
            ])
        )

        story.append(Paragraph("1. INDICADORES CLAVE DE GESTIÓN (KPIS)", self.styles["SectionHeading"]))
        story.append(t_kpi)
        story.append(Spacer(1, 10))

        # 2. Cumplimiento por Sector
        story.append(Paragraph("2. ESTADO DE CUMPLIMIENTO POR SECTOR CLÍNICO", self.styles["SectionHeading"]))
        sec_rows = [
            [
                Paragraph("<b>Sector</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Piso / Nivel</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Activos</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Auditorías</b>", self.styles["TableCellBold"]),
                Paragraph("<b>% Cumplimiento</b>", self.styles["TableCellBold"]),
            ]
        ]
        for s in data.sector_stats:
            pct = s["compliance_percentage"]
            pct_p = (
                f"<font color='{COLORS['ok'].hexval()}'><b>{pct}%</b></font>"
                if pct >= 100
                else f"<font color='{COLORS['warn'].hexval()}'><b>{pct}%</b></font>"
            )
            sec_rows.append([
                Paragraph(s["sector_name"], self.styles["TableCellBold"]),
                Paragraph(s["floor_level"], self.styles["TableCell"]),
                Paragraph(str(s["total_assets"]), self.styles["TableCell"]),
                Paragraph(f"{s['completed_inspections']} / {s['total_inspections']}", self.styles["TableCell"]),
                Paragraph(pct_p, self.styles["TableCell"]),
            ])

        col_w_s = [5.5 * cm, 3.0 * cm, 2.5 * cm, 3.4 * cm, 4.0 * cm]
        t_sec = Table(sec_rows, colWidths=col_w_s, repeatRows=1)
        t_sec.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("BACKGROUND", (0, 0), (-1, 0), COLORS["surface"]),
                ("BOX", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
            ])
        )
        story.append(t_sec)
        story.append(Spacer(1, 10))

        # 3. Cumplimiento por Tipo de Activo
        story.append(Paragraph("3. CUMPLIMIENTO POR FAMILIA DE COMPONENTE", self.styles["SectionHeading"]))
        type_rows = [
            [
                Paragraph("<b>Tipo de Activo</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Cantidad Instalada</b>", self.styles["TableCellBold"]),
                Paragraph("<b>Auditorías</b>", self.styles["TableCellBold"]),
                Paragraph("<b>% Cumplimiento</b>", self.styles["TableCellBold"]),
            ]
        ]
        for t_info in data.asset_type_stats:
            pct = t_info["compliance_percentage"]
            pct_p = (
                f"<font color='{COLORS['ok'].hexval()}'><b>{pct}%</b></font>"
                if pct >= 100
                else f"<font color='{COLORS['warn'].hexval()}'><b>{pct}%</b></font>"
            )
            type_rows.append([
                Paragraph(t_info["asset_type"], self.styles["TableCellBold"]),
                Paragraph(str(t_info["total_assets"]), self.styles["TableCell"]),
                Paragraph(str(t_info["total_inspections"]), self.styles["TableCell"]),
                Paragraph(pct_p, self.styles["TableCell"]),
            ])

        col_w_t = [7.0 * cm, 3.8 * cm, 3.6 * cm, 4.0 * cm]
        t_types = Table(type_rows, colWidths=col_w_t, repeatRows=1)
        t_types.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("BACKGROUND", (0, 0), (-1, 0), COLORS["surface"]),
                ("BOX", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
            ])
        )
        story.append(t_types)
        story.append(Spacer(1, 10))

        # 4. Top Activos con No Conformidades (Riesgo Técnico)
        if data.top_risk_assets:
            story.append(
                Paragraph(
                    "4. COMPONENTES CON MAYOR ÍNDICE DE NO CONFORMIDAD (PRIORIDAD DE MANTENIMIENTO)",
                    self.styles["SectionHeading"],
                )
            )
            risk_rows = [
                [
                    Paragraph("<b>TAG</b>", self.styles["TableCellBold"]),
                    Paragraph("<b>Componente</b>", self.styles["TableCellBold"]),
                    Paragraph("<b>Sector</b>", self.styles["TableCellBold"]),
                    Paragraph("<b>Desvíos Críticos</b>", self.styles["TableCellBold"]),
                    Paragraph("<b>Total Desvíos</b>", self.styles["TableCellBold"]),
                ]
            ]
            for r in data.top_risk_assets:
                crit_str = (
                    f"<font color='{COLORS['critical'].hexval()}'><b>{r['critical_count']}</b></font>"
                    if r["critical_count"] > 0
                    else "0"
                )
                risk_rows.append([
                    Paragraph(r["tag_code"], self.styles["TableCellCode"]),
                    Paragraph(r["asset_name"], self.styles["TableCellBold"]),
                    Paragraph(r["sector_name"], self.styles["TableCell"]),
                    Paragraph(crit_str, self.styles["TableCell"]),
                    Paragraph(f"<b>{r['non_compliant_count']}</b>", self.styles["TableCell"]),
                ])

            col_w_r = [2.8 * cm, 5.8 * cm, 4.0 * cm, 3.0 * cm, 2.8 * cm]
            t_risk = Table(risk_rows, colWidths=col_w_r, repeatRows=1)
            t_risk.setStyle(
                TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("BACKGROUND", (0, 0), (-1, 0), COLORS["warn_soft"]),
                    ("BOX", (0, 0), (-1, -1), 0.5, COLORS["warn"]),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, COLORS["border"]),
                ])
            )
            story.append(t_risk)

        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer
