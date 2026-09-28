"""
Motor de Reportes Automáticos de Inspección y Cumplimiento Normativo (Objetivo Específico 4).
Generación de Actas Técnicas en PDF, informes históricos de componentes y resúmenes ejecutivos.
"""

from .pdf_generator import InspectionPDFGenerator, AssetHistoryPDFGenerator, ExecutivePDFGenerator
from .excel_generator import InspectionExcelGenerator, ExecutiveExcelGenerator
from .data_assembler import (
    assemble_inspection_report_data,
    assemble_asset_history_report_data,
    assemble_executive_report_data,
)

__all__ = [
    "InspectionPDFGenerator",
    "AssetHistoryPDFGenerator",
    "ExecutivePDFGenerator",
    "InspectionExcelGenerator",
    "ExecutiveExcelGenerator",
    "assemble_inspection_report_data",
    "assemble_asset_history_report_data",
    "assemble_executive_report_data",
]
