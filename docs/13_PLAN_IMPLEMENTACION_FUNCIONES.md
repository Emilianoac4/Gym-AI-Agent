# GymAI - Plan Prioritario de Implementacion de Funciones

**Version**: 2.0  
**Fecha**: Abril 1, 2026  
**Estado**: PRIORIDAD TOTAL DE PRODUCTO Y DESARROLLO  
**Objetivo**: ejecutar la nueva perspectiva de 3 perfiles (administrador, entrenador, usuario) con base tecnica solida, trazabilidad y foco en retencion.

---

## 1) Prioridad Oficial

Este documento pasa a ser la referencia principal de ejecucion.

- Toda decision funcional nueva debe alinearse a este plan.
- Se prioriza construir cimientos (permisos, datos y auditoria) antes de crecer modulos.
- No se considera completa una funcion sin criterios de salida y metricas.

### Supuestos confirmados del piloto (actualizado Abril 2026)

- Fecha objetivo de piloto: **21 de abril de 2026**.
- Escala de piloto inicial: **1 gimnasio** con **10-15 usuarios** conocidos para feedback continuo.
- Orden de prioridad del piloto: **1) calidad tecnica**, **2) ingresos**, **3) retencion**.
- Multi-tenant obligatorio: **prohibido cruce de informacion entre gimnasios**.
- Idioma de producto en piloto: **espanol** en toda la experiencia.

### Necesidades recibidas por definir en detalle

- **Integracion Hacienda (Costa Rica)**
	- Alcance confirmado por ahora: generar reportes de Hacienda con base en los movimientos registrados en la app.
	- Prioridad actual: **baja** (no bloquea piloto).
	- Estado: pendiente definir formato exacto de salida, periodicidad del reporte y campos fiscales obligatorios por movimiento.

- **Integracion de metricas corporales con Apple Health y Google Fit**
	- Alcance confirmado por ahora: **solo lectura** de datos de salud corporal.
	- Frecuencia objetivo: sincronizacion **automatica diaria**.
	- Consentimiento: el usuario autoriza en primer ingreso o al usar el boton de importacion de marcas.
	- Revocacion: desde ajustes del sistema operativo (iOS/Android).
	- Regla de control de usuario: el dato manual se mantiene y tiene prioridad cuando exista conflicto.
	- Mediciones canonicas definidas para Tuco:
		- Peso
		- IMC
		- Porcentaje de grasa corporal
		- Masa magra (lean body mass)
		- Masa muscular
		- Masa grasa
		- Agua corporal
		- Masa osea
		- Grasa visceral
		- Proteina
		- Edad metabolica
		- Nivel de obesidad
		- Peso estandar
	- Regla de ajuste durante pruebas: si una metrica canonica no puede obtenerse de forma confiable desde proveedor/dispositivo, se elimina temporalmente del alcance de integracion.
	- Estado: validacion con balanza real **pendiente** y documentada como prerequisito de cierre para esta necesidad.

- **Descriptor de necesidad del usuario (rutinas IA con validacion humana)**
	- Alcance inicial: disponible para **todos los usuarios** en piloto (sin recorte por membresia en esta etapa).
	- Flujo principal: el usuario describe su contexto/necesidad; IA genera propuesta de rutina especializada con prioridad a ese contexto.
	- Checklist obligatorio: incluir validaciones minimas de seguridad/lesion antes de generar propuesta.
	- Estados del flujo definidos:
		- `BORRADOR_IA`
		- `EN_ESPERA_VALIDACION`
		- `APROBADA`
		- `RECHAZADA`
		- `AJUSTADA`
	- Validacion humana: puede validar **cualquier trainer** del gimnasio.
	- SLA de validacion: maximo **1 hora**, contado solo dentro de la franja de apertura configurada del gimnasio.
	- Accion ante rechazo: el trainer realiza ajuste/edicion manual (sin regeneracion automatica obligatoria).
	- Si no hay trainer disponible: se permite **autoaprobacion** con disclaimer visible para el usuario y se crea alerta prioritaria para trainers.
	- Escalamiento por dolor persistente/riesgo: crear tarea interna en panel de administrador con nombre, padecimiento y datos personales disponibles bajo permisos del rol.
	- Estado: pendiente definir UX exacta de validacion trainer y plantilla de disclaimer de autoaprobacion.

- **Sistema de recuperacion de usuarios en abandono (retencion comercial)**
	- Enfoque confirmado: recuperacion de clientes del gimnasio por usuario (no es recuperacion de lesiones).
	- Mecanismo inicial: estrategia basada en prompt para generar plan de recuperacion individual y accionable.
	- Alcance esperado del plan generado: riesgo actual, causas probables, propuesta de mensaje, propuesta de accion y seguimiento.
	- Salida recomendada: plan con objetivo a 7/14/30 dias y pasos concretos para admin/trainer.
	- Motor de asistencia valida para inactividad: **OR entre fuentes**. Se considera asistencia del dia si existe al menos una de estas fuentes: (1) check-in de puerta inteligente o (2) marca de entrenamiento en app.
	- Regla de ausencia: si no existe ninguna fuente valida para el dia, se registra como ausencia.
	- Segmentacion temporal cerrada:
		- Segmento A (Reactivacion): ausencia validada entre **7 y 15 dias**, incluyendo ambos extremos.
		- Segmento B (Vencimiento): membresia vencida entre **5 y 30 dias**, incluyendo ambos extremos.
		- Segmento C (Abandono): inactividad de membresia vencida de largo plazo, implementacion inicial en **91 dias** por menor complejidad tecnica.
	- Exclusividad de segmentos: un usuario solo puede pertenecer a **un segmento activo por dia** (sin pertenencia multiple).
	- Job diario de segmentacion: ejecucion a las **09:00 America/Costa_Rica**.
	- Ventana de silencio confirmada: bloqueo de envios entre **21:00 y 07:00**, con reprogramacion automatica a **07:01**.
	- Programacion de envio: fuera de ventana de silencio, priorizar envio a la hora habitual de entrenamiento del usuario cuando ese dato exista.
	- Zona horaria por tenant: hoy se inicializa en **America/Costa_Rica**, pero el calculo de ventana de silencio debe usar la **timezone propia del tenant** cuando exista una distinta en el futuro.
	- Enfriamiento de 3 dias: inicia **al momento del envio** del primer mensaje de recuperacion. En fase inicial, la no respuesta se interpreta como no interaccion y activa bloqueo temporal.
	- Evento de visto: no requerido en fase inicial (no se implementa evento explicito de lectura/apertura para activar enfriamiento).
	- Alerta asincrona temprana: al encolar el primer mensaje de recuperacion, se envia **push al admin** del gimnasio.
	- Manual override: control exclusivo del **rol admin**.
	- Alcance de manual override: **por usuario** (no global por tenant).
	- Comportamiento del override: pausa inmediata del bot para ese usuario; se reactiva automaticamente cuando se abra un **nuevo ticket de recuperacion** en un ciclo posterior.
	- Handoff automatico (fase 1): clasificacion por **reglas/keywords**.
	- Categorias de handoff obligatorio: queja operativa, maltrato personal, equipo defectuoso, lenguaje hostil, riesgo legal.
	- En handoff: crear **ticket interno obligatorio** para seguimiento del admin.
	- IA JSON obligatorio: cuando GPT no cumpla estructura exacta, ejecutar **2 reintentos automaticos** y luego aplicar fallback seguro.
	- Validacion Zod del JSON IA: validacion **parcial con tolerancia**; si un campo requerido falta, se marca como `null` con flag de error en la respuesta pero no se descarta el objeto completo. Esto maximiza resiliencia operativa.
	- Canales de ejecucion activa en fase 1: **push y en-app** unicamente. WhatsApp, email y llamada quedan como recomendaciones sugeridas en el JSON de IA, no ejecutadas automaticamente.
	- Idioma del agente de recuperacion: **espanol siempre**, independiente del idioma del usuario.
	- Primer mensaje (pregunta filtro): generado por **IA con guardrails** (sin plantilla fija, con restricciones de mision y tono controladas por system prompt).
	- Auditoria de recuperacion: guardar **prompt enviado, respuesta cruda de GPT y JSON parseado** por cada interaccion.
	- Retencion de auditoria: **1 ano** para logs de envios, estados de conversacion y handoffs.
	- Derecho de oposicion: si el usuario indica "no me contacten", se aplica **bloqueo permanente** hasta revocacion manual por el admin.
	- Consentimiento legal: **checkbox explicito en app**, integrado dentro del flujo de aceptacion de terminos y condiciones del gimnasio. Texto sugerido: "Acepto recibir mensajes de seguimiento y reactivacion de parte del gimnasio". Este consentimiento es independiente del permiso push del sistema operativo (iOS/Android); ambas capas deben estar activas para que el sistema envie mensajes de recuperacion.
	- Endpoints existentes para notificaciones push (ya en produccion):
		- `POST /notifications/push-token`: registro de token Expo por usuario.
		- `DELETE /notifications/push-token`: eliminacion de token.
		- `POST /notifications/general`: envio broadcast a gimnasio.
		- `GET /notifications/general`: listado de notificaciones enviadas.
		- Hilos de mensajeria directa admin-usuario y tickets de emergencia tambien disponibles.
	- Endpoints faltantes para el sistema de recuperacion: ninguno de los actuales cubre segmentacion, estados de conversacion, handoff ni override. Deben crearse en modulo nuevo.
	- Modulo administrativo de recuperacion: se implementa como **modulo independiente `recovery`** (no dentro de operations). Razon: el modulo operations gestiona KPIs y reportes financieros; mezclar flujos de recuperacion automatizada lo haria inmantenible. Modulo separado permite permisos, rutas y workers propios sin acoplamiento.
	- Politica de stop de recuperacion (cerrada y aprobada):
		1. Stop inmediato permanente si usuario solicita no contacto (bloqueo hasta revocacion manual por admin).
		2. Stop inmediato por manual override activo del admin.
		3. Stop por handoff automatico hasta cierre humano del ticket.
		4. Stop por conversion lograda (renovacion o reactivacion de membresia completada).
		5. Stop temporal por enfriamiento de **3 dias** cuando no hay respuesta al primer contacto.
		6. Stop definitivo del ciclo a los **30 dias** sin respuesta efectiva del usuario.
		7. Reingreso al sistema solo si aparece un nuevo evento de riesgo en un ciclo posterior.
	- Estado: pendiente definir responsable de aprobacion/versionado del prompt de produccion y reglas finas de prioridad entre horario habitual vs hora fija de ejecucion diaria.

- **CRUD administrativo de ofertas de reenganche**
	- Permisos: solo el **admin** puede crear, editar, activar o eliminar ofertas.
	- Eliminacion: **soft delete con auditoria** (sin hard delete).
	- Regla de composicion: una oferta personalizada permite **una sola mecanica por oferta** (no combinaciones de descuento + gracia en el mismo registro).
	- Pase de invitado QR: no se implementa integracion con torniquetes QR en esta fase.
	- Moneda de oferta: se adapta a la **moneda de preferencia del gimnasio/cliente**.
	- Conversion de monedas: no aplica en fase actual (no se implementa motor de conversion).
	- Regla de presentacion monetaria: mostrar siempre **2 decimales**.
	- Regla de redondeo para ofertas: se permiten montos redondeados y valores cerrados segun politica comercial definida por el gimnasio.

- **Sistema de documentacion y limitacion de tokens LLM**
	- Tipo de metrica requerida: uso de **tokens LLM reales** (tal como se consumen en proveedor OpenAI).
	- Estrategia inicial: primero instrumentar visualizacion para estimar consumo diario real durante piloto.
	- Zona horaria oficial de corte diario: **America/Costa_Rica**.
	- Comportamiento al alcanzar limite: **degradar modelo** (en lugar de bloqueo total).
	- Admin puede otorgar cupo adicional: **si**, con limite maximo configurable (no infinito).
	- Vistas requeridas en panel master admin:
		- por gimnasio
		- por usuario
		- por modulo/tipo de consumo
	- Frecuencia de actualizacion de visualizacion: cada **1 hora**.
	- Retencion historica: **90 dias**, con vistas de consumo **total** y **diario**.
	- Alertas al usuario final por consumo: **no** requeridas en esta etapa.
	- Estado: pendiente definir valor numerico inicial de limite diario por membresia despues de medicion del piloto.

- **Personalizacion del tono de Tuco por persona**
	- Visibilidad del perfil de tono/personalidad: **IA y admin**.
	- Configuracion manual de preferencias: no se expone panel dedicado; el ajuste se realiza de forma dinamica segun el tono que el usuario use en conversacion (estilo ChatGPT).
	- Consentimiento explicito para activar personalizacion: **no requerido** en esta etapa (viene activo por defecto).
	- Solicitud de eliminacion del perfil conversacional: se aplica **soft delete con retencion controlada**, manteniendo identidad solo para consulta de admin autorizado con trazabilidad de acceso.
	- Estado: pendiente definir reglas de auditoria de cambios de tono visibles para admin.

- **Preferencia de ejercicios por usuario (like/dislike y favoritos)**
	- Alcance de preferencia: por **objetivo** del usuario (no global unico).
	- Regla de uso en generacion: afecta tanto rutinas generadas por **IA** como rutinas personalizadas por **trainer**.
	- Restriccion por dislike: puede ser anulada mediante **override de trainer** cuando exista justificacion tecnica.
	- Limite de favoritos por usuario: **sin limite** en esta etapa.
	- Estado: pendiente definir taxonomia final de objetivos para asegurar consistencia en reglas de preferencia.

- **Mejora del sistema de KPIs para administrador**
	- Visualizacion avanzada: cada KPI debe permitir detalle con graficos de tendencia en ventanas **7/30/90 dias**.
	- Explicacion asistida por IA: obligatoria en **tono tecnico** (no variable).
	- Salida IA sobre KPI: debe incluir **recomendaciones accionables** para operacion.
	- **KPIs prioritarios (piloto - implementacion inicial):**
		1. Usuarios en riesgo de abandono
		2. Ingresos diarios
		3. Ingresos mensuales acumulados
		4. Mora o pagos pendientes
		5. Satisfaccion promedio de asistencia (rating)
	- **KPIs secundarios (definidos, implementacion posterior):**
		- Gestion de ingresos:
			- Renovaciones de membresia por dia
			- Nuevos registros diarios
			- Tasa de renovacion sobre vencimientos
		- Gestion de usuarios:
			- Ingreso promedio por usuario activo (ARPU operativo)
			- Tasa de retencion D7
			- Tasa de retencion D30
			- Solicitudes de asistencia creadas
			- Usuarios activos diarios (DAU)
			- Usuarios activos semanales (WAU)
			- Usuarios activos mensuales (MAU)
			- Tasa de activacion (registro → primera rutina completada)
		- Gestion de calidad de entrenadores:
			- Tiempo medio de primera respuesta de trainer
			- Tiempo medio de resolucion de asistencia
			- Tasa de resolucion de asistencia
			- Entrenadores activos ahora
			- Carga operativa por trainer (usuarios atendidos)
			- Tasa de autoaprobacion por ausencia de trainer
	- **KPIs de master admin (panel central Tuco - no perfil admin de gimnasio):**
		- Rutinas generadas por IA por dia
		- Consumo total de tokens IA por dia
		- Consumo de tokens IA por usuario
		- Consumo de tokens IA por gimnasio
		- Costo estimado IA diario
		- Eficiencia IA (tokens por rutina util/aprobada)
	- Definiciones operativas cerradas para KPIs prioritarios:
		- Usuarios en riesgo de abandono:
			- Regla: usuarios con membresia activa y sin registro de entrenamiento entre 7 y 15 dias.
			- Niveles: amarillo (7-10 dias sin registro), rojo (11-15 dias sin registro).
			- Fuente de registro: evento biometrico de ingreso o marca de ejercicio en app.
		- Ingresos diarios:
			- Regla: suma diaria de movimientos monetarios por renovaciones y nuevos usuarios.
			- Corte diario: zona horaria America/Costa_Rica.
		- Ingresos mensuales acumulados:
			- Regla: acumulado del mes calendario actual por gimnasio (del dia 1 al ultimo dia del mes).
		- Mora o pagos pendientes:
			- Regla de visualizacion: lista de usuarios por color de semaforo.
			- Semaforo: verde (>= 5 dias para vencer), amarillo (4-0 dias para vencer), rojo (vencido).
		- Satisfaccion promedio de asistencia (rating):
			- Regla: promedio historico de calificaciones de asistencia, con desglose por trainer.
	- Estado: formulas de KPI prioritario cerradas; pendiente implementacion tecnica y contrato API final.

- **Migracion de un nuevo gimnasio al servicio Tuco**
	- Metodo principal de onboarding/migracion: **importacion por CSV**.
	- Alcance de datos a migrar: **solo usuarios activos actuales** del gimnasio.
	- Activacion post-migracion: envio de comunicacion de bienvenida/activacion masiva habilitado.
	- Responsable de auditoria de calidad de datos previo a activar: **validacion manual del owner del proyecto**.
	- Automatizacion asistida: documentar una herramienta IA de apoyo a auditoria/limpieza de CSV como mejora futura (no prioritaria en piloto).
	- Estado: pendiente definir plantilla CSV oficial, reglas de validacion y politica de manejo de duplicados.

- **Cronometro en pantalla de rutinas**
	- Alcance: cronometro por ejercicio individual (no cronometro global de sesion).
	- Ubicacion visual: visible junto al nombre del ejercicio.
	- Comportamiento al activar: el ejercicio cambia de estado a `EN_PROGRESO`.
	- Presets por tipo de ejercicio (cuenta regresiva al activar cronometro):
		- Compuesto (sentadilla, peso muerto, press): **40 segundos activos / 90 segundos descanso entre series**.
		- Aislado (curl, extension, elevacion): **30 segundos activos / 60 segundos descanso entre series**.
		- Rehabilitacion/movilidad: **45 segundos activos / 45 segundos descanso entre series**.
	- Estos valores son modificables por el entrenador al asignar la rutina.
	- Comportamiento al completar serie: cronometro del ejercicio se desactiva automaticamente al marcar la serie como terminada.
	- Comportamiento sin marca registrada: si el cronometro finalizo pero el usuario no registro carga/repeticiones, el ejercicio se guarda como `REALIZADO_SIN_MARCA`.

- **Seguimiento de dolencias del usuario (popup de revision)**
	- Activacion: cuando el usuario registra un dolor en la app, el sistema programa checkpoints de seguimiento a los **1, 3 y 7 dias**.
	- Aplicabilidad: solo para dolencias clasificadas como **recuperables en ese plazo** (ejemplo: contractura, sobrecarga, molestia aguda). El sistema no genera checkpoints para condiciones cronicas o diagnosticos medicos graves (ejemplo: cancer, hernia operada, fractura activa).
	- Clasificacion: el usuario indica el tipo de dolor al registrarlo; el sistema determina si aplica seguimiento automatico segun esa clasificacion.
	- Canal de notificacion: **alerta en pantalla** que aparece **una unica vez por dia** al abrir la app durante los dias de seguimiento activos. No es push notification externa.
	- Alerta al entrenador: si, el entrenador recibe una **alerta en su panel** cuando un usuario tiene una dolencia activa con seguimiento en curso.
	- Alerta al entrenador es pasiva (visible en panel), no push.
	- Accion esperada del usuario en el popup: confirmar si el dolor persiste, mejoro o desaparecio.
	- Si el dolor desaparece antes del plazo: seguimiento se cierra; no se generan mas alertas para ese episodio.
	- Estado: pendiente definir lista de categorias de dolor clasificadas como "recuperables" vs "cronicas/graves" para filtro de activacion.

