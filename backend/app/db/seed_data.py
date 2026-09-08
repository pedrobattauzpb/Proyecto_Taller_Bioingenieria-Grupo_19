import asyncio
from sqlalchemy import select
from datetime import date
from app.core.database import AsyncSessionLocal
from app.models.hierarchy import Hospital, Sector, Asset, AssetType
from app.models.checklist import ChecklistTemplate, ChecklistItem, ItemType
from app.models.compliance import NormativeReference, NormativeVersion


async def seed_normative_catalog(db):
    """Siembra el catálogo de normas legales y técnicas (ISO 7396-1, Res 1130/2000, IRAM 2529)"""
    existing_norm = await db.execute(select(NormativeReference))
    if existing_norm.scalars().first():
        return

    print("INFO: Sembrando catálogo de normativas y versiones vigentes...")

    # 1. ISO 7396-1:2016
    iso_norm = NormativeReference(
        code="ISO 7396-1:2016",
        title="Sistemas de distribución de gases medicinales — Parte 1: Redes de tuberías para gases medicinales comprimidos y de vacío",
        issuing_body="International Organization for Standardization (ISO)",
        publication_date=date(2016, 3, 1),
        current_version="2016",
        is_current=True,
        description="Estándar internacional para redes de gases medicinales, manifolds centrales, válvulas AVSU y tomas terminales.",
        url_reference="https://www.iso.org/standard/60907.html"
    )
    db.add(iso_norm)
    await db.flush()

    iso_v1 = NormativeVersion(
        reference_id=iso_norm.id,
        version_code="2016",
        effective_date=date(2016, 3, 1),
        changelog="Publicación de la versión consolidada 2016 para distribución hospitalaria de gases.",
        is_active=True
    )
    db.add(iso_v1)

    # 2. Resolución MSAL 1130/2000
    res_msal = NormativeReference(
        code="Res1130/2000",
        title="Buenas Prácticas de Fabricación y Control de Gases Medicinales",
        issuing_body="Ministerio de Salud de la Nación Argentina (MSAL)",
        publication_date=date(2000, 11, 28),
        current_version="2000",
        is_current=True,
        description="Regulación federal obligatoria para envases de gases medicinales, identificación con cruz griega verde, rotulación y pruebas periódicas.",
        url_reference="http://servicios.infoleg.gob.ar/infolegInternet/anexos/65000-69999/65385/norma.htm"
    )
    db.add(res_msal)
    await db.flush()

    res_v1 = NormativeVersion(
        reference_id=res_msal.id,
        version_code="2000",
        effective_date=date(2000, 11, 28),
        changelog="Aprobación e implementación de directrices de buenas prácticas en la República Argentina.",
        is_active=True
    )
    db.add(res_v1)

    # 3. Norma IRAM 2529 (Cilindros de acero sin costura - Ensayo periódico)
    iram_norm = NormativeReference(
        code="IRAM 2529",
        title="Cilindros de acero sin costura para gases comprimidos y licuados. Inspección periódica y ensayo a presión hidrostática",
        issuing_body="Instituto Argentino de Normalización y Certificación (IRAM)",
        publication_date=date(2013, 5, 15),
        current_version="2013",
        is_current=True,
        description="Regulación técnica de validez de prueba hidráulica (máx 5 años) para cilindros de alta presión.",
        url_reference="https://comprasonline.iram.org.ar"
    )
    db.add(iram_norm)
    await db.flush()

    iram_v1 = NormativeVersion(
        reference_id=iram_norm.id,
        version_code="2013",
        effective_date=date(2013, 5, 15),
        changelog="Actualización de métodos de inspección visual y prueba de expansión volumétrica.",
        is_active=True
    )
    db.add(iram_v1)

    # 4. Norma histórica superada para demostrar chequeo de vigencia (ISO 7396:2007)
    iso_old = NormativeReference(
        code="ISO 7396-1:2007",
        title="Medical gas pipeline systems — Part 1: Pipeline systems for compressed medical gases and vacuum (Superada)",
        issuing_body="International Organization for Standardization (ISO)",
        publication_date=date(2007, 7, 1),
        current_version="2007",
        is_current=False,
        superseded_by_id=iso_norm.id,
        description="Edición anterior sustituida por la revisión ISO 7396-1:2016.",
        url_reference="https://www.iso.org/standard/38072.html"
    )
    db.add(iso_old)
    await db.flush()

    iso_old_v1 = NormativeVersion(
        reference_id=iso_old.id,
        version_code="2007",
        effective_date=date(2007, 7, 1),
        expiry_date=date(2016, 2, 29),
        changelog="Reemplazada formalmente por la edición 2016.",
        is_active=False
    )
    db.add(iso_old_v1)


async def seed_database():
    async with AsyncSessionLocal() as db:
        # Sembrar catálogo normativo siempre si no existe
        await seed_normative_catalog(db)

        # Verificar si ya existen hospitales
        check_hospital = await db.execute(select(Hospital))
        if check_hospital.scalars().first():
            await db.commit()
            print("INFO: La base de datos ya contiene registros clínicos. Catálogo normativo verificado.")
            return


        print("INFO: Sembrando jerarquía hospitalaria y normativas (Res. 1130/2000 e ISO 7396-1)...")

        # 1. Hospital
        hospital = Hospital(
            name="Hospital de Alta Complejidad Dr. Arturo Oñativia",
            code="HAC-AO-01",
            address="Av. Pres. Dr. Arturo Illia 2550, CABA"
        )
        db.add(hospital)
        await db.flush()

        # 2. Sectores
        sec_manifold = Sector(
            hospital_id=hospital.id,
            name="Manifold Central de Gases Medicinales",
            floor_level="Subsuelo - Sala de Máquinas"
        )
        sec_uti = Sector(
            hospital_id=hospital.id,
            name="Unidad de Terapia Intensiva (UTI Adultos)",
            floor_level="Piso 2 - Ala Norte"
        )
        sec_qx = Sector(
            hospital_id=hospital.id,
            name="Quirófanos Centrales (Pabellón A)",
            floor_level="Piso 3 - Bloque Quirúrgico"
        )
        sec_guardia = Sector(
            hospital_id=hospital.id,
            name="Guardia y Emergencias Médicas",
            floor_level="Planta Baja - Sector Trauma"
        )
        db.add_all([sec_manifold, sec_uti, sec_qx, sec_guardia])
        await db.flush()

        # 3. Activos
        assets = [
            Asset(
                sector_id=sec_manifold.id,
                tag_code="MAN-O2-01",
                name="Manifold Central O2 Principal (Batería 2x10)",
                asset_type=AssetType.MANIFOLD,
                is_active=True
            ),
            Asset(
                sector_id=sec_manifold.id,
                tag_code="MAN-N2O-01",
                name="Manifold Secundario Óxido Nitroso (Batería 2x4)",
                asset_type=AssetType.MANIFOLD,
                is_active=True
            ),
            Asset(
                sector_id=sec_uti.id,
                tag_code="AVSU-UTI-01",
                name="Válvula de Corte AVSU - Módulo UTI Camas 1-12",
                asset_type=AssetType.AVSU_VALVE,
                is_active=True
            ),
            Asset(
                sector_id=sec_qx.id,
                tag_code="AVSU-QX-01",
                name="Válvula de Corte AVSU - Quirófano 1 y 2",
                asset_type=AssetType.AVSU_VALVE,
                is_active=True
            ),
            Asset(
                sector_id=sec_uti.id,
                tag_code="BOCA-UTI-01",
                name="Boca Terminal O2 / Aire / Vacío - Cama 01 UTI",
                asset_type=AssetType.TERMINAL_UNIT,
                is_active=True
            ),
            Asset(
                sector_id=sec_qx.id,
                tag_code="BOCA-QX-01",
                name="Columna Quirúrgica de Tomas Gases - Quirófano 01",
                asset_type=AssetType.TERMINAL_UNIT,
                is_active=True
            ),
            Asset(
                sector_id=sec_manifold.id,
                tag_code="REG-O2-01",
                name="Regulador 2da Etapa Red O2 - 4.5 bar",
                asset_type=AssetType.PRESSURE_REGULATOR,
                is_active=True
            ),
            Asset(
                sector_id=sec_manifold.id,
                tag_code="REG-VAC-01",
                name="Unidad Reguladora Central Vacío - 0.7 bar",
                asset_type=AssetType.PRESSURE_REGULATOR,
                is_active=True
            ),
            # Activos de Cilindros / Envases (Res. 1130/2000)
            Asset(
                sector_id=sec_manifold.id,
                tag_code="CIL-O2-B01",
                name="Cilindro O2 Reserva 50L (Rampa Auxiliar Manifold)",
                asset_type=AssetType.GAS_CYLINDER,
                is_active=True
            ),
            Asset(
                sector_id=sec_guardia.id,
                tag_code="CIL-O2-PORT-01",
                name="Tubo O2 Portátil 10L - Traslado UTI/Guardia",
                asset_type=AssetType.GAS_CYLINDER,
                is_active=True
            ),
            Asset(
                sector_id=sec_manifold.id,
                tag_code="CIL-N2O-B01",
                name="Cilindro N2O 50L - Rampa Manifold Quirúrgico",
                asset_type=AssetType.GAS_CYLINDER,
                is_active=True
            ),
        ]
        db.add_all(assets)
        await db.flush()

        # 4. Plantillas de Checklist con Trazabilidad Normativa
        # --- Plantilla 1: MANIFOLD (ISO 7396-1 cl. 5 y 6) ---
        tmpl_manifold = ChecklistTemplate(
            title="Inspección de Seguridad y Operatividad de Manifolds de Gases Medicinales",
            asset_type=AssetType.MANIFOLD,
            version="1.0",
            description="Protocolo técnico para manifolds de suministro centralizado conforme a ISO 7396-1:cl.5/6.",
            is_active=True
        )
        db.add(tmpl_manifold)
        await db.flush()

        items_manifold = [
            ChecklistItem(
                template_id=tmpl_manifold.id,
                order_index=1,
                code="MAN-01",
                title="Presión de línea de suministro en colector principal",
                description="Verificar la presión manométrica en el colector de salida a la red hospitalaria.",
                input_type=ItemType.NUMERIC,
                unit="bar",
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.5.3",
                min_value=4.0,
                max_value=5.5
            ),
            ChecklistItem(
                template_id=tmpl_manifold.id,
                order_index=2,
                code="MAN-02",
                title="Inversión automática de rampa en servicio a reserva operativa",
                description="Comprobar el funcionamiento del mecanismo de conmutación automática entre bancadas.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.5.4"
            ),
            ChecklistItem(
                template_id=tmpl_manifold.id,
                order_index=3,
                code="MAN-03",
                title="Verificación de alarmas ópticas y acústicas de presión baja",
                description="Simular disparo de alarma de baja presión en cuadro centralizado y verificar repetidor.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.6.2"
            ),
            ChecklistItem(
                template_id=tmpl_manifold.id,
                order_index=4,
                code="MAN-04",
                title="Hermeticidad y ausencia de fugas en racores y flexibles de alta presión",
                description="Inspección con detector de fugas o solución tensioactiva aprobada en uniones de alta presión.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.5.7"
            ),
            ChecklistItem(
                template_id=tmpl_manifold.id,
                order_index=5,
                code="MAN-05",
                title="Señalización de advertencia e identificación cromática",
                description="Presencia de cartelería de seguridad, símbolo de no fumar y colores normalizados por gas.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=False,
                referencia_normativa="ISO 7396-1:cl.5.9"
            ),
        ]
        db.add_all(items_manifold)

        # --- Plantilla 2: AVSU_VALVE (ISO 7396-1 cl. 8) ---
        tmpl_avsu = ChecklistTemplate(
            title="Inspección de Válvulas de Corte de Área (AVSU)",
            asset_type=AssetType.AVSU_VALVE,
            version="1.0",
            description="Evaluación de módulos AVSU de sectorización y emergencia bajo norma ISO 7396-1:cl.8.",
            is_active=True
        )
        db.add(tmpl_avsu)
        await db.flush()

        items_avsu = [
            ChecklistItem(
                template_id=tmpl_avsu.id,
                order_index=1,
                code="AVSU-01",
                title="Libre acceso, visibilidad y caja de protección",
                description="Verificar que la caja AVSU esté libre de obstrucciones, limpia y sin candados que impidan apertura rápida.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.8.2"
            ),
            ChecklistItem(
                template_id=tmpl_avsu.id,
                order_index=2,
                code="AVSU-02",
                title="Rotulación indeleble con identificación de gas y área",
                description="Etiquetado claro del gas medicinal y lista de camas/quirófanos que dependen de la válvula.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.8.3"
            ),
            ChecklistItem(
                template_id=tmpl_avsu.id,
                order_index=3,
                code="AVSU-03",
                title="Presión manométrica aguas abajo dentro de rango nominal",
                description="Lectura del manómetro físico de la caja AVSU para la línea de distribución.",
                input_type=ItemType.NUMERIC,
                unit="bar",
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.8.5",
                min_value=4.0,
                max_value=5.0
            ),
            ChecklistItem(
                template_id=tmpl_avsu.id,
                order_index=4,
                code="AVSU-04",
                title="Prueba de accionamiento de palanca y estanqueidad",
                description="Comprobar giro suave de 90° de la válvula esférica y ausencia de pérdidas por el vástago.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.8.6"
            ),
        ]
        db.add_all(items_avsu)

        # --- Plantilla 3: TERMINAL_UNIT (ISO 7396-1 cl. 11) ---
        tmpl_tu = ChecklistTemplate(
            title="Inspección de Bocas Terminales y Tomas Rápidas",
            asset_type=AssetType.TERMINAL_UNIT,
            version="1.0",
            description="Verificación de tomas de pared y columnas de gases conforme a ISO 7396-1:cl.11.",
            is_active=True
        )
        db.add(tmpl_tu)
        await db.flush()

        items_tu = [
            ChecklistItem(
                template_id=tmpl_tu.id,
                order_index=1,
                code="TU-01",
                title="Identificación inequívoca por código de forma y color",
                description="Código específico no intercambiable (DISS/NIST/DIN) y color normalizado del gas medicinal.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.11.2"
            ),
            ChecklistItem(
                template_id=tmpl_tu.id,
                order_index=2,
                code="TU-02",
                title="Prueba de inserción mecánica y retención segura",
                description="Conectar conector macho de prueba; debe trabar con un solo clic y no desacoplarse bajo tracción.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.11.4"
            ),
            ChecklistItem(
                template_id=tmpl_tu.id,
                order_index=3,
                code="TU-03",
                title="Estanqueidad y fuga nula en reposo y acoplado",
                description="Verificación con tapón de estanqueidad sin caída de presión audible ni detectada.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.11.5"
            ),
            ChecklistItem(
                template_id=tmpl_tu.id,
                order_index=4,
                code="TU-04",
                title="Presión estática disponible en punto de consumo",
                description="Medición con manómetro calibrado acoplado a la toma.",
                input_type=ItemType.NUMERIC,
                unit="bar",
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.11.7",
                min_value=3.8,
                max_value=5.2
            ),
        ]
        db.add_all(items_tu)

        # --- Plantilla 4: PRESSURE_REGULATOR (ISO 7396-1 cl. 7) ---
        tmpl_reg = ChecklistTemplate(
            title="Inspección de Unidades de Regulación de Presión",
            asset_type=AssetType.PRESSURE_REGULATOR,
            version="1.0",
            description="Control de etapas reductoras y de alivio conforme a ISO 7396-1:cl.7.",
            is_active=True
        )
        db.add(tmpl_reg)
        await db.flush()

        items_reg = [
            ChecklistItem(
                template_id=tmpl_reg.id,
                order_index=1,
                code="REG-01",
                title="Presión primaria de entrada desde banco de cilindros",
                description="Lectura del manómetro de alta presión de entrada.",
                input_type=ItemType.NUMERIC,
                unit="bar",
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.7.2",
                min_value=15.0,
                max_value=200.0
            ),
            ChecklistItem(
                template_id=tmpl_reg.id,
                order_index=2,
                code="REG-02",
                title="Presión secundaria de salida a red de distribución",
                description="Lectura de presión estabilizada hacia la red hospitalaria.",
                input_type=ItemType.NUMERIC,
                unit="bar",
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.7.3",
                min_value=4.0,
                max_value=5.0
            ),
            ChecklistItem(
                template_id=tmpl_reg.id,
                order_index=3,
                code="REG-03",
                title="Válvula de alivio y seguridad contra sobrepresión",
                description="Inspección visual de precinto y tobera de venteo libre de suciedad.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="ISO 7396-1:cl.7.5"
            ),
            ChecklistItem(
                template_id=tmpl_reg.id,
                order_index=4,
                code="REG-04",
                title="Ausencia de escarcha o enfriamiento crítico en cuerpo",
                description="Verificar que el caudal no genere congelamiento del diafragma regulador.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=False,
                referencia_normativa="ISO 7396-1:cl.7.8"
            ),
        ]
        db.add_all(items_reg)

        # --- Plantilla 5: GAS_CYLINDER (Res. MSAL 1130/2000 cl. 1.2.2) [AJUSTE] ---
        tmpl_cyl = ChecklistTemplate(
            title="Control de Seguridad de Envases y Cilindros de Gases Medicinales",
            asset_type=AssetType.GAS_CYLINDER,
            version="1.0",
            description="Protocolo de inspección de envases a presión según Resolución MSAL 1130/2000 sección 1.2.2.",
            is_active=True
        )
        db.add(tmpl_cyl)
        await db.flush()

        items_cyl = [
            ChecklistItem(
                template_id=tmpl_cyl.id,
                order_index=1,
                code="CIL-01",
                title="Identificación visual con cruz griega verde y código de color",
                description="Presencia obligatoria de la cruz griega verde indeleble y color normalizado del gas en ojiva y cuerpo.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="Res1130/2000:1.2.2.a"
            ),
            ChecklistItem(
                template_id=tmpl_cyl.id,
                order_index=2,
                code="CIL-02",
                title="Integridad del envase: ausencia de deformaciones, quemaduras, aceite o grasa",
                description="Superficie exterior sin abolladuras, corrosión profunda, contacto con hidrocarburos o grasas.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="Res1130/2000:1.2.2.b"
            ),
            ChecklistItem(
                template_id=tmpl_cyl.id,
                order_index=3,
                code="CIL-03",
                title="Prueba hidráulica periódica dentro de vigencia",
                description="Verificar cuño de prueba hidráulica (IRAM 2529) con fecha dentro del período reglamentario (máx. 5 años).",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="Res1130/2000:1.2.2.b"
            ),
            ChecklistItem(
                template_id=tmpl_cyl.id,
                order_index=4,
                code="CIL-04",
                title="Rotulado crítico: nombre genérico, lote, vencimiento y leyenda médica",
                description="Etiqueta reglamentaria con nombre del gas, pureza, lote, vencimiento y leyenda 'Uso Exclusivo Medicinal'.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="Res1130/2000:1.2.2.c"
            ),
            ChecklistItem(
                template_id=tmpl_cyl.id,
                order_index=5,
                code="CIL-05",
                title="Seguridad de conexiones: válvula específica no intercambiable y precinto",
                description="Válvula reglamentaria para el gas sin adaptadores no autorizados y precinto termocontraíble intacto.",
                input_type=ItemType.BOOLEAN,
                is_mandatory=True,
                referencia_normativa="Res1130/2000:1.2.2.d"
            ),
            ChecklistItem(
                template_id=tmpl_cyl.id,
                order_index=6,
                code="CIL-06",
                title="Presión manométrica de carga remanente",
                description="Lectura de presión en manómetro de rampa o regulador acoplado al cilindro.",
                input_type=ItemType.NUMERIC,
                unit="bar",
                is_mandatory=True,
                referencia_normativa="Res1130/2000:1.2.2.c",
                min_value=50.0,
                max_value=200.0
            ),
        ]
        db.add_all(items_cyl)

        await db.commit()
        print("INFO: Seed completado exitosamente con 1 Hospital, 4 Sectores, 11 Activos y 5 Plantillas normativas.")


if __name__ == "__main__":
    asyncio.run(seed_database())
