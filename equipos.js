// Listado de Equipos Críticos — inventario base VACÍO.
// El inventario ya no viene precargado: los equipos se cargan al importar la
// Programación de Mantenciones Preventivas (.xlsm) desde «Importar programación MP»
// (se extraen del Gantt y se agregan/actualizan en el inventario).
// Para precargar un listado fijo, reemplace el contenido de window.EQUIPOS por el
// arreglo de equipos (claves: id, carpeta, inventario, equipo, servicio, unidad,
// ubicacion, procedencia, marca, modelo, serie, anio, vida_util, clasificacion).
window.EQUIPOS = [];
