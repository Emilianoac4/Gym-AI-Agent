# Tuco - Funcionalidades por Rol

**Version**: 1.1  
**Ultima actualizacion**: Abril 9, 2026  
**Objetivo**: traducir la vision comercial en modulos de producto priorizados para mobile, backend y analitica.

---

## 1. Roles actuales del producto

Hoy el sistema ya trabaja con tres roles base:

- **member**: usuario final del gimnasio.
- **trainer**: rol operativo para atencion en piso, seguimiento y soporte al usuario.
- **admin**: dueño o administrador principal del gimnasio.

La separacion actual ya permite operar el piloto, pero el rol **trainer** requiere una segunda capa de seguridad para acciones sensibles.

### Necesidad documentada: permisos individuales para trainers

Aunque hoy existen capacidades operativas globales para el rol trainer, queda documentada como necesidad prioritaria la implementacion de **permisos individuales por entrenador** para acciones sensibles de negocio.

**Acciones que deben pasar a permiso delegable por usuario**:
- Alta de nuevos usuarios.
- Renovacion de membresias.
- Registro del movimiento economico asociado a la renovacion cuando aplique.

**Regla objetivo**:
- El **admin** del gimnasio debe poder otorgar o revocar estos permisos trainer por trainer, de forma individual.
- La decision debe persistirse en backend, no solo en frontend.
- Todo otorgamiento o revocacion debe quedar auditado.

**Motivo**:
- No todos los entrenadores necesariamente deben tener el mismo nivel de autoridad operativa.
- El gimnasio necesita ajustar esa capacidad segun confianza, turno, antiguedad o responsabilidad interna.

---

## 2. Propuesta de valor por rol

### Miembro del gimnasio

El miembro necesita una app que le quite friccion al entrenamiento y le entregue progreso visible.

**Resultados que espera**:
- Saber que rutina hacer hoy.
- Entender como usar maquinas o ejecutar ejercicios.
- Sentir acompanamiento si tiene dolor, lesion o dudas de dieta.
- Ver evidencia de progreso corporal y de fuerza.
- Pedir ayuda humana cuando la IA no alcance.

### Dueno del gimnasio

El dueño necesita informacion operativa y comercial, no solo una app bonita.

**Resultados que espera**:
- Entender asistencia, uso de maquinaria y comportamiento del gimnasio.
- Detectar clientes en riesgo de abandono.
- Medir productividad y puntualidad del equipo.
- Automatizar notificaciones y retencion.
- Convertir el gimnasio en una propuesta tecnologica diferencial.

---

## 3. Modulos para miembros

### M1. Medicion corporal inteligente y automatizada

**Descripcion**:
- Registro de peso, grasa, masa muscular y perimetros.
- Carga manual obligatoria desde el MVP.
- Integracion automatica con biometria o dispositivos como fase posterior.

**Valor**:
- Alimenta rutinas, nutricion y seguimiento de progreso.

**Backend requerido**:
- measurements
- historial por usuario
- opcion de fuente de dato: manual / biometrico

**Prioridad**: Alta MVP

### M2. Creacion de rutinas por objetivo

**Descripcion**:
- Rutina segun objetivo, disponibilidad, nivel y lesiones.
- Ajuste basado en progreso de cargas y adherencia.

**Valor**:
- Es una de las razones principales para abrir la app con frecuencia.

**Backend requerido**:
- perfil deportivo
- historial de progreso
- servicio IA con guardrails fitness

**Prioridad**: Alta MVP

### M3. Indicaciones visuales sobre maquinas y ejercicios

**Descripcion**:
- Ficha visual del ejercicio.
- Explicacion paso a paso.
- Riesgos comunes y tecnica correcta.

**Valor**:
- Reduce dudas en piso y mejora experiencia del miembro nuevo.

**Backend requerido**:
- catalogo de ejercicios
- relacion rutina -> ejercicios
- repositorio de medios o enlaces

**Prioridad**: Media

### M4. Acompanamiento en lesiones y dietas

**Descripcion**:
- Chat IA restringido a salud fitness y entrenamiento.
- Adaptaciones de rutina por dolor o lesion.
- Recomendaciones alimentarias no medicas.

**Valor**:
- Hace que la IA parezca util de verdad, no solo decorativa.

**Riesgos**:
- Debe incluir disclaimer y bloqueo de diagnostico medico.

**Prioridad**: Alta MVP controlado

### M5. Historial de progreso corporal y cargas

**Descripcion**:
- Evolucion de medidas corporales.
- Evolucion de pesos usados por ejercicio.
- Hitos y rachas.

**Valor**:
- Refuerza permanencia y motivacion.

**Backend requerido**:
- measurements
- progress logs por ejercicio
- graficas resumidas para mobile

**Prioridad**: Alta MVP parcial

### M6. Integracion con base de datos biometrica del gimnasio

**Descripcion**:
- Vincular accesos, pesajes o mediciones desde sistemas existentes.

**Valor**:
- Aumenta automatizacion y percepcion de gimnasio tecnologico.

**Dependencias**:
- conocer proveedor biometrico
- webhooks o acceso a API/CSV

**Prioridad**: Baja hasta tener proveedor definido