- **Guia de ejercicios (biblioteca de contenido)**
	- Tipo de contenido: videos propios del gimnasio (no embeds de YouTube).
	- Quienes pueden subir: trainers del gimnasio.
	- Quienes pueden actualizar/editar: trainers del gimnasio.
	- Acceso de usuarios finales: visualizacion solamente, sin capacidad de subida.
	- Moderacion de contenido: **automatica via IA o algoritmos de deteccion** previo a publicacion. El video no queda visible hasta pasar la revision. Detecta: contenido sexual, violencia, material inapropiado.
	- Flujo de publicacion: trainer sube video → moderacion automatica → si pasa: publicado; si falla: rechazado con motivo, sin intervencion manual requerida en el flujo normal.
	- Aprobacion manual adicional: no requerida si la moderacion automatica aprueba.
	- Duracion maxima del video: **15 segundos** (clip demostrativo de ejecucion del ejercicio).
	- Asociacion: cada video se vincula a un ejercicio especifico de la biblioteca.
	- Estado: pendiente seleccionar proveedor de moderacion automatica (opciones: AWS Rekognition Video, Google Video Intelligence, o moderacion via OpenAI Vision frame-by-frame); pendiente definir politica de almacenamiento (Supabase Storage vs CDN externo).

- **Patologias en perfil de usuario**
	- Quien puede registrar: el propio usuario y quienes el mismo autorice (control de privacidad por usuario).
	- Quien puede consultar: el propio usuario y sus autorizados. El entrenador accede solo si el usuario lo autoriza.
	- Modalidad de ingreso: seleccion multiple de lista predefinida + campo "Otra patologia" de texto libre.
	- Lista oficial aprobada (36 entradas):
		- **Cardiovascular**: Hipertension arterial, Cardiopatia isquemica / angina, Arritmia cardiaca, Insuficiencia cardiaca, Marcapasos implantado.
		- **Respiratorio**: Asma, EPOC, Apnea del sueno.
		- **Metabolico / Endocrino**: Diabetes tipo 1, Diabetes tipo 2, Hipotiroidismo / Hipertiroidismo, Obesidad morbida.
		- **Musculoesqueletico**: Hernia discal (cervical / lumbar), Escoliosis, Osteoporosis / osteopenia, Artritis reumatoide, Artrosis (cadera, rodilla, hombro), Tendinitis cronica, Lesion de ligamento cruzado (ACL/PCL), Sindrome de manguito rotador, Fractura en rehabilitacion, Protesis articular (cadera / rodilla), Fibromialgia.
		- **Neurologico**: Epilepsia, Esclerosis multiple, Parkinson, Migrana cronica.
		- **Oncologico**: Cancer activo (en tratamiento), Cancer en remision.
		- **Salud mental**: Trastorno de ansiedad generalizada, Depresion clinica, Trastorno alimentario (anorexia / bulimia).
		- **Urinario / Renal**: Insuficiencia renal cronica, Calculos renales (litiasis), Incontinencia urinaria, Prostatitis cronica.
		- **Embarazo / Postparto**: Embarazo activo, Postparto reciente (menos de 6 meses).
		- **Otro**: campo abierto de texto libre.
	- Uso por Tuco (IA): las patologias registradas se inyectan como contexto en el prompt del asistente para personalizar recomendaciones y evitar indicaciones contraindicadas.
	- Historial: se conservan patologias previas aunque el usuario las desactive (soft delete con fecha de baja).
	- Alerta al entrenador por cambio de patologia: no. El entrenador no recibe notificacion cuando el usuario modifica sus patologias.

- **Integridad de registros de pago al borrar usuario**
	- Comportamiento al eliminar usuario: el borrado es **logico (soft delete)**. Los registros de transacciones historicas se conservan intactos con el nombre del usuario referenciado.
	- Anonimizacion: no. Los registros conservan la identidad del pagador porque es requerimiento de trazabilidad operativa y fiscal.
	- Retencion de historicos: **hasta que el gimnasio cancele el servicio Tuco**. Al cancelar, los datos quedan sujetos a la politica de baja de datos del contrato.
	- Acceso post-baja de usuario: el admin del gimnasio puede seguir consultando el historial de pagos de un usuario dado de baja.
	- Garantia tecnica: ningun endpoint de eliminacion de usuario debe ejecutar `DELETE` en cascada sobre tablas de transacciones o membresias. Requiere test automatizado que valide esta restriccion.

---

## 2) Nueva Vision de Roles

## Administrador (dueno del gimnasio)

- Ver entrenadores activos en tiempo real.
- Ver usuarios activos en tiempo real.
- Ver usuarios con suscripcion activa y vencimientos.
- Ver metricas de negocio (altas, renovaciones, ingresos, retencion).
- Gestionar usuarios (incluye eliminacion con auditoria).
- Recibir alertas de riesgo de abandono.

## Entrenador (colaborador)

- Registrar usuarios nuevos.
- Renovar suscripciones existentes.
- Registrar metodo de pago y monto por operacion.
- Marcar estado operativo (activo/no operativo).
- Recibir solicitudes de asistencia de usuarios.
- Ver rutinas que usuarios estan ejecutando en tiempo real.

## Usuario (cliente final)

- Chat IA personalizado.
- Rutinas personalizadas y seguimiento de progreso.
- Ver entrenadores operativos.
- Consultar dias restantes de suscripcion.
- Solicitar asistencia y calificar atencion (1-5 estrellas).
- Ver progreso calendarizado (minimo 3 meses).

---

## 3) Aspectos Criticos a Implementar Antes de Escalar Funciones

Estas reglas son obligatorias antes de abrir modulos nuevos:

1. Matriz de permisos por accion (no solo por rol).
2. Modelo de datos separado para suscripcion, pago, asistencia y acceso.
3. Estados estandar para asistencia a entrenador:
	 - `CREATED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `RATED`.
4. Estados operativos estandar para entrenador:
	 - `ACTIVE`, `PAUSED`, `OFFLINE`.
5. Auditoria de acciones sensibles:
	 - altas, renovaciones, eliminaciones, cambios de cobro.
6. Politica de privacidad para datos sensibles:
	 - salud, biometria, asistencia, pagos.
7. Definicion unica de "usuario activo hoy":
	 - por acceso biometrico, check-in manual o ambos (regla documentada).

---

## 4) Estado Actual (baseline tecnico)

- IA operativa para rutina, nutricion, chat y tip.
- Memoria conversacional en chat implementada.
- Progreso de rutina y cargas implementado para usuario.
- Roles activos hoy: `member` y `admin`.

Brecha principal:

- Falta introducir rol `trainer` y permisos granulares por accion.
- Falta capa operativa (suscripciones, cobros, asistencia, actividad en tiempo real).

---

## 5) Roadmap Priorizado por Fases

## Fase 0 (bloqueante): Fundacion de Roles, Permisos y Datos

**Objetivo**: evitar retrabajo y asegurar control operativo.

### Entregables

- Nuevo rol `trainer` en dominio y auth.
- Matriz de permisos por endpoint/accion.
- Entidades base:
	- `subscriptions`
	- `payments`
	- `trainer_presence`
	- `assistance_requests`
	- `access_events`
	- `audit_logs`
- Contrato de eventos para dashboard (eventos diarios agregables).

### Criterios de salida

- Ningun endpoint sensible funciona sin permiso correcto.
- Toda operacion de alta/renovacion/eliminacion queda auditada.

## Fase 1: Operacion de Entrenador

**Objetivo**: habilitar trabajo diario de colaboradores.

### Entregables

- Alta de usuario por entrenador.
- Renovacion de usuario por entrenador.
- Registro de cobro por operacion (monto + metodo).
- Boton de estado operativo entrenador.
- Bandeja de solicitudes de asistencia.

### Criterios de salida

- Cada alta/renovacion crea transaccion y auditoria.
- Entrenador puede aceptar y cerrar asistencia desde mobile.

## Fase 2: Panel Administrador MVP

**Objetivo**: visibilidad de negocio y operacion en tiempo real.

### Entregables

- KPI en vivo:
	- entrenadores activos
	- usuarios activos
	- usuarios con mensualidad activa
- KPI diarios:
	- nuevos usuarios
	- renovaciones
	- ingresos
- Reporte de riesgo de abandono (>=6 dias sin asistencia).
- Interaccion avanzada de KPIs en tarjetas (click/tap por tarjeta) para desplegar detalle contextual:
	- grafico de tendencia (7/30/90 dias)
	- comparativo vs periodo anterior
	- top segmentos relevantes (por ejemplo: plan, horario o estado de suscripcion)
	- ultimo timestamp de actualizacion y fuente del dato

### Criterios de salida

- Dashboard usable en mobile y desktop.
- Datos consistentes con transacciones reales del sistema.
- Cada tarjeta KPI permite drill-down sin cambiar de modulo y muestra tendencia historica util para decision operativa.
- Tiempo de carga del detalle por tarjeta dentro de umbral aceptable para uso diario (objetivo inicial <= 2s en red local/estable).

## Fase 3: Usuario Avanzado

**Objetivo**: experiencia personalizada y retencion.

### Entregables

- Solicitud de asistencia desde usuario.
- Calificacion de atencion (1-5 estrellas).
- Progreso calendarizado 3 meses.
- Consulta de dias restantes de suscripcion.

### Criterios de salida

- Usuario puede ver progreso y estado de suscripcion sin friccion.
- Calificaciones impactan metricas de entrenador/admin.

## Fase 4: Integraciones Externas

**Objetivo**: cerrar circuito de datos reales del gimnasio.

### Entregables

- Integracion con sistema biometrico de acceso.
- Integracion salud (Apple Health y Google ecosystem).
- Pipeline de eventos para reportes y alertas.

### Criterios de salida

- Registro de accesos en tiempo real por usuario.
- Datos de salud sincronizados de forma controlada y auditable.

---

## 6) Backlog Tecnico Priorizado (Top 12)

1. Introducir rol `trainer` en auth, schema y mobile session.
2. Crear matriz permisos por accion y middleware centralizado.
3. Crear entidades `subscriptions` y `payments`.
4. Crear endpoints de alta/renovacion por entrenador.
5. Crear `trainer_presence` con estado operativo.
6. Crear `assistance_requests` con workflow completo.
7. Crear `audit_logs` para acciones sensibles.
8. Crear agregaciones diarias para panel admin.
9. Exponer KPI de actividad y churn inicial.
10. Exponer consulta de suscripcion para usuario.
11. Exponer calendario de progreso de 3 meses.
12. Preparar adaptador de integracion biometrica.

---

## 7) Riesgos y Mitigacion

- Riesgo de permisos insuficientes:
	- Mitigacion: matriz de permisos y tests de autorizacion por rol.
- Riesgo de inconsistencias en pagos/suscripciones:
	- Mitigacion: transacciones atomicas y auditoria obligatoria.
- Riesgo de privacidad de datos sensibles:
	- Mitigacion: minimizacion de datos, cifrado y trazabilidad de acceso.
- Riesgo de dependencia de terceros (biometria/salud):
	- Mitigacion: capa adaptadora por proveedor.

---

## 8) Metricas de Exito (producto + operacion)

- Retencion semanal de usuarios.
- % usuarios con 2+ sesiones por semana.
- Tiempo medio de respuesta de asistencia entrenador.
- % solicitudes de asistencia resueltas.
- Ingresos diarios y renovaciones diarias.
- Usuarios en riesgo de abandono.
- Satisfaccion media de atencion de entrenador.

---

## 9) Plan de Ejecucion Inmediata (sprints)

## Sprint 1 (72 horas)

1. Rol `trainer` + matriz de permisos por accion.
2. Entidades `subscriptions`, `payments`, `audit_logs`.
3. Endpoints de alta y renovacion por entrenador.

## Sprint 2

1. Estado operativo de entrenadores.
2. Solicitudes de asistencia con ciclo completo.
3. KPI admin en vivo (activos y mensualidades activas).

## Sprint 3

1. KPI historicos (altas, renovaciones, ingresos).
2. Alerta de riesgo de abandono.
3. Consulta de suscripcion y progreso calendarizado en perfil usuario.
4. Drill-down de tarjetas KPI con graficos de tendencia mensual y comparativo de periodo.

---

## 10) Regla de Prioridad

Este plan tiene prioridad sobre propuestas anteriores mientras no se emita una version superior.

---

## 11) Plan de Accion Completo por Necesidad (actualizado Abril 2026)

### Criterios globales de clasificacion
- **Piloto (P)**: debe estar funcional antes del 21 de abril de 2026.
- **Piloto condicional (PC)**: objetivo del piloto, pero con regla de corte: si el bloqueante tecnico indicado no se resuelve antes del 14 de abril, pasa automaticamente a post-piloto sin afectar el resto.
- **Post-piloto inmediato (PP)**: entra en el ciclo siguiente al piloto.
- **Futuro (F)**: sin fecha comprometida, documentado para planificacion.

---

### Matriz de evaluacion de implementacion

| # | Necesidad | Dificultad | Riesgo de dependencias | Impacto en piloto | Prioridad |
|---|---|---|---|---|---|
| 1 | Integridad de pago al borrar usuario | Baja | Sin dependencias bloqueantes | Alto — seguridad de datos critica | **P** |
| 2 | Personalizacion tono Tuco | Baja | Modulo IA ya existe | Alto — mejora core del producto desde dia 1 | **P** |
| 3 | Guardar credenciales en dispositivo | Media | Solo mobile, sin backend nuevo | Alto — UX de login y retencion | **P** |
| 4 | Cronometro en pantalla de rutinas | Baja-Media | Modulo de rutinas ya existe | Alto — engagement directo en sesion | **P** |
| 5 | Observabilidad tokens LLM | Media | Todas las llamadas OpenAI ya existen | Alto — control de costos desde dia 1 del piloto | **P** |
| 6 | Patologias en perfil de usuario | Media | Requiere migracion Prisma + inyeccion IA | Alto — personaliza y protege al usuario en rutinas | **P** |
| 7 | KPIs admin (5 prioritarios) + drill-down | Media | Base en operations.controller existente | Alto — visibilidad operativa del negocio | **P** |
| 8 | Preferencia de ejercicios like/dislike | Media | Modulo IA + pendiente taxonomia de objetivos | Medio — mejora personalizacion | **P** |
| 9 | Descriptor de necesidad / rutinas IA + trainer | Alta | Modulo IA + modulo trainer + notificaciones | Alto — flujo central del producto | **P** |
| 10 | Hacienda Costa Rica | Media | Solo depende de transacciones existentes | Bajo en piloto (1 gym, escala minima) | **PC** — bloqueante: definir formato fiscal |
| 11 | Guia de ejercicios en video | Alta | Proveedor moderacion (**sin resolver**) + Storage (**sin resolver**) | Medio | **PC** — corte el 14 abr si bloqueantes no cierran |
| 12 | Apple Health / Google Fit | Alta | SDKs nativos iOS/Android + balanza real (**sin validar**) | Medio | **PC** — corte el 14 abr si bloqueantes no cierran |

---

### Orden de implementacion recomendado (por dependencias + impacto + dificultad)

#### Semana 1 — Dias 1-4 (7 al 10 de abril)
**Objetivo**: cimientos, quick wins y modelo de datos.

| Orden | Entregable | Razon |
|---|---|---|
| 1 | Integridad de pago al borrar usuario | Baja dificultad, cero riesgo, deuda tecnica critica |
| 2 | Apple Health / Google Fit — evaluacion de viabilidad | **Adelantado por dependencia**: patologias + Apple Health son prerequisitos para rutinas IA avanzadas. Iniciar aqui permite detectar si el bloqueante (balanza real) es resoluble antes del 14 abr; si no es viable, rutinas IA se delimitan a datos manuales sin afectar el resto del plan |
| 3 | Personalizacion tono Tuco | Baja dificultad, cero dependencias nuevas, impacto inmediato en chat |
| 4 | Observabilidad tokens LLM | Aprovecha infraestructura existente; sin esto operamos el piloto a ciegas en costos |
| 5 | Patologias en perfil (modelo DB + privacidad + inyeccion IA) | Habilita Tuco para personalizar con seguridad clinica; prerequisito de rutinas IA |

#### Semana 1 — Dias 5-7 (11 al 13 de abril)
**Objetivo**: experiencia mobile del usuario.

| Orden | Entregable | Razon |
|---|---|---|
| 5 | Guardar credenciales en dispositivo | Dependencia: solo mobile; alta retenccion; sin friccion de login |
| 6 | Cronometro en pantalla de rutinas | Dependencia: solo mobile; impacto directo durante sesion de entrenamiento |
| 7 | Preferencia de ejercicios like/dislike | Requiere taxonomia de objetivos; si no esta cerrada para esta fecha, se implementa con lista provisional |

#### Semana 2 — Dias 8-10 (14 al 16 de abril)
**Objetivo**: core del producto y visibilidad del negocio.

| Orden | Entregable | Razon |
|---|---|---|
| 8 | Descriptor de necesidad / rutinas IA + validacion trainer | Alta complejidad; requiere estados, SLA, notificaciones y autoaprobacion |
| 9 | KPIs admin (5 prioritarios) + drill-down + explicacion IA | Existe base tecnica; alta prioridad para admin en piloto |

#### Semana 2 — Dias 11-14 (17 al 20 de abril) — Condicionales
**Objetivo**: cierre de items condicionales si bloqueantes estan resueltos.

| Orden | Entregable | Condicion de entrada |
|---|---|---|
| 10 | Hacienda Costa Rica | Formato fiscal definido antes del 14 abr |
| 11 | Guia de ejercicios en video | Proveedor moderacion y storage definidos antes del 14 abr |
| 12 | Apple Health / Google Fit | Validacion con balanza real completada antes del 14 abr |

**Regla de corte**: si el 14 de abril el bloqueante de cualquier item condicional (PC) no esta resuelto, ese item pasa automaticamente a post-piloto. Esta decision no afecta los items P del cronograma.

#### Dia 20 de abril — Buffer
- Integracion, pruebas en dispositivo real, correcciones de bugs criticos.
- Sin nuevos desarrollos. Solo estabilizacion.

---

### BLOQUE 1 — Cimientos obligatorios (sin esto nada funciona)

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 1 | Integridad de registros de pago al borrar usuario | Garantizar soft delete; test automatizado de no-cascada | **P** |
| 2 | Patologias en perfil de usuario | Modelo DB, lista aprobada, control de privacidad por usuario, inyeccion en Tuco | **P** |
| 3 | Guardar credenciales en dispositivo | Sesion persistente + Keychain/Keystore + biometrico | **P** |

**Criterio de salida del bloque**: test de borrado de usuario pasa sin afectar transacciones; patologias en perfil funcionan y se inyectan en chat.

---

### BLOQUE 2 — Experiencia de entrenamiento del usuario (core mobile)

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 4 | Cronometro en pantalla de rutinas | Frontend mobile; estados `EN_PROGRESO` / `REALIZADO_SIN_MARCA`; presets por tipo | **P** |
| 5 | Preferencia de ejercicios like/dislike | Modelo por objetivo; afecta IA y trainer; override de trainer | **P** |
| 6 | Descriptor de necesidad (rutinas IA + validacion trainer) | Estados de flujo, SLA 1h, autoaprobacion con disclaimer | **P** |
| 7 | Seguimiento de dolencias (popup 1-3-7 dias) | Modelo de episodio; logica de categoria recuperable vs cronica; alerta pasiva trainer | **PP** |

**Criterio de salida del bloque**: usuario puede completar una sesion de entrenamiento con cronometro, registrar preferencias y recibir rutina IA validada por trainer.

---

### BLOQUE 3 — Visibilidad operativa del administrador

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 8 | KPIs admin (5 prioritarios) con drill-down 7/30/90d y IA | Formulas cerradas; graficos de tendencia; explicacion IA accionable | **P** |
| 9 | Mejora de visualizacion de KPIs (tarjetas clickeables) | Drill-down por tarjeta sin cambiar modulo | **P** |
| 10 | Acceso delegado / impersonation de cuentas | Endpoint seguro; sin contrasenas; auditoria completa | **PP** |

**Criterio de salida del bloque**: admin puede ver los 5 KPIs prioritarios con tendencias y recibir recomendaciones IA por cada uno.

---

### BLOQUE 4 — Sistema de recuperacion de clientes (modulo `recovery`)

Este bloque se implementa en subetapas por complejidad tecnica.

| Subetapa | Entregable | Prioridad |
|---|---|---|
| 4a | Migracion Prisma: modelos `RecoveryCampaign`, `RecoveryConversation`, `RecoveryAuditLog`, `RecoveryOffer` con particion por `gym_id` | **PP** |
| 4b | Instalacion y configuracion de BullMQ + Redis; job diario 09:00 CR; segmentacion A/B/C | **PP** |
| 4c | Worker de recuperacion: logica de segmentos, ventana de silencio, enfriamiento, override | **PP** |
| 4d | Conector OpenAI para recuperacion: system prompt, JSON estructurado, 2 reintentos, fallback, validacion Zod parcial | **PP** |
| 4e | Servicio financiero de ofertas: moneda por tenant, 2 decimales, redondeo comercial | **PP** |
| 4f | CRUD admin de ofertas de reenganche (7 tipos aprobados), soft delete con auditoria | **PP** |
| 4g | Endpoints admin: override por usuario, handoff, gestion de tickets internos | **PP** |
| 4h | Alerta push al admin al encolar primer mensaje de ciclo | **PP** |
| 4i | Checkbox de consentimiento en T&C mobile + bloqueo por derecho de oposicion | **PP** |

**Criterio de salida del bloque**: segmentador corre diario, clasifica usuarios, envia primer contacto push, registra auditoria completa y respeta todos los stops definidos.

---

### BLOQUE 5 — Personalizacion y tono de Tuco

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 11 | Personalizacion de tono de Tuco | Dinamico por conversacion; sin panel dedicado; soft delete del perfil conversacional | **P** |

**Criterio de salida**: tono se ajusta dinamicamente sin configuracion manual del usuario.

---

### BLOQUE 6 — Contenido y recursos del gimnasio

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 12 | Guia de ejercicios (biblioteca de video) | Upload por trainer, video max 15s, moderacion automatica, vinculo a ejercicio | **PC** |

**Bloqueante**: seleccionar proveedor de moderacion (AWS Rekognition / Google Video Intelligence / OpenAI Vision) y politica de almacenamiento. Fecha limite de decision: 14 de abril.

---

### BLOQUE 7 — Tokenizacion y observabilidad IA

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 13 | Documentacion y limite de tokens LLM | Instrumentacion real de consumo; degradacion de modelo; vistas por gimnasio/usuario/modulo; retencion 90 dias | **P** |

---

### BLOQUE 8 — Onboarding de nuevos gimnasios

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 14 | Migracion de nuevo gimnasio por CSV | Importacion de usuarios activos; activacion masiva; validacion manual de datos | **PP** |

**Pendiente**: plantilla CSV oficial, reglas de validacion y politica de duplicados.

---

### BLOQUE 9 — Integraciones externas

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 15 | Apple Health / Google Fit | Solo lectura; 13 metricas canonicas; sincronizacion diaria; dato manual tiene prioridad | **PC — evaluacion iniciada en dia 2** |
| 16 | Integracion Hacienda Costa Rica | Reportes fiscales sobre movimientos; formato pendiente | **PC** |

**Bloqueante item 15**: validacion con balanza real. Fecha limite: 14 de abril.
**Bloqueante item 16**: formato fiscal exacto. Fecha limite: 14 de abril.

---

### Resumen de estado por necesidad

| Necesidad | Bloqueante pendiente | Prioridad |
|---|---|---|
| Integridad de pago al borrar usuario | Ninguno | P |
| Personalizacion tono Tuco | Ninguno | P |
| Guardar credenciales | Ninguno | P |
| Cronometro en rutinas | Ninguno | P |
| Observabilidad tokens LLM | Ninguno | P |
| Patologias en perfil | Ninguno | P |
| KPIs admin + drill-down | Contrato API final | P |
| Preferencia de ejercicios | Taxonomia de objetivos | P |
| Descriptor de necesidad / rutinas IA | UX de validacion trainer | P |
| Hacienda Costa Rica | Formato fiscal (corte 14 abr) | PC |
| Guia de ejercicios | Proveedor moderacion + storage (corte 14 abr) | PC |
| Apple Health / Google Fit | Validacion con balanza real (evaluacion desde dia 2, corte 14 abr) | PC |
| Acceso delegado / impersonation | Ninguno | PP |
| Seguimiento de dolencias | Lista categorias recuperables | PP |
| Sistema recuperacion de clientes | BullMQ/Redis en Render | PP |
| Migracion CSV gimnasios | Plantilla CSV + reglas duplicados | PP |

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 1 | Integridad de registros de pago al borrar usuario | Garantizar soft delete; test automatizado de no-cascada | **P** |
| 2 | Patologias en perfil de usuario | Modelo DB, lista aprobada, control de privacidad por usuario, inyeccion en Tuco | **P** |
| 3 | Guardar credenciales en dispositivo | Sesion persistente + Keychain/Keystore + biometrico | **P** |

**Criterio de salida del bloque**: test de borrado de usuario pasa sin afectar transacciones; patologias en perfil funcionan y se inyectan en chat.

---

### BLOQUE 2 — Experiencia de entrenamiento del usuario (core mobile)

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 4 | Cronometro en pantalla de rutinas | Frontend mobile; estados `EN_PROGRESO` / `REALIZADO_SIN_MARCA`; presets por tipo | **P** |
| 5 | Preferencia de ejercicios like/dislike | Modelo por objetivo; afecta IA y trainer; override de trainer | **P** |
| 6 | Descriptor de necesidad (rutinas IA + validacion trainer) | Estados de flujo, SLA 1h, autoaprobacion con disclaimer | **P** |
| 7 | Seguimiento de dolencias (popup 1-3-7 dias) | Modelo de episodio; logica de categoria recuperable vs cronica; alerta pasiva trainer | **PP** |

**Criterio de salida del bloque**: usuario puede completar una sesion de entrenamiento con cronometro, registrar preferencias y recibir rutina IA validada por trainer.

---

### BLOQUE 3 — Visibilidad operativa del administrador

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 8 | KPIs admin (5 prioritarios) con drill-down 7/30/90d y IA | Formulas cerradas; graficos de tendencia; explicacion IA accionable | **P** |
| 9 | Mejora de visualizacion de KPIs (tarjetas clickeables) | Drill-down por tarjeta sin cambiar modulo | **P** |
| 10 | Acceso delegado / impersonation de cuentas | Endpoint seguro; sin contrasenas; auditoria completa | **PP** |

**Criterio de salida del bloque**: admin puede ver los 5 KPIs prioritarios con tendencias y recibir recomendaciones IA por cada uno.

---

### BLOQUE 4 — Sistema de recuperacion de clientes (modulo `recovery`)

Este bloque se implementa en subetapas por complejidad tecnica.

| Subetapa | Entregable | Prioridad |
|---|---|---|
| 4a | Migracion Prisma: modelos `RecoveryCampaign`, `RecoveryConversation`, `RecoveryAuditLog`, `RecoveryOffer` con particion por `gym_id` | **PP** |
| 4b | Instalacion y configuracion de BullMQ + Redis; job diario 09:00 CR; segmentacion A/B/C | **PP** |
| 4c | Worker de recuperacion: logica de segmentos, ventana de silencio, enfriamiento, override | **PP** |
| 4d | Conector OpenAI para recuperacion: system prompt, JSON estructurado, 2 reintentos, fallback, validacion Zod parcial | **PP** |
| 4e | Servicio financiero de ofertas: moneda por tenant, 2 decimales, redondeo comercial | **PP** |
| 4f | CRUD admin de ofertas de reenganche (7 tipos aprobados), soft delete con auditoria | **PP** |
| 4g | Endpoints admin: override por usuario, handoff, gestion de tickets internos | **PP** |
| 4h | Alerta push al admin al encolar primer mensaje de ciclo | **PP** |
| 4i | Checkbox de consentimiento en T&C mobile + bloqueo por derecho de oposicion | **PP** |

**Criterio de salida del bloque**: segmentador corre diario, clasifica usuarios, envia primer contacto push, registra auditoria completa y respeta todos los stops definidos.

---

### BLOQUE 5 — Personalizacion y tono de Tuco

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 11 | Personalizacion de tono de Tuco | Dinamico por conversacion; sin panel dedicado; soft delete del perfil conversacional | **PP** |

**Criterio de salida**: tono se ajusta dinamicamente sin configuracion manual del usuario.

---

### BLOQUE 6 — Contenido y recursos del gimnasio

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 12 | Guia de ejercicios (biblioteca de video) | Upload por trainer, video max 15s, moderacion automatica, vinculo a ejercicio | **PP** |

**Pendiente tecnico bloqueante**: seleccionar proveedor de moderacion (AWS Rekognition / Google Video Intelligence / OpenAI Vision) y politica de almacenamiento.

---

### BLOQUE 7 — Tokenizacion y observabilidad IA

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 13 | Documentacion y limite de tokens LLM | Instrumentacion real de consumo; degradacion de modelo; vistas por gimnasio/usuario/modulo; retencion 90 dias | **PP** |

---

### BLOQUE 8 — Onboarding de nuevos gimnasios

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 14 | Migracion de nuevo gimnasio por CSV | Importacion de usuarios activos; activacion masiva; validacion manual de datos | **PP** |

**Pendiente**: plantilla CSV oficial, reglas de validacion y politica de duplicados.

---

### BLOQUE 9 — Integraciones externas

| # | Necesidad | Alcance | Prioridad |
|---|---|---|---|
| 15 | Apple Health / Google Fit | Solo lectura; 13 metricas canonicas; sincronizacion diaria; dato manual tiene prioridad | **F** |
| 16 | Integracion Hacienda Costa Rica | Reportes fiscales sobre movimientos; formato pendiente | **F** |

**Pendiente bloqueo Bloque 15**: validacion con balanza real antes de comprometer alcance de metricas.

---

### Resumen de estado por necesidad

| Necesidad | Bloqueante pendiente | Prioridad |
|---|---|---|
| Integridad de pago al borrar usuario | Ninguno | P |
| Patologias en perfil | Ninguno | P |
| Guardar credenciales | Ninguno | P |
| Cronometro en rutinas | Ninguno | P |
| Preferencia de ejercicios | Taxonomia de objetivos | P |
| Descriptor de necesidad / rutinas IA | UX de validacion trainer | P |
| KPIs admin + drill-down | Contrato API final | P |
| Acceso delegado / impersonation | Ninguno | PP |
| Seguimiento de dolencias | Lista categorias recuperables | PP |
| Sistema recuperacion de clientes | BullMQ/Redis en Render | PP |
| Personalizacion tono Tuco | Reglas de auditoria de tono | PP |
| Guia de ejercicios | Proveedor moderacion + storage | PP |
| Tokens LLM | Limite numerico post-piloto | PP |
| Migracion CSV gimnasios | Plantilla CSV + reglas duplicados | PP |
| Apple Health / Google Fit | Validacion con balanza real | F |
| Hacienda Costa Rica | Formato fiscal | F |

