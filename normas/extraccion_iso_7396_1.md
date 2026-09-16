# MATRIZ DE AUDITORÍA TÉCNICA E INSPECCIÓN NORMATIVA
## SISTEMAS DE TUBERÍAS PARA GASES MEDICINALES COMPRIMIDOS Y VACÍO
### Basado exhaustivamente en la Norma Internacional ISO 7396-1:2007 (IS/ISO 7396-1:2007)

---

## 1. INTRODUCCIÓN Y ENFOQUE DE INGENIERÍA CLÍNICA

El presente documento constituye el desglose técnico exhaustivo de todos los parámetros de control, verificación, medición y validación operacional requeridos por la norma **ISO 7396-1:2007** (*Medical gas pipeline systems — Part 1: Pipeline systems for compressed medical gases and vacuum*). 

Este compendio está diseñado para ser implementado como el **motor de reglas y validaciones de campo** en un software/aplicativo móvil de auditoría e inspección técnica para ingenieros biomédicos, ingenieros clínicos y auditores de infraestructura hospitalaria.

### 1.1 Metodología de Clasificación de Criticidad STPA (Systems-Theoretic Process Analysis)
Cada ítem auditable ha sido evaluado bajo la óptica de seguridad funcional y análisis de peligros en sistemas clínicos:
* **Nivel 1 (Crítico / Catastrófico):** Fallo directo sobre el soporte vital del paciente o riesgo inminente de muerte o daño severo (asfixia por cruce de gases, hipoxia por despresurización súbita, hiperoxia/incendio, sobrepresión barotraumática, toxicidad aguda).
* **Nivel 2 (Mayor / Severo):** Pérdida de la capacidad de reserva o redundancia del sistema, fallo de conmutación automática de fuentes, inoperatividad de alarmas de advertencia operativa, contaminación química o por humedad por encima de especificaciones farmacopéicas que puedan degradar equipamiento biomédico o causar toxicidad acumulativa.
* **Nivel 3 (Menor / Mantenimiento / Rutina):** Desviaciones de marcado, código de colores, espaciamiento de soportes dentro de límites de tolerancia sin pandeo estructural, falta de planos "As-Installed", o demoras en rutinas de mantenimiento preventivo.

---

## 2. MATRIZ EXHAUSTIVA DE AUDITORÍA E INSPECCIÓN TÉCNICA