### M7. Boton de asistencia al coach y calificacion

**Descripcion**:
- Boton rapido para pedir ayuda humana.
- Registro del motivo.
- Calificacion posterior de la ayuda recibida.

**Valor**:
- Conecta IA con atencion humana y genera metricas de servicio.

**Backend requerido**:
- tickets o assistance_requests
- ratings al coach

**Prioridad**: Media-Alta

---

## 4. Modulos para dueno del gimnasio

### A1. Revision de picos de actividad

**Descripcion**:
- Heatmap por dia y hora.
- Usuarios presentes por franja.

**Valor**:
- Permite ajustar personal, clases y marketing.

**Dependencias**:
- datos de ingreso/salida confiables

**Prioridad**: Media

### A2. Revision de maquinaria mas atractiva

**Descripcion**:
- Ranking de maquinas o zonas mas usadas.
- Cruce por horario y segmento de usuario.

**Valor**:
- Mejora layout, mantenimiento e inversion.

**Dependencias**:
- sensorizacion o check-in por ejercicio/maquina

**Prioridad**: Media-Baja

### A3. Reportes de usuarios en riesgo de abandono

**Descripcion**:
- Detectar miembros con baja frecuencia antes del vencimiento.
- Sugerir campanas de retencion.

**Valor**:
- Impacto directo en ingresos.

**Backend requerido**:
- membresias
- asistencia
- reglas de riesgo

**Prioridad**: Alta

### A4. Notificaciones de reactivacion y recordatorio

**Descripcion**:
- Push notifications tipo Duolingo.
- Campanas por inactividad, rutina pendiente o meta semanal.

**Valor**:
- Empuja retorno a la app y al gimnasio.

**Backend requerido**:
- jobs programados
- plantillas de mensajes
- tokens push

**Prioridad**: Alta despues del MVP base

### A5. Informe de horas de llegada y salida de colaboradores

**Descripcion**:
- Reporte basado en biometria o marcacion.

**Valor**:
- Optimiza planilla y control operacional.

**Dependencias**:
- integracion con sistema biometrico laboral

**Prioridad**: Media-Baja

### A6. Informe de satisfaccion por resolucion del coach

**Descripcion**:
- Score promedio por coach.
- Tiempos de respuesta.
- Tipos de solicitud frecuentes.

**Valor**:
- Permite medir calidad real del servicio humano.

**Backend requerido**:
- asistencia coach
- rating posterior
- dashboard admin

**Prioridad**: Media-Alta

---

## 5. Priorizacion recomendada

### Fase MVP comercial

- Login y roles.
- Perfil deportivo del miembro.
- Mediciones manuales.
- Rutina IA por objetivo.
- Chat IA restringido a fitness.
- Historial de progreso corporal.
- Dashboard home distinto para member y admin.
- Reporte simple de usuarios activos vs inactivos.

### Fase Operativa

- Boton de asistencia al coach.
- Calificacion al coach.
- Notificaciones push de reactivacion.
- Reporte de riesgo de abandono.
- Indicaciones visuales por ejercicio.

### Fase Integraciones

- Biometria de usuarios.
- Biometria de colaboradores.
- Analisis de maquinaria / zonas.
- Sensores o integraciones externas.

---

## 6. Como se integran dentro de la app

### Navegacion miembro

- **Home**: resumen del dia, progreso, acceso rapido a rutina y coach.
- **Rutina**: plan activo, ejercicios y futuras indicaciones visuales.
- **Progreso**: mediciones corporales, cargas e hitos.
- **Coach**: IA fitness + boton de ayuda humana.
- **Perfil**: objetivo, disponibilidad, nivel, lesiones y dieta.

### Navegacion admin

- **Home Admin**: KPI de asistencia, retencion y satisfaccion.
- **Miembros**: lista y seguimiento de usuarios.
- **Actividad**: picos de asistencia y uso operativo.
- **Campanas**: notificaciones y recuperacion de clientes.
- **Equipo**: desempeno de coaches y colaboradores.

---

## 7. Implicaciones tecnicas

Para soportar esta vision, las siguientes entidades faltan o deben crecer:

- **memberships** para vigencia y retencion.
- **attendance_logs** para entradas y salidas.
- **progress_logs** para cargas por ejercicio.
- **exercise_catalog** para explicaciones visuales.
- **coach_assistance_requests** para soporte humano.
- **coach_ratings** para satisfaccion.
- **notifications** para campanas y recordatorios.

---

## 8. Recomendacion de producto

La mejor secuencia no es construir todo al mismo tiempo. Conviene validar primero que el miembro vuelva a la app por tres motivos:

- entiende su rutina,
- registra progreso,
- siente acompanamiento.

Si eso funciona, entonces el panel admin empieza a capturar valor economico real con retencion, asistencia y calidad operativa.

---

## 9. Siguiente sprint recomendado

1. Consolidar el dashboard visual por rol en mobile.
2. Completar historial de progreso con cargas, no solo mediciones.
3. Restringir el chat IA a fitness/salud deportiva con guardrails backend.
4. Crear entidad de asistencia al coach y rating.
5. Disenar modelo de asistencia/membresia para analitica admin.