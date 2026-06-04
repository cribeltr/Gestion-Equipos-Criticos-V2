# Gestión de Equipos Críticos — app completa

Aplicación **HTML + JavaScript** (sin instalación, offline) que combina:

- **Nuestro diseño** (interfaz azul, barra lateral por estados, tarjetas,
  píldoras, tablas, ficha en modal, avisos).
- El **núcleo lógico de SIGEM** (`core/hhha-core.js`): calcula estados,
  eventos, ciclos correctivos, pendientes, mantenciones y SLA con sus reglas
  de negocio. Datos semilla: **893 equipos** (`core/seed-data.js`).

## Cómo usar

1. Abra **`index.html`** (doble clic) en cualquier navegador moderno.
2. Use el menú lateral. Los datos se guardan **comprimidos** en `localStorage`
   de ese navegador. Para trasladarlos: **Configuración → Descargar/Restaurar
   respaldo (JSON)**.

## Qué incluye

- **Resumen** con indicadores en vivo (por estado, pendientes y ciclos abiertos).
- **Inventario** y **vistas por estado**: Operativos, No operativos, En servicio
  técnico, **Baja** y Desconocido (búsqueda tolerante a ceros a la izquierda).
- **Ficha de equipo**: datos + eventos, pendientes, ciclos y notas; con
  **acciones rápidas** para registrar evento / mantención / pendiente / ciclo.
- **Registro de eventos** (solicitud, visita, OC, envío, recepción, reparación,
  **mantención preventiva** con aviso si el mes no está programado).
- **Pendientes**: alta y cambio de estado en línea (No iniciado → En proceso →
  Resuelto), con auditoría.
- **Ciclos correctivos**: abrir y cerrar (con justificación).
- **Cumplimiento / SLA**: tiempos de pendientes y ciclos, carga por ejecutor y
  por tipo de evento.
- **Auditoría**: trazabilidad de cambios.
- **Exportar a Excel** contextual (lo que se ve) y **respaldo JSON**.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Página principal. |
| `app-sigem.js` | Interfaz (nuestro diseño) sobre el núcleo. |
| `styles.css` | Estilos. |
| `xlsx.js` | Escritor de `.xlsx` propio (exportación). |
| `core/hhha-core.js` | Núcleo lógico (reglas de negocio). |
| `core/seed-data.js` | Datos semilla (893 equipos). |
| `core/lz-string.min.js` | Compresión para `localStorage`. |
| `core/xlsx.full.min.js` | Lector de Excel (SheetJS). |

## No incluido (módulos avanzados del SIGEM original)

Conciliación contra archivo maestro Excel, sincronización con Google Sheets y
grabación de sesión. La lógica del núcleo los soporta; quedan fuera de esta
entrega por su complejidad/dependencias externas.