| id | clausula_normativa | componente_activo | parametro_a_verificar | tipo_dato_interfaz | valor_o_rango_nominal | criterio_aceptacion | criticidad_stpa (Nivel 1/2/3) |
|---|---|---|---|---|---|---|---|
| **AUD-SUP-001** | 5.1.1, 5.2.2.1 | Central de Suministro de Gases Comprimidos (O2, N2O, Aire, CO2) | Número de fuentes independientes de suministro | Numérico entero | $\ge 3$ fuentes | La central debe disponer como mínimo de tres fuentes independientes: Primaria, Secundaria y de Reserva | Nivel 1 |
| **AUD-SUP-002** | 5.1.2 | Central de Aire o Nitrógeno para accionamiento de herramientas quirúrgicas | Número de fuentes independientes | Numérico entero | $\ge 2$ fuentes | Debe disponer de al menos dos fuentes independientes de suministro para herramientas | Nivel 2 |
| **AUD-SUP-003** | 5.1.3 | Central de Vacío Medicinal | Número mínimo de bombas de vacío instaladas | Numérico entero | $\ge 3$ bombas | El sistema de vacío debe estar compuesto por al menos 3 fuentes independientes (bombas) | Nivel 1 |
| **AUD-SUP-004** | 5.2.1 | Centrales de Gases y Vacío | Capacidad y almacenamiento de suministro | Booleano (Pasa/Falla) | Según cálculo de demanda de la institución | Capacidad suficiente basada en consumo histórico, frecuencia de reposición y análisis de riesgo institucional | Nivel 2 |
| **AUD-SUP-005** | 5.2.2.1 | Sistema de Control de Fuentes | Continuidad de suministro en condición de falla simple | Booleano (Pasa/Falla) | 100% de caudal de diseño | El suministro debe mantener el caudal y presión nominal ante pérdida de red eléctrica, corte de agua o falla de cualquier componente individual | Nivel 1 |
| **AUD-SUP-006** | 5.2.2.2 | Equipos de Control y Regulación de Fuentes | Mantenibilidad sin interrupción de flujo | Booleano (Pasa/Falla) | Diseño con bypass o duplicación | Debe permitir mantenimiento de cualquier regulador, filtro o válvula sin interrumpir el suministro al hospital | Nivel 2 |
| **AUD-SUP-007** | 5.2.3 | Fuente Primaria | Función de suministro en régimen normal | Selección simple [Cilindros, Termo criogénico, Compresor, PSA, Mezclador] | Operación activa inicial | Debe suministrar automáticamente la red hospitalaria en condición normal de operación | Nivel 1 |
| **AUD-SUP-008** | 5.2.4 | Fuente Secundaria | Conmutación automática ante agotamiento de primaria | Booleano (Pasa/Falla) | Conmutación automática inmediata | Debe entrar en servicio automáticamente cuando la fuente primaria se agote o falle, sin caída de presión clínica | Nivel 1 |
| **AUD-SUP-009** | 5.2.5 | Fuente de Reserva | Disponibilidad e independencia de la reserva | Booleano (Pasa/Falla) | Conexión permanente a la red | Debe abastecer automáticamente (o mediante conmutación manual rápida según diseño) ante fallo simultáneo de primaria y secundaria | Nivel 1 |
| **AUD-SUP-010** | 5.2.6.1 | Válvulas de Alivio de Presión (PRV) | Conducto de venteo al exterior (excepto aire medicinal) | Booleano (Pasa/Falla) | Tubería al exterior del edificio | Las válvulas de alivio para todos los gases (excepto aire) deben descargar al aire libre en zona segura sin riesgo de asfixia/fuego | Nivel 1 |
| **AUD-SUP-011** | 5.2.6.2 | Válvulas de Alivio de Presión (PRV) | Cierre automático tras desahogo | Booleano (Pasa/Falla) | Reasentamiento automático estanco | La válvula debe cerrar y estancar automáticamente una vez disipada la sobrepresión | Nivel 2 |
| **AUD-SUP-012** | 5.2.6.3 | Válvulas de Alivio de Presión (PRV) | Imposibilidad de aislamiento físico | Booleano (Pasa/Falla) | Sin válvula de cierre intermedia | No debe existir ninguna válvula de corte manual que pueda aislar la válvula de alivio de la línea que protege | Nivel 1 |
| **AUD-SUP-013** | 5.2.6.4 | Válvulas de Alivio de Presión (PRV) | Protección contra manipulación no autorizada | Booleano (Pasa/Falla) | Sellado / precinto de seguridad | La válvula de alivio debe contar con precinto o bloqueo mecánico que evidencie o impida su descalibración no autorizada | Nivel 2 |
| **AUD-SUP-014** | 5.2.6.5 | Tramos criogénicos de líquido entrampable | Dispositivos de alivio térmico en tramos cerrados | Booleano (Pasa/Falla) | Válvula de alivio criogénico instalada | Todo tramo de cañería entre dos válvulas donde pueda quedar gas líquido atrapado debe contar con válvula de alivio de presión | Nivel 1 |
| **AUD-SUP-015** | 5.2.7.1, 5.2.7.2 | Conjunto de Suministro para Mantenimiento | Presencia de conjunto de conexión física para bypass externo | Booleano (Pasa/Falla) | Conector específico NIST/DISS + Válvula de retención + PRV | Obligatorio en redes de gases comprimidos (excepto vacío y herramientas). Debe incluir conector específico de gas, manómetro y alivio | Nivel 2 |
| **AUD-SUP-016** | 5.2.8 | Reguladores de Presión de Central | Duplicación y protección contra sobrepresión | Booleano (Pasa/Falla) | Línea doble (activo + standby) o bypass regulado | Cada etapa de regulación debe estar duplicada para permitir mantenimiento y poseer válvula de alivio aguas abajo | Nivel 1 |
| **AUD-SUP-017** | 5.3.1, 5.3.2 | Batería / Manifold de Cilindros | Distribución en bancadas primaria, secundaria y reserva | Selección simple [Manifold 2xN + Reserva, Manifold 1xN + Reserva] | Configuración normada | Bancadas alternantes con capacidad idéntica para primaria y secundaria, más banco de reserva | Nivel 2 |
| **AUD-SUP-018** | 5.3.3 | Batería / Manifold de Cilindros | Válvula de retención (check) en latiguillos de conexión | Booleano (Pasa/Falla) | 1 check valve por cada conexión de cilindro | En bancos de más de 1 cilindro, cada conexión flexible debe poseer válvula anti-retorno para evitar fugas al cambiar tubos | Nivel 1 |
| **AUD-SUP-019** | 5.3.4 | Batería / Manifold de Cilindros | Filtro de partículas en cabezal de alta presión | Numérico ($\mu m$) | $\le 100\ \mu m$ | Debe existir un filtro de tamaño de poro no mayor a $100\ \mu m$ entre los cilindros y el regulador de presión | Nivel 2 |
| **AUD-SUP-020** | 5.3.5 | Batería / Manifold de Cilindros | Conformidad de latiguillos flexibles de alta presión | Booleano (Pasa/Falla) | ISO 407 / ISO 5145 / estándares nacionales | Las conexiones flexibles para cilindros deben cumplir con los estándares específicos del gas para presiones de hasta 20.000 kPa | Nivel 1 |
| **AUD-SUP-021** | 5.3.6 | Batería / Manifold de Cilindros | Válvula de corte de cabezal y purga de alta presión | Booleano (Pasa/Falla) | Válvula de aislamiento manual presente | Cada bancada debe tener su propia válvula de corte para independizarla durante maniobras de recarga o mantenimiento | Nivel 2 |
| **AUD-SUP-022** | 5.4.1, 5.4.2 | Recipientes Criogénicos Estacionarios | Vaporizadores / Evaporadores de gasificación | Booleano (Pasa/Falla) | Mínimo 2 vaporizadores con capacidad 100% de diseño | Al menos dos vaporizadores dimensionados cada uno para suministrar el 100% del caudal máximo continuo, con conmutación sin congelamiento | Nivel 1 |
| **AUD-SUP-023** | 5.4.3 | Recipientes Criogénicos Estacionarios | Indicador de nivel y telemetría de contenido | Booleano (Pasa/Falla) | Manómetro diferencial de nivel + Transmisor | Indicación local de nivel de líquido y presión interna, con conexión a sistema de alarma/telemetría remota | Nivel 2 |
| **AUD-SUP-024** | 5.4.4 | Recipientes Criogénicos Estacionarios | Circuito economizador de presión | Booleano (Pasa/Falla) | Válvula economizadora operativa | Sistema automático para priorizar el consumo de la fase gaseosa sobre la líquida y evitar venteos espontáneos por sobrepresión | Nivel 3 |
| **AUD-SUP-025** | 5.4.5 | Recipientes Criogénicos Estacionarios | Respaldo mediante cilindros o segundo termo criogénico | Booleano (Pasa/Falla) | Fuente secundaria y/o de reserva conectada | Debe contar con conexión permanente a fuente secundaria/reserva capaz de abastecer el 100% de la demanda en caso de fallo del termo | Nivel 1 |
| **AUD-SUP-026** | 5.5.1.2, 5.5.1.3 | Central de Aire Comprimido Medicinal | Destino de uso exclusivo para pacientes | Booleano (Pasa/Falla) | Prohibido uso no clínico | Estrictamente prohibido usar aire medicinal para inflado de neumáticos, limpieza por soplado, herramientas de taller o climatización | Nivel 1 |
| **AUD-SUP-027** | 5.5.1.4 | Central de Aire Comprimido Medicinal | Conexión a cámaras hiperbáricas | Booleano (Pasa/Falla) | Sistema independiente o dimensionamiento especial | Si alimenta cámara hiperbárica, la capacidad no debe comprometer la continuidad ni la presión en la red clínica general | Nivel 1 |
| **AUD-SUP-028** | 5.5.2.4 | Central de Aire Medicinal (Compresores) | Redundancia y número de unidades compresoras | Numérico entero | $\ge 3$ unidades compresoras | Al menos 3 fuentes compresoras donde con el compresor de mayor capacidad fuera de servicio se suministre el 100% del caudal de diseño | Nivel 1 |
| **AUD-SUP-029** | 5.5.2.5 | Central de Aire para Herramientas Quirúrgicas | Redundancia de compresores para herramientas | Numérico entero | $\ge 2$ unidades compresoras | Al menos 2 compresores independientes con capacidad de abastecer el caudal de diseño con una unidad en mantenimiento | Nivel 2 |
| **AUD-SUP-030** | 5.5.2.6, 5.5.2.7 | Acumuladores / Pulmones de Aire Medicinal | Válvulas, purgas y bypass en tanques pulmón | Booleano (Pasa/Falla) | Aislamiento individual + Drenaje manual y automático | Cada depósito debe tener manómetro, válvula de alivio, drenaje de condensado manual/automático y permitir aislamiento sin corte de línea | Nivel 2 |
| **AUD-SUP-031** | 5.5.2.8 | Secadores y Unidades de Acondicionamiento de Aire | Redundancia de trenes de secado y filtrado | Booleano (Pasa/Falla) | Mínimo 2 trenes (100% redundancia cada uno) | Debe poseer al menos 2 unidades de acondicionamiento completas, cada una capaz de procesar el 100% del caudal de diseño | Nivel 1 |
| **AUD-SUP-032** | 5.5.2.9 | Acondicionamiento de Aire Medicinal | Puerto de muestreo de calidad de gas | Booleano (Pasa/Falla) | Toma con válvula de cierre aguas abajo de filtros | Debe existir un puerto de prueba con válvula de cierre inmediatamente aguas abajo del tren de acondicionamiento y antes de entrar a red | Nivel 2 |
| **AUD-SUP-033** | 5.5.2.10 | Central de Aire Medicinal | Circuitos de control independientes por compresor | Booleano (Pasa/Falla) | Tablero eléctrico con control segregado | La parada o falla de control de un compresor no debe impedir la operación ni el arranque de los restantes | Nivel 1 |
| **AUD-SUP-034** | 5.5.2.11 | Toma de Aspiración de Aire para Compresores | Ubicación de la admisión de aire ambiente | Booleano (Pasa/Falla) | Libre de contaminación atmosférica | Ubicada al aire libre, protegida con rejilla y filtro, alejada de caños de escape vehiculares, chimeneas, venteos de vacío y descargas sépticas | Nivel 1 |
| **AUD-SUP-035** | 5.5.2.13 | Central de Aire Medicinal | Aislamiento de vibraciones mecánicas | Booleano (Pasa/Falla) | Flexibles antivibratorios y montajes elásticos | Medios instalados para prevenir la transmisión de vibraciones de los compresores a la red de cañerías del hospital | Nivel 2 |
| **AUD-SUP-036** | 5.5.3.2 | Central de Mezcla / Proporción (O2 + N2) | Número de fuentes de suministro en mezclador | Numérico entero | $\ge 3$ fuentes | Al menos tres fuentes de suministro independientes para el sistema de aire sintético medicinal | Nivel 1 |
| **AUD-SUP-037** | 5.5.3.4, 5.5.3.5 | Central de Proporción (Aire Sintético) | Analizador continuo de O2 y corte automático | Booleano (Pasa/Falla) | Analizador doble con corte automático ante desvío | Debe monitorear continuamente el % de O2 y desviar o cortar el suministro si sale de $20.4\% - 21.4\%$, activando la fuente de reserva | Nivel 1 |
| **AUD-SUP-038** | 5.5.3.6 | Central de Proporción (Aire Sintético) | Puerto para verificación de calibración de analizador | Booleano (Pasa/Falla) | Puerto de calibración con gas patrón disponible | Medios integrados para contrastar la calibración de los sensores de oxígeno sin afectar el suministro | Nivel 2 |
| **AUD-SUP-039** | 5.6.1, 5.6.2 | Concentradores de Oxígeno (Plantas PSA) | Especificación de pureza de oxígeno 93 | Numérico ($\%) | $90.0\% \text{ a } 96.0\%$ v/v ($93\% \pm 3\%$) | Debe cumplir estrictamente ISO 10083 y farmacopea aplicable; corte/conmutación si cae de $90.0\%$ | Nivel 1 |
| **AUD-SUP-040** | 5.6.3 | Concentradores de Oxígeno (Plantas PSA) | Analizador paramagnético continuo y conmutación | Booleano (Pasa/Falla) | Analizador de O2 continuo en línea | Si la concentración cae por debajo del límite permitido, el sistema debe conmutar automáticamente a la fuente de reserva (cilindros/termo) | Nivel 1 |
| **AUD-SUP-041** | 5.7.1, 5.7.2 | Central de Vacío Clínico | Capacidad del sistema con falla de una bomba | Booleano (Pasa/Falla) | 100% de caudal de diseño con bomba mayor fuera | Con la bomba de mayor capacidad fuera de servicio, las bombas restantes deben entregar el 100% del caudal de diseño a presión nominal | Nivel 1 |
| **AUD-SUP-042** | 5.7.4 | Central de Vacío Clínico | Control eléctrico segregado por bomba | Booleano (Pasa/Falla) | Circuito de comando independiente por bomba | El fallo o desconexión eléctrica de una bomba no debe inhabilitar el arranque de las demás unidades | Nivel 1 |
| **AUD-SUP-043** | 5.7.7 | Reservorio / Depósito de Vacío | Válvulas de aislamiento, drenaje y vacuómetro | Booleano (Pasa/Falla) | Válvula de corte + Purga inferior + Vacuómetro | El depósito debe poseer válvula de cierre para mantenimiento, purga de drenaje inferior y vacuómetro calibrado | Nivel 2 |
| **AUD-SUP-044** | 5.7.8, 5.7.9 | Descarga de Bombas de Vacío al Exterior | Trazado y drenaje de la cañería de escape | Booleano (Pasa/Falla) | Salida exterior con codo hacia abajo y purga | La línea de escape debe terminar en el exterior, lejos de ventanas o tomas de aire, protegida de la lluvia/aves y con drenaje en punto bajo | Nivel 1 |
| **AUD-SUP-045** | 5.7.10 | Central de Vacío Clínico | Prevención de transmisión de vibraciones | Booleano (Pasa/Falla) | Conexiones flexibles en aspiración y descarga | Juntas antivibratorias flexibles instaladas en la entrada y salida de cada bomba de vacío | Nivel 3 |
| **AUD-SUP-046** | 5.7.11 | Filtros Bacteriológicos de Vacío | Duplicación y capacidad de filtración | Booleano (Pasa/Falla) | Filtro doble (100% caudal cada uno) + Vaso drenador | Al menos dos filtros bacteriológicos en paralelo con válvulas de aislamiento y vaso trampa drenable para retención de aerosoles patógenos | Nivel 1 |
| **AUD-SUP-047** | 5.7.12 | Central de Vacío Clínico | Prohibición de uso para evacuación de gases anestésicos | Booleano (Pasa/Falla) | Prohibido uso para AGSS/WAGD sin diseño especial | No se permite utilizar el sistema de vacío medicinal para extracción activa de gases anestésicos residuales a menos que esté expresamente diseñado | Nivel 1 |
| **AUD-SUP-048** | 5.8.1, 5.9, 5.10 | Sala de Máquinas y Depósitos de Centrales | Condiciones ambientales y de seguridad del recinto | Booleano (Pasa/Falla) | Ventilación, acceso restringido, libre de inflamables | Recinto exclusivo, ventilado, con cerramiento cortafuego, temperatura entre $10\,^\circ\text{C}$ y $40\,^\circ\text{C}$, sin almacenamiento de combustibles | Nivel 2 |
| **AUD-ALM-001** | 6.3.4.1, Tabla 1 | Alarmas Clínicas de Emergencia (Paneles de Área) | Indicador visual de advertencia clínica | Selección simple [Rojo fijo, Rojo destellante, Amarillo, Verde] | Color Rojo destellante conforme IEC 60601-1-8 | Luz indicadora roja obligatoria para situaciones clínicas de peligro inminente | Nivel 1 |
| **AUD-ALM-002** | 6.3.4.1, Tabla 1 | Alarmas Clínicas de Emergencia (Paneles de Área) | Frecuencia de destello visual | Numérico (Hz) | $0.4\text{ a } 2.8\text{ Hz}$ | La frecuencia de parpadeo del indicador visual debe estar comprendida entre 0.4 Hz y 2.8 Hz con ciclo de trabajo del 20% al 60% | Nivel 1 |
| **AUD-ALM-003** | 6.3.2.1, Tabla 1 | Alarmas Clínicas de Emergencia (Paneles de Área) | Señal auditiva de emergencia clínica | Booleano (Pasa/Falla) | Conforme IEC 60601-1-8 | Tono acústico específico de alta prioridad que exige respuesta inmediata del personal médico | Nivel 1 |
| **AUD-ALM-004** | 6.3.4.1, Tabla 1 | Alarmas Operativas de Emergencia (Sala de Fuentes) | Indicador visual y acústico de operación crítica | Booleano (Pasa/Falla) | Color Rojo destellante (0.4 a 2.8 Hz) + Acústico continuo | Señal de respuesta inmediata para personal técnico ante falla troncal del sistema | Nivel 1 |
| **AUD-ALM-005** | 6.3.4.1, Tabla 1 | Alarmas Operativas (Advertencia Técnica) | Características de alarma operativa ordinaria | Selección simple [Amarillo destellante, Amarillo fijo, Rojo, Verde] | Color Amarillo destellante (0.4 a 2.8 Hz), acústico optativo | Señal de respuesta oportuna (pronta respuesta) ante degradación o cambio de estado | Nivel 2 |
| **AUD-ALM-006** | 6.3.5, Tabla 1 | Indicadores de Estado Normal | Señales de información operacional | Selección simple [Verde continuo, Blanco, Azul, Rojo, Amarillo] | Constante / fijo, No rojo, No amarillo (típicamente Verde) | Indica funcionamiento normal de la red y disponibilidad de fuentes activas | Nivel 3 |
| **AUD-ALM-007** | 6.4 a) | Central de Cilindros (Manifolds) | Alarma de conmutación de bancada primaria a secundaria | Booleano (Pasa/Falla) | Alarma operativa amarilla activa | Se activa automáticamente cuando la bancada en servicio se agota y conmuta al banco secundario | Nivel 2 |
| **AUD-ALM-008** | 6.4 b) | Central de Cilindros (Manifolds) | Alarma de baja presión en banco de reserva o secundario | Booleano (Pasa/Falla) | Alarma operativa amarilla activa | Advierte que el contenido del banco de cilindros de reserva o secundario cayó por debajo del nivel de seguridad | Nivel 1 |
| **AUD-ALM-009** | 6.4 c), 6.4 d) | Tanques Criogénicos (Termos fijos) | Alarma de baja presión y bajo nivel de líquido | Booleano (Pasa/Falla) | Alarma operativa amarilla activa | Se dispara cuando el volumen de líquido o la presión del tanque criogénico cae por debajo del umbral mínimo | Nivel 1 |
| **AUD-ALM-010** | 6.4 e) | Compresores de Aire Medicinal | Alarma de fallo en compresor | Booleano (Pasa/Falla) | Alarma operativa amarilla activa | Detecta disparo térmico, sobrecalentamiento, baja presión de aceite o parada de una unidad | Nivel 2 |
| **AUD-ALM-011** | 6.4 f) | Tratamiento de Aire Medicinal | Alarma de alto punto de rocío (humedad) | Numérico ($^\circ\text{C}$) | $\le -21\,^\circ\text{C}$ a 400 kPa (o $\le -46\,^\circ\text{C}$ atm) | Se dispara cuando la humedad del aire supera el límite máximo normativo | Nivel 2 |
| **AUD-ALM-012** | 6.4 i) | Central de Vacío Clínico | Alarma de mal funcionamiento de bombas de vacío | Booleano (Pasa/Falla) | Alarma operativa amarilla activa | Detecta fallo eléctrico, sobrecarga o imposibilidad de alcanzar el nivel de vacío de corte | Nivel 2 |
| **AUD-ALM-013** | 6.4 j) | Plantas Concentradoras PSA | Alarma de baja concentración de O2 en PSA | Numérico ($\%) | $< 93\%$ (o $< 90\%$) | Alarma operativa amarilla si la pureza se degrada por debajo del valor nominal preestablecido | Nivel 1 |
| **AUD-ALM-014** | 6.5 a) | Paneles de Alarma en Áreas Críticas (UTI/Quirófano) | Desviación de presión clínica en gases comprimidos | Numérico ($\%) | $\pm 20\%$ de la presión nominal | Alarma clínica roja si la presión aguas abajo de la AVSU varía en más de $\pm 20\%$ (ej. $<320$ o $>480$ kPa en línea de 400 kPa) | Nivel 1 |
| **AUD-ALM-015** | 6.5 b) | Paneles de Alarma en Áreas Críticas (UTI/Quirófano) | Límite de pérdida de vacío clínico en panel de área | Numérico (kPa abs) | $> 66\text{ kPa}$ absoluto | Alarma clínica roja inmediata si la presión absoluta supera 66 kPa (pérdida de succión efectiva) | Nivel 1 |
| **AUD-ALM-016** | 6.6 a) | Alarma Operativa de Emergencia (Troncal simple etapa) | Desviación de presión troncal en red de una etapa | Numérico ($\%) | $\pm 20\%$ de la presión de distribución | Se activa en central técnica si la presión aguas abajo de la válvula de fuente principal desvía más de $\pm 20\%$ | Nivel 1 |
| **AUD-ALM-017** | 6.6 b) | Alarma Operativa de Emergencia (Troncal doble etapa) | Desviación de presión troncal en red de doble etapa | Numérico ($\%) | $\pm 20\%$ de la presión de suministro troncal | Se activa si la presión del colector troncal antes de reguladores de línea desvía más de $\pm 20\%$ | Nivel 1 |
| **AUD-ALM-018** | 6.6 c) | Alarma Operativa de Emergencia (Troncal de vacío) | Límite de presión absoluta en colector principal de vacío | Numérico (kPa abs) | $> 44\text{ kPa}$ absoluto | Alarma operativa roja en central si la presión absoluta en el troncal supera los 44 kPa | Nivel 1 |
| **AUD-ALM-019** | 6.2.2 a), 6.3.2.3 | Paneles de Monitoreo y Alarma | Silenciamiento temporal de alarma acústica (Mute) | Numérico (min) | $\le 15\text{ minutos}$ | La anulación sonora debe restablecerse automáticamente si persiste la anomalía o surge un nuevo evento | Nivel 2 |
| **AUD-ALM-020** | 6.2.2 b) | Paneles de Monitoreo y Alarma | Persistencia de la señal visual tras silenciamiento sonoro | Booleano (Pasa/Falla) | Señal visual no reseteable mientras dure la falla | El silenciamiento del zumbador no debe apagar ni cancelar la indicación luminosa mientras el parámetro esté fuera de rango | Nivel 1 |
| **AUD-ALM-021** | 6.2.2 c) | Paneles de Monitoreo y Alarma | Pulsador para prueba funcional de lámparas (Lamp Test) | Booleano (Pasa/Falla) | Botón de verificación operativo | Debe contar con botón manual que ilumine todos los leds e indicadores para descartar lámparas quemadas | Nivel 2 |
| **AUD-ALM-022** | 6.2.2 d), 6.2.4 | Cableado y Sensores de Alarma | Circuito supervisado a prueba de fallos (Fail-Safe) | Booleano (Pasa/Falla) | Alarma ante cable roto o cortocircuito | La interrupción o rotura de conductores entre sensores y el panel debe disparar automáticamente un estado de alarma | Nivel 1 |
| **AUD-ALM-023** | 6.2.2 e) | Alimentación Eléctrica de Paneles de Alarma | Respaldo por batería y conexión a red de emergencia | Numérico (horas) | $\ge 4\text{ horas}$ de autonomía | Debe estar alimentado de la red ininterrumpida (UPS/Generador) y poseer batería propia con autonomía mínima de 4 horas | Nivel 1 |
| **AUD-PIP-001** | 7.1 | Tuberías de Distribución de Gases Comprimidos | Resistencia mecánica a sobrepresión por falla simple | Numérico (multiplicador) | $\ge 1.2 \times P_{\max\,\text{falla}}$ | Toda la red de distribución debe soportar 1.2 veces la máxima presión posible en condición de falla simple | Nivel 1 |
| **AUD-PIP-002** | 7.2.1, Tabla 2 | Tuberías de Gases Medicinales Comprimidos | Presión nominal de distribución ($O_2, N_2O, Aire, CO_2$) | Numérico (kPa) | $400\text{ kPa } (+100 / -0\text{ kPa})$ ($400 \text{ a } 500\text{ kPa}$) | Rango normal de trabajo medido en manómetros de línea en condiciones de demanda base | Nivel 1 |
| **AUD-PIP-003** | 7.2.1, Tabla 2 | Tuberías de Accionamiento de Herramientas Quirúrgicas | Presión nominal de distribución (Aire 800 o $N_2$ 800) | Numérico (kPa) | $800\text{ kPa } (+200 / -0\text{ kPa})$ ($800 \text{ a } 1000\text{ kPa}$) | Rango de presión para suministro de motores e instrumental neumático en quirófanos | Nivel 1 |
| **AUD-PIP-004** | 7.2.1, 7.2.4, Tabla 2 | Tuberías de Vacío Clínico | Presión absoluta de trabajo en tomas terminales | Numérico (kPa abs) | $\le 60\text{ kPa}$ absoluto ($\ge -40\text{ kPa}$ manométrico) | La presión absoluta en cualquier toma no debe superar 60 kPa abs (típicamente entre 20 y 40 kPa abs / -60 a -80 kPa rel.) | Nivel 1 |
| **AUD-PIP-005** | 7.2.2 | Red Troncal de Gases Comprimidos (400 kPa) | Caída de presión máxima al caudal de diseño | Numérico ($\%) | $\le 10\%$ ($\le 40\text{ kPa}$ de caída) | Entre la fuente de suministro y la toma terminal más desfavorable a flujo pico de diseño | Nivel 2 |
| **AUD-PIP-006** | 7.2.3 | Red de Herramientas Quirúrgicas (800 kPa) | Caída de presión máxima al caudal de diseño | Numérico ($\%) | $\le 15\%$ ($\le 120\text{ kPa}$ de caída) | Entre la central y la toma terminal de herramienta quirúrgica a flujo de diseño | Nivel 2 |
| **AUD-PIP-007** | 7.2.4 | Red Troncal de Vacío Clínico | Pérdida de carga / aumento de presión absoluta a flujo de diseño | Numérico (kPa) | $\le 15\text{ kPa}$ de aumento | La presión en la toma no debe incrementarse en más de 15 kPa respecto a la presión de entrada al colector | Nivel 2 |
| **AUD-PIP-008** | 7.3.1, 7.3.2 | Conexiones Flexibles de Baja Presión | Conformidad de mangueras y flexibles en cañería | Booleano (Pasa/Falla) | ISO 5359 / Resistencia al fuego y presión | Las uniones flexibles deben cumplir ISO 5359 y ensayarse a presión de prueba de la tubería | Nivel 1 |
| **AUD-PIP-009** | 7.4.2 | Sistemas de Distribución en Doble Etapa | Válvulas de corte aguas arriba y aguas abajo de reguladores | Booleano (Pasa/Falla) | Válvulas de corte a ambos lados de regulador de línea | Para permitir el reemplazo o mantenimiento del regulador de línea sin interrumpir el suministro troncal | Nivel 2 |
| **AUD-PIP-010** | 11.1.2 | Rutas de Instalación de Cañerías | Separación física respecto a canalizaciones eléctricas | Numérico (mm) | $\ge 50\text{ mm}$ o conducto separado | Las tuberías y cables eléctricos deben discurrir por compartimentos separados o mantener una distancia $>50\text{ mm}$ | Nivel 2 |
| **AUD-PIP-011** | 11.1.3 | Conexión Equipotencial y Puesta a Tierra | Vinculación a tierra del sistema de cañerías | Booleano (Pasa/Falla) | Puesta a tierra en entrada; Prohibido usar como conductor de tierra | La cañería debe conectarse a tierra al ingresar al edificio; terminantemente prohibido utilizarla como retorno o electrodo de tierra | Nivel 1 |
| **AUD-PIP-012** | 11.1.5 | Rutas de Instalación de Cañerías | Prohibición en áreas de riesgo especial o inflamables | Booleano (Pasa/Falla) | Tuberías protegidas mecánicamente | No se permite tender cañerías sin protección en locales con almacenamiento de sustancias inflamables o depósitos de combustible | Nivel 1 |
| **AUD-PIP-013** | 11.1.6 | Trazado Subterráneo de Cañerías | Instalación en trincheras o túneles drenados y ventilados | Booleano (Pasa/Falla) | En conductos ventilados, no enterrada directamente | Tuberías bajo suelo deben ir entubadas o en galerías técnicas con drenaje y ventilación natural | Nivel 2 |
| **AUD-PIP-014** | 11.1.7 | Rutas de Instalación de Cañerías | Prohibición absoluta de trazado en huecos de ascensores | Booleano (Pasa/Falla) | Cero cañerías dentro de huecos de elevadores | Ninguna cañería de gas medicinal o vacío puede cruzar o instalarse dentro de un hueco o caja de ascensor | Nivel 1 |
| **AUD-PIP-015** | 11.1.8 | Localización de Válvulas de Corte de Cañería | Prohibición de instalación en espacios sin ventilación | Booleano (Pasa/Falla) | Prohibido en cielorrasos o plenos herméticos | No instalar válvulas de corte en recintos confinados donde una fuga pueda originar acumulaciones explosivas o anóxicas | Nivel 1 |
| **AUD-PIP-016** | 11.1.9, 11.1.10 | Trazado de Cañerías | Protección contra corrosión y juntas de dilatación | Booleano (Pasa/Falla) | Vainas pasamuros y liras de expansión | Mangas plásticas pasamuros sin contacto directo con yeso/cemento, y previsión de dilatación térmica | Nivel 3 |
| **AUD-PIP-017** | 11.2.1, Tabla 3 | Soportes de Cañería de Cobre | Espaciamiento máximo para tubos de $\le 15\text{ mm}$ DE | Numérico (m) | $\le 1.5\text{ m}$ | Distancia máxima admisible entre grampas o abrazaderas de soporte para cañerías de cobre de hasta 15 mm | Nivel 3 |
| **AUD-PIP-018** | 11.2.1, Tabla 3 | Soportes de Cañería de Cobre | Espaciamiento máximo para tubos de $22\text{ mm a } 28\text{ mm}$ DE | Numérico (m) | $\le 2.0\text{ m}$ | Distancia máxima admisible entre soportes para cañerías de 22 a 28 mm exterior | Nivel 3 |
| **AUD-PIP-019** | 11.2.1, Tabla 3 | Soportes de Cañería de Cobre | Espaciamiento máximo para tubos de $35\text{ mm a } 54\text{ mm}$ DE | Numérico (m) | $\le 2.5\text{ m}$ | Distancia máxima admisible entre soportes para cañerías de 35 a 54 mm exterior | Nivel 3 |
| **AUD-PIP-020** | 11.2.1, Tabla 3 | Soportes de Cañería de Cobre | Espaciamiento máximo para tubos de $> 54\text{ mm}$ DE | Numérico (m) | $\le 3.0\text{ m}$ | Distancia máxima admisible entre soportes para cañerías mayores a 54 mm exterior | Nivel 3 |
| **AUD-PIP-021** | 11.2.3 | Soportes de Cañería | Materiales resistentes a la corrosión y aislación galvánica | Booleano (Pasa/Falla) | Soportes tratados o con almohadilla dieléctrica | Las grampas deben ser anticorrosivas y contar con inserciones plásticas para evitar par galvánico con el cobre | Nivel 3 |
| **AUD-PIP-022** | 11.2.4 | Soportes de Cañería | Soporte adyacente en cruce de cables eléctricos | Booleano (Pasa/Falla) | Grampa de sujeción inmediata al cruce | Cuando la tubería cruce conductores eléctricos, debe fijarse con un soporte contiguo para evitar deformaciones y contacto físico | Nivel 2 |
| **AUD-PIP-023** | 11.2.5 | Soportes de Cañería | Prohibición de soportar cañerías sobre otras instalaciones | Booleano (Pasa/Falla) | Estructuras independientes de cuelgue | Ninguna tubería debe usarse como soporte de otros tubos ni estar colgada de conductos de ventilación o bandejas de cables | Nivel 3 |
| **AUD-PIP-024** | 11.3.1 | Uniones de Tuberías Metálicas | Método de unión por soldadura fuerte (Brazing) | Booleano (Pasa/Falla) | Resistencia mecánica hasta $600\,^\circ\text{C}$; Metal $\text{Cd} < 0.025\%$ | Juntas soldadas que mantengan propiedades hasta $600\,^\circ\text{C}$ sin fundirse; aleación de aporte sin cadmio | Nivel 1 |
| **AUD-PIP-025** | 11.3.2 | Soldadura de Cañerías en Obra | Purga interna continua con gas inerte durante la soldadura | Booleano (Pasa/Falla) | Nitrógeno exento de oxígeno en circulación | Durante el calentamiento debe circular nitrógeno seco por el interior del tubo para evitar formación de cascarilla de óxido cúprico | Nivel 1 |
| **AUD-VAL-001** | 8.1.3 | Válvulas de Corte en General | Rótulo de identificación de gas y zona servida | Booleano (Pasa/Falla) | Placa indeleble con nombre de gas, sector y estado | Toda válvula de corte debe exhibir claramente el gas que transporta y la zona o piso exacto que controla | Nivel 2 |
| **AUD-VAL-002** | 8.1.4 | Válvulas de Corte en General | Indicación visual inequívoca de posición abierta/cerrada | Booleano (Pasa/Falla) | Manija en sentido del flujo (abierta) / transversal (cerrada) | Debe ser evidente a simple vista si la válvula está abierta o cerrada | Nivel 2 |
| **AUD-VAL-003** | 8.1.5 | Válvulas de Corte de Fuente | Válvula de corte en cada fuente de suministro | Booleano (Pasa/Falla) | Válvula inmediatamente a la salida (entrada en vacío) | Cada fuente (compresor, manifold, termo, bomba) debe tener válvula de corte dedicada para independizarla | Nivel 1 |
| **AUD-VAL-004** | 8.1.6 | Válvula de Corte Principal de Entrada | Válvula de acometida general al edificio | Booleano (Pasa/Falla) | Inmediatamente aguas arriba de conjunto de mantenimiento | Permite seccionar todo el edificio desde la acometida externa en emergencias | Nivel 1 |
| **AUD-VAL-005** | 8.1.7 | Válvulas de Servicio (Montantes y Ramales) | Mecanismo de bloqueo de posición (Lockout) | Booleano (Pasa/Falla) | Bloqueables en posición abierta y cerrada | Las válvulas de servicio no operables por usuarios deben tener candado o bloqueo mecánico en posición normal | Nivel 2 |
| **AUD-VAL-006** | 8.2.3, 8.2.4 | Válvulas de Servicio | Válvulas en montantes (risers) y ramales de piso | Booleano (Pasa/Falla) | Válvula en arranque de cada montante y derivación de piso | Debe existir una válvula de servicio en el inicio de cada montante vertical y en el empalme de cada piso | Nivel 2 |
| **AUD-VAL-007** | 8.3.1, 8.3.2 | Válvulas de Corte de Área (AVSU) | Ubicación en el mismo piso de las tomas servidas | Booleano (Pasa/Falla) | Mismo nivel de planta que las tomas de paciente | Cada quirófano, terapia intensiva o sala debe tener su AVSU en el mismo piso, accesible inmediatamente | Nivel 1 |
| **AUD-VAL-008** | 8.3.4 | Cajas de Válvulas de Área (AVSU Box) | Rótulo frontal de advertencia de emergencia | Booleano (Pasa/Falla) | "PRECAUCIÓN - No cerrar salvo en emergencia" | Leyenda clara en la puerta o marco de la caja advirtiendo que su accionamiento interrumpe soporte vital | Nivel 2 |
| **AUD-VAL-009** | 8.3.5 a) | Cajas de Válvulas de Área (AVSU Box) | Válvulas seccionadoras por cada gas y vacío | Booleano (Pasa/Falla) | 1 válvula por cada servicio suministrado al área | Conjunto de válvulas de 1/4 de vuelta identificadas por color y gas para el sector | Nivel 1 |
| **AUD-VAL-010** | 8.3.5 b) | Cajas de Válvulas de Área (AVSU Box) | Medios visibles para aislamiento físico seguro (brida ciega) | Booleano (Pasa/Falla) | Dispositivo de desconexión física visible (excepto vacío) | No se considera seguro un cierre de válvula simple para obras en la red; debe preverse brida ciega o acople separable | Nivel 1 |
| **AUD-VAL-011** | 8.3.6 | Cajas de Válvulas de Área (AVSU Box) | Ventilación de la caja a la habitación | Booleano (Pasa/Falla) | Caja ventilada naturalmente al ambiente | La caja debe contar con rejillas o ranuras de ventilación para evitar acumulación de mezclas asfixiantes o hiperóxicas | Nivel 1 |
| **AUD-VAL-012** | 8.3.6 | Cajas de Válvulas de Área (AVSU Box) | Acceso de emergencia mediante tapa rompible o apertura rápida | Booleano (Pasa/Falla) | Ventana destructible o apertura manual sin llave especial | En emergencia cualquier persona autorizada debe poder accionar la válvula rompiendo un vidrio o destrabando la cubierta | Nivel 1 |
| **AUD-VAL-013** | 8.3.7 | Cajas de Válvulas de Área (AVSU Box) | Altura y visibilidad ergonómica de instalación | Numérico (m) | $1.2\text{ m a } 1.8\text{ m}$ sobre nivel de piso | Ubicadas a la altura de la mano, iluminadas, visibles en pasillos y fuera del alcance indebido en pediatría/psiquiatría | Nivel 2 |
| **AUD-VAL-014** | 8.3.8 | Cajas de Válvulas de Área (AVSU Box) | Toma de entrada para suministro de emergencia y mantenimiento | Booleano (Pasa/Falla) | Conector específico NIST/DISS aguas abajo de AVSU | Conector hembra específico de gas (excepto vacío y herramientas) para acoplar cilindro externo en caso de corte troncal | Nivel 1 |
| **AUD-VAL-015** | 8.3.9 | Tramo de Tubería entre AVSU y Tomas | Prohibición de intercalar componentes accesorios | Booleano (Pasa/Falla) | Solo permitidos manómetros, sensores, tomas de emergencia | No deben existir otros accesorios, filtros o derivaciones ciegas entre la válvula de área y las tomas de los pacientes | Nivel 1 |
| **AUD-TRM-001** | 9.1 | Unidades Terminales (Tomas de Pared/Techo) | Conformidad con norma de fabricación ISO 9170-1 | Booleano (Pasa/Falla) | Cumplimiento certificado ISO 9170-1 | Todas las tomas terminales instaladas deben contar con certificación de diseño y ensayos según ISO 9170-1 | Nivel 1 |
| **AUD-TRM-002** | 9.2, 12.6.5.2 | Conectores Específicos de Gas (NIST / DISS) | No intercambiabilidad dimensional absoluta entre gases | Booleano (Pasa/Falla) | Imposibilidad mecánica de conexión cruzada | Las sondas o adaptadores de otros gases no deben encastrar ni permitir flujo en la toma bajo ninguna fuerza manual | Nivel 1 |
| **AUD-TRM-003** | 9.3 | Unidades de Suministro Médico (Brazos / Columnas) | Conformidad con norma ISO 11197 | Booleano (Pasa/Falla) | Certificación ISO 11197 | Paneles de cabecera, torres de quirófano y cielíticos articulados deben cumplir con los ensayos de flexión y estanqueidad | Nivel 2 |
| **AUD-TRM-004** | 9.4 | Reguladores de Presión de Línea y Cabezal | Conformidad con norma ISO 10524-2 | Booleano (Pasa/Falla) | Certificación ISO 10524-2 | Los reguladores deben garantizar estabilidad de salida, cierre de alivio y materiales compatibles con oxígeno | Nivel 1 |
| **AUD-TRM-005** | 9.5 | Manómetros e Indicadores de Presión | Conformidad con norma ISO 10524-2 | Booleano (Pasa/Falla) | Escala acorde al gas y aguja con cuadrante normado | Manómetros limpios para servicio de oxígeno, con fondo de escala adecuado y clase de precisión normada | Nivel 2 |
| **AUD-TRM-006** | 12.6.5.1 | Mecanismo de Bloqueo de Unidades Terminales | Inserción, retención y expulsión mecánica de sondas | Booleano (Pasa/Falla) | Encastre suave, retención positiva y expulsión sin trabas | La sonda debe quedar firmemente bloqueada al presionar, no zafar por tracción y desacoplar libremente al pulsar el retén | Nivel 1 |
| **AUD-TRM-007** | 12.6.5.1 | Mecanismo de Bloqueo de Unidades Terminales | Dispositivo antigiro (Anti-Swivel) | Booleano (Pasa/Falla) | Retiene la orientación angular de la sonda | En tomas donde se conecten caudalímetros o frascos de aspiración pesados, el pin antigiro debe impedir su rotación accidental | Nivel 2 |
| **AUD-TRM-008** | 12.6.5.1 | Válvula de Retención Interna de Toma Terminal | Estanqueidad automática al retirar la sonda | Booleano (Pasa/Falla) | Cero fugas detectables al desconectar | Al extraer el equipo de consumo, la válvula de retención de la toma debe cerrar herméticamente de forma instantánea | Nivel 1 |
| **AUD-MRK-001** | 10.1.1, 10.1.2 | Rotulación de Tuberías de Distribución | Nombre del gas y símbolo químico en la cañería | Booleano (Pasa/Falla) | Texto legible con fórmula química ($O_2, N_2O, Aire, Vac$) | Marcado a lo largo del eje longitudinal de la tubería en conformidad con ISO 5359 | Nivel 2 |
| **AUD-MRK-002** | 10.1.2 b) | Rotulación de Tuberías de Distribución | Altura mínima de las letras de rotulado | Numérico (mm) | $\ge 6\text{ mm}$ de altura | El texto del marcado sobre la tubería debe tener caracteres tipográficos de al menos 6 mm para facilitar visualización rápida | Nivel 3 |
| **AUD-MRK-003** | 10.1.2 d) | Rotulación de Tuberías de Distribución | Flechas indicadoras de la dirección de flujo | Booleano (Pasa/Falla) | Flecha indicando el sentido de circulación del fluido | En cada etiqueta de gas debe incluirse la flecha orientada hacia las tomas de consumo (o hacia la bomba en vacío) | Nivel 2 |
| **AUD-MRK-004** | 10.1.1 | Rotulación de Tuberías de Distribución | Puntos obligatorios de marcado en el trazado | Booleano (Pasa/Falla) | Junto a válvulas, derivaciones, cruces de muros y tomas | Marcado presente adyacente a cada válvula de corte, bifurcaciones, cambios de rumbo, pasajes de pared y tomas | Nivel 2 |
| **AUD-MRK-005** | 10.1.1 | Rotulación de Tuberías de Distribución | Intervalo máximo entre etiquetas en tramos rectos | Numérico (m) | $\le 10\text{ m}$ | La separación entre marcas consecutivas a lo largo de una tubería continua no debe superar los 10 metros | Nivel 3 |
| **AUD-MRK-006** | 10.2 | Código de Colores de Tuberías y Tomas | Concordancia de color con norma ISO 5359 / Nacional | Selección simple [Blanco (O2), Azul (N2O), Blanco/Negro (Aire), Gris (CO2), Amarillo (Vac)] | Código de color cromático normado | La identificación por color de anillos o pintura debe corresponder exactamente al fluido transportado | Nivel 2 |
| **AUD-TST-001** | 12.3 a), 12.5.1 | Inspecciones Previas al Ocultamiento | Verificación de soportes, marcado y ausencia de uniones ocultas | Booleano (Pasa/Falla) | Conformidad física antes de tapar cielorrasos/paredes | Se audita que no queden juntas mecánicas inaccesibles, que los soportes cumplan la Tabla 3 y esté rotulada la red | Nivel 2 |
| **AUD-TST-002** | 12.6.1.1, C.3.1.1 | Ensayo de Integridad Mecánica de Vacío | Presión positiva de prueba hidrostática/neumática | Numérico (kPa) | $500\text{ kPa}$ aplicado por 5 minutos | Se aplica una sobrepresión positiva de 5 bar para comprobar la resistencia de las soldaduras del sistema de vacío | Nivel 1 |
| **AUD-TST-003** | 12.6.1.2, C.3.1.2 | Ensayo de Fuga en Red de Vacío | Incremento máximo de presión tras 1 hora de aislamiento | Numérico (kPa) | $\le 20\text{ kPa}$ de incremento en 1 hora | A vacío nominal, aislando la central de bombas, el aumento de presión en la red cerrada no debe exceder 20 kPa en 1 hora | Nivel 1 |
| **AUD-TST-004** | 12.6.1.3, C.3.1.3 | Ensayo de Integridad Mecánica de Gases Comprimidos | Sobrepresión neumática antes del ocultamiento | Numérico (multiplicador) | $\ge 1.2 \times P_{\max\,\text{falla}}$ mantenido por 5 min | Se prueba a no menos de 1.2 veces la máxima presión posible de falla (ej. $1.2 \times 500 = 600\text{ kPa}$ para 400 kPa) durante 5 min | Nivel 1 |
| **AUD-TST-005** | 12.6.1.4, C.3.1.4 | Ensayo de Fuga en Tramos Troncales (Aguas Arriba AVSU) | Caída horaria de presión en prueba estática de 2 a 24 horas | Numérico ($\%) | $\le 0.025\% / \text{hora}$ de la presión de ensayo | Tasa horaria de caída de presión corregida por temperatura en tuberías matrices antes de las válvulas de área | Nivel 1 |
| **AUD-TST-006** | 12.6.1.4, C.3.1.4 | Ensayo de Fuga en Ramales de Área (Sin Mangueras Flexibles) | Caída horaria de presión aguas abajo de AVSU | Numérico ($\%) | $\le 0.4\% / \text{hora}$ de la presión de ensayo | Tasa de caída horaria de presión en tramos que abastecen tomas terminales fijas sin brazos móviles ni columnas | Nivel 1 |
| **AUD-TST-007** | 12.6.1.4, C.3.1.4 | Ensayo de Fuga en Ramales de Área (Con Mangueras Flexibles) | Caída horaria de presión en sectores con columnas articuladas | Numérico ($\%) | $\le 0.6\% / \text{hora}$ de la presión de ensayo | Tasa de fuga admitida en ramales que incluyen brazos móviles o cielíticos con tubos flexibles internos | Nivel 2 |
| **AUD-TST-008** | 12.6.2.1, C.3.2 | Ensayo de Estanqueidad de Asiento en Válvula AVSU | Presurización aguas arriba e incremento aguas abajo | Numérico (kPa) | $\le 5\text{ kPa}$ en 15 minutos | Con aguas arriba a presión nominal y aguas abajo despresurizada a 100 kPa, el incremento en 15 min no debe superar 5 kPa | Nivel 1 |
| **AUD-TST-009** | 12.6.2.2 | Verificación de Zonificación de Válvulas AVSU | Correspondencia estricta entre AVSU y tomas servidas | Booleano (Pasa/Falla) | Corta exclusivamente las tomas asignadas al sector | Al cerrar una AVSU deben quedar sin gas únicamente las tomas de la sala/área que indica su rótulo identificador | Nivel 1 |
| **AUD-TST-010** | 12.6.3, C.3.3 | Ensayo Anti-Cruce de Tuberías (Cross-Connection) | Prueba al 100% de tomas terminales por gas individual | Booleano (Pasa/Falla) | Cero cruces entre gases distintos o vacío | Al presurizar una red a la vez, sólo sus tomas correspondientes deben entregar gas. Ensayar el 100% de bocas de la clínica | Nivel 1 |
| **AUD-TST-011** | 12.6.4, Tabla 4 | Ensayo de Caudal y Obstrucción: Gases Comprimidos 400 kPa | Caída máxima de presión a caudal de prueba normado | Numérico ($\%) | $\le 10\%$ de caída a $40\text{ l/min}$ | Al drenar 40 l/min de aire/O2 en cada toma, la presión dinámica no debe caer más del 10% (máx. 40 kPa) respecto a cero flujo | Nivel 1 |
| **AUD-TST-012** | 12.6.4, Tabla 4 | Ensayo de Caudal y Obstrucción: Herramientas Quirúrgicas | Caída máxima de presión a alto caudal de prueba | Numérico ($\%) | $\le 15\%$ de caída a $350\text{ l/min}$ | Al drenar 350 l/min de aire/N2 para herramientas, la presión no debe caer más del 15% (máx. 120 kPa) | Nivel 1 |
| **AUD-TST-013** | 12.6.4, Tabla 4 | Ensayo de Caudal y Obstrucción: Vacío Clínico | Variación máxima de presión de vacío a caudal de prueba | Numérico (kPa) | $\le +15\text{ kPa}$ de incremento a $25\text{ l/min}$ | Al aspirar un caudal de aire libre de 25 l/min en la toma, la pérdida de vacío no debe sobrepasar los 15 kPa | Nivel 1 |
| **AUD-TST-014** | 12.6.8, C.3.6 | Ensayo de Rendimiento de Fuentes y Conmutación | Conmutación automática real simulando falla de fuente | Booleano (Pasa/Falla) | Conmutación sin caída de presión de red | Simular cierre de fuente primaria; verificar conmutación a secundaria y posterior entrada de reserva | Nivel 1 |
| **AUD-TST-015** | 12.6.8, C.3.7 | Ensayo de Presión de Apertura de Válvulas de Seguridad | Presión de disparo de válvulas de alivio en central | Numérico (kPa) | $1.2\text{ a } 1.3 \times P_{\text{nominal}}$ (ej. 530 - 550 kPa para 400) | La PRV debe comenzar a desahogar gas cuando la presión supere la nominal según especificación del fabricante | Nivel 1 |
| **AUD-TST-016** | 12.6.9, C.3.10 | Prueba Funcional de Sistemas de Alarma | Activación individual de todas las alarmas | Booleano (Pasa/Falla) | Todas las condiciones de alarma disparan señal audible y visible | Probar transductores y presostatos forzando presiones alta/baja, nivel de líquido y disparo térmico de motores | Nivel 1 |
| **AUD-TST-017** | 12.6.10, C.3.11 | Ensayo de Contaminación por Partículas | Caudal y tiempo de soplado sobre filtro de membrana | Booleano (Pasa/Falla) | $150\text{ l/min}$ por $\ge 15\text{ segundos}$ sobre membrana | En la toma más alejada de cada ramal, purgar 150 l/min por 15 s; la membrana (poro 0.45 $\mu$m) debe quedar libre de partículas y limpia | Nivel 1 |
| **AUD-TST-018** | 12.6.11, C.3.12 | Calidad de Aire Medicinal: Concentración de Oxígeno | Porcentaje de oxígeno en aire de compresores | Numérico ($\%) | $20.4\% \text{ a } 21.4\%$ v/v | Medido con analizador de oxígeno en el puerto de muestreo de la central | Nivel 1 |
| **AUD-TST-019** | 12.6.11, C.3.12 | Calidad de Aire Medicinal: Contenido de Humedad / Rocío | Punto de rocío de agua a presión atmosférica / de trabajo | Numérico ($^\circ\text{C}$) | $\le -46\,^\circ\text{C}$ a 1 atm (o $\le -21\,^\circ\text{C}$ a 400 kPa) | Medido con higrómetro de espejo enfriado o capacitivo en el puerto de muestreo de la central de aire | Nivel 2 |
| **AUD-TST-020** | 12.6.11, C.3.12 | Calidad de Aire Medicinal: Aceite Total (Aerosol y Vapor) | Concentración máxima de hidrocarburos / aceite | Numérico ($\text{mg/m}^3$) | $\le 0.1\text{ mg/m}^3$ | Ausencia de niebla o vapor de lubricante en el aire suministrado | Nivel 1 |
| **AUD-TST-021** | 12.6.11, C.3.12 | Calidad de Aire Medicinal: Monóxido de Carbono (CO) | Concentración máxima admisible de CO | Numérico (ppm) | $\le 5\text{ ml/m}^3$ ($5\text{ ppm}$) | Medido con tubos colorimétricos o sensor electroquímico calibrado | Nivel 1 |
| **AUD-TST-022** | 12.6.11, C.3.12 | Calidad de Aire Medicinal: Dióxido de Carbono (CO2) | Concentración máxima admisible de CO2 | Numérico (ppm) | $\le 500\text{ ml/m}^3$ ($500\text{ ppm}$) | Medido con sensor infrarrojo o detector químico específico | Nivel 1 |
| **AUD-TST-023** | 12.6.11, C.3.12 | Calidad de Aire Medicinal: Dióxido de Azufre (SO2) | Concentración máxima admisible de SO2 | Numérico (ppm) | $\le 1\text{ ml/m}^3$ ($1\text{ ppm}$) | Contaminante ambiental de combustión que no debe superar 1 ppm | Nivel 1 |
| **AUD-TST-024** | 12.6.11, C.3.12 | Calidad de Aire Medicinal: Óxidos de Nitrógeno (NO + NO2) | Concentración máxima admisible de NOx | Numérico (ppm) | $\le 2\text{ ml/m}^3$ ($2\text{ ppm}$) | Límite estricto de gases nitrosos tóxicos en el aire respirable del paciente | Nivel 1 |
| **AUD-TST-025** | 12.6.12, C.3.12 | Calidad de Aire para Herramientas Quirúrgicas | Punto de rocío y contenido de aceite | Booleano (Pasa/Falla) | Rocío $\le -11\,^\circ\text{C}$ a 800 kPa; Aceite $\le 0.1\text{ mg/m}^3$ | Asegura la protección de los mecanismos neumáticos y la esterilidad en quirófano | Nivel 2 |
| **AUD-TST-026** | 12.6.13, C.3.13 | Calidad de Aire Producido por Proporción (Mezcla O2/N2) | Estabilidad de mezcla de oxígeno y nitrógeno | Booleano (Pasa/Falla) | $O_2: 20.4\% - 21.4\%$; Pureza farmacopea | Comprobar pureza del nitrógeno criogénico y oxígeno medicinal de alimentación | Nivel 1 |
| **AUD-TST-027** | 12.6.14, C.3.14 | Calidad de Oxígeno Producido por Concentrador PSA | Pureza y contaminantes en aire enriquecido con oxígeno | Booleano (Pasa/Falla) | $O_2 \ge 90.0\%$; $\text{CO} \le 5\text{ ppm}$; $\text{CO}_2 \le 300\text{ ppm}$ | Certificación de calidad química del gas PSA antes de conectar a la red hospitalaria | Nivel 1 |
| **AUD-TST-028** | 12.6.15 | Procedimiento de Purgado y Llenado con Gas Específico | Desplazamiento total del gas de ensayo (N2/Aire seco) | Booleano (Pasa/Falla) | Ciclos de presurización y purga secuencial en cada toma | Purgar toma por toma hasta que no queden remanentes del gas de prueba utilizado durante la instalación | Nivel 1 |
| **AUD-TST-029** | 12.6.16, C.3.16 | Ensayo de Identidad del Gas en el 100% de Tomas | Verificación analítica del gas entregado y ausencia de olor | Booleano (Pasa/Falla) | $100\%$ de tomas entregan el gas específico sin olor | Analizar con sensor paramagnético/IR el 100% de las bocas antes de habilitar clínicamente el edificio | Nivel 1 |
| **AUD-DOC-001** | 12.7.1, Anexo D | Certificación Formal de la Instalación | Firma de formularios de comisionamiento (Forms D.1 a D.21) | Booleano (Pasa/Falla) | Actas completas firmadas por fabricante y auditor | Documento formal entregado a la dirección del hospital previo al uso clínico del sistema | Nivel 2 |
| **AUD-DOC-002** | 13.4.1, 13.4.2 | Planos "Conforme a Obra" (As-Installed) | Planos mecánicos actualizados con trazado y diámetros | Booleano (Pasa/Falla) | Juego completo de planos de planta e isométricos | Planos exactos que muestren ubicación de tuberías, válvulas de corte, tomas y centrales | Nivel 2 |
| **AUD-DOC-003** | 13.5 | Diagramas Eléctricos del Sistema | Esquemas unifilares y conexionado de alarmas y fuentes | Booleano (Pasa/Falla) | Diagramas de control, alarmas y cableado de sensores | Planos de tableros eléctricos, alimentación de emergencia y lazos de corriente de monitoreo | Nivel 3 |
| **AUD-DOC-004** | 13.2, 13.3 | Manuales de Operación y Mantenimiento | Entrega de procedimientos operativos y plan preventivo | Booleano (Pasa/Falla) | Manuales de fabricante y protocolos de emergencia | Instrucciones de uso, matrices de mantenimiento periódico y pautas para contingencias | Nivel 3 |

---

## 3. ESPECIFICACIONES DE RANGOS NUMÉRICOS Y UNIDADES PARA VALIDACIÓN EN TIEMPO REAL (FRONTEND / BACKEND)

Esta sección define el diccionario de variables, tipos de datos, unidades y reglas de validación en tiempo real para ser consumidas por la API del backend o en formularios reactivos de la aplicación frontend.

### 3.1 Diccionario de Variables de Presión y Vacío

| Variable ID | Unidad Estándar | Rango Nominal | Rango de Alarma Aceptable | Comportamiento en Validación Frontend / Backend |
|---|---|---|---|---|
| `p_dist_compressed` | $\text{kPa}$ (manométrica) | $400 \text{ a } 500\text{ kPa}$ ($400 +100/-0$) | $320 \text{ a } 480\text{ kPa}$ ($\pm 20\%$) | • Si $400 \le P \le 500$: Estado **NORMAL** (Verde).<br>• Si $320 \le P < 400$ o $500 < P \le 480$: Estado **ADVERTENCIA** (Amarillo).<br>• Si $P < 320$ o $P > 480$: Estado **ALARMA CLÍNICA ROJA** (Disparo acústico y bloqueo). |
| `p_dist_surgical` | $\text{kPa}$ (manométrica) | $800 \text{ a } 1000\text{ kPa}$ ($800 +200/-0$) | $640 \text{ a } 960\text{ kPa}$ ($\pm 20\%$) | • Si $800 \le P \le 1000$: Estado **NORMAL**.<br>• Si $640 \le P < 800$ o $1000 < P \le 960$: Estado **ADVERTENCIA**.<br>• Si $P < 640$ o $P > 960$: Estado **ALARMA OPERATIVA ROJA**. |
| `p_dist_vacuum` | $\text{kPa}$ (absoluta) | $20 \text{ a } 60\text{ kPa}$ abs ($-80 \text{ a } -40\text{ kPa}$ man.) | $\le 66\text{ kPa}$ abs (Área)<br>$\le 44\text{ kPa}$ abs (Troncal) | • Si $P \le 60\text{ kPa}$ abs: Estado **NORMAL**.<br>• Si $60 < P \le 66\text{ kPa}$ abs: Estado **PRECAUCIÓN**.<br>• Si $P > 66\text{ kPa}$ abs en área clínica: Estado **ALARMA CLÍNICA ROJA** (Pérdida crítica de succión).<br>• Si $P > 44\text{ kPa}$ abs en colector de fuentes: **ALARMA OPERATIVA DE FUENTE**. |

### 3.2 Reglas de Validación de Ensayos de Estanqueidad (Fugas) y Caídas de Presión

```json
{
  "leakage_test_rules": {
    "vacuum_1h": {
      "unit": "kPa",
      "max_allowable_pressure_rise": 20.0,
      "formula": "delta_P = P_final - P_initial <= 20.0",
      "test_duration_minutes": 60
    },
    "compressed_gas_upstream_avsu": {
      "unit": "% / hour",
      "max_allowable_drop_rate": 0.025,
      "formula": "drop_rate = ((P1 - P2 * (T1 / T2)) / P1) * (100 / delta_t_hours) <= 0.025",
      "temperature_correction_mandatory": true
    },
    "compressed_gas_downstream_avsu_rigid": {
      "unit": "% / hour",
      "max_allowable_drop_rate": 0.4,
      "formula": "drop_rate = ((P1 - P2 * (T1 / T2)) / P1) * (100 / delta_t_hours) <= 0.4",
      "temperature_correction_mandatory": true
    },
    "compressed_gas_downstream_avsu_flexible": {
      "unit": "% / hour",
      "max_allowable_drop_rate": 0.6,
      "formula": "drop_rate = ((P1 - P2 * (T1 / T2)) / P1) * (100 / delta_t_hours) <= 0.6",
      "temperature_correction_mandatory": true
    },
    "avsu_internal_seat_leakage": {
      "unit": "kPa",
      "max_allowable_downstream_rise": 5.0,
      "upstream_pressure": "nominal (400 or 800 kPa)",
      "downstream_initial_pressure": "100 kPa (atmospheric)",
      "test_duration_minutes": 15
    }
  }
}
```

### 3.3 Reglas de Validación de Caudales y Ensayos Dinámicos de Tomas (Tabla 4)

| Servicio / Gas | Caudal de Ensayo Requerido | Caída Máxima de Presión Admisible | Fórmula de Validación en App |
|---|---|---|---|
| Gases Medicinales ($O_2, N_2O, Aire, CO_2$) | $40\text{ l/min}$ | $-10\%$ respecto a presión estática | `((P_estatica - P_dinamica) / P_estatica) <= 0.10` |
| Aire o $N_2$ para Herramientas Quirúrgicas | $350\text{ l/min}$ | $-15\%$ respecto a presión estática | `((P_estatica - P_dinamica) / P_estatica) <= 0.15` |
| Vacío Clínico | $25\text{ l/min}$ (aire libre) | $+15\text{ kPa}$ de aumento absoluto | `(P_dinamica_abs - P_estatica_abs) <= 15.0` |
| Soplado de Partículas | $150\text{ l/min}$ | Cero partículas visibles en $\ge 15\text{ s}$ | `flow >= 150 && time_seconds >= 15 && membrane_clean == true` |

### 3.4 Reglas de Validación de Calidad Farmacopéica de Aire y Oxígeno

```typescript
export interface GasQualityParameters {
  medical_air: {
    o2_concentration_vol_pct: { min: 20.4, max: 21.4, unit: "% v/v" };
    water_dew_point_celsius: { max_at_atmospheric_p: -46.0, max_at_400kPa: -21.0, unit: "°C" };
    total_oil_mg_m3: { max: 0.1, unit: "mg/m³" };
    carbon_monoxide_ppm: { max: 5.0, unit: "ml/m³ (ppm)" };
    carbon_dioxide_ppm: { max: 500.0, unit: "ml/m³ (ppm)" };
    sulfur_dioxide_ppm: { max: 1.0, unit: "ml/m³ (ppm)" };
    nitrogen_oxides_ppm: { max: 2.0, unit: "ml/m³ (ppm)" };
  };
  surgical_air: {
    water_dew_point_celsius: { max_at_atmospheric_p: -46.0, max_at_800kPa: -11.0, unit: "°C" };
    total_oil_mg_m3: { max: 0.1, unit: "mg/m³" };
  };
  oxygen_psa_93: {
    o2_concentration_vol_pct: { min: 90.0, max: 96.0, nominal: 93.0, unit: "% v/v" };
    carbon_monoxide_ppm: { max: 5.0, unit: "ml/m³ (ppm)" };
    carbon_dioxide_ppm: { max: 300.0, unit: "ml/m³ (ppm)" };
    water_vapour_ppm: { max: 67.0, unit: "ml/m³ (ppm)" };
  };
}
```

### 3.5 Reglas de Validación de Distancias de Soportes de Tubería (Tabla 3)

```typescript
export function validatePipeSupportInterval(diameter_mm: number, interval_meters: number): boolean {
  if (diameter_mm <= 15) {
    return interval_meters <= 1.5;
  } else if (diameter_mm <= 28) {
    return interval_meters <= 2.0;
  } else if (diameter_mm <= 54) {
    return interval_meters <= 2.5;
  } else {
    return interval_meters <= 3.0;
  }
}
```

---
*Fin del documento de extracción normativa y especificación para auditoría de sistemas de tuberías de gases medicinales y vacío según ISO 7396-1:2007.*
