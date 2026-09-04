import * as XLSX from 'xlsx';
import { Task } from '../types';
import { getTaskEndDay } from './dependencyHelper';

/**
 * Genera un archivo Excel (.xlsx) limpio, visual y fácil de entender,
 * semejante a la cuadrícula del diagrama de Gantt de la pantalla.
 */
export function exportGanttToExcel(
  projectName: string,
  tasks: Task[],
  totalDays: number
) {
  // 1. Título principal y metadatos concisos
  const cleanTitle = (projectName.trim() || 'Cronograma de Actividades').toUpperCase();
  const todayFormatted = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const titleRow = [cleanTitle];
  const subtitleRow = [
    `Plazo total: ${totalDays} días   |   Total actividades: ${tasks.length}   |   Fecha: ${todayFormatted}`,
  ];
  const blankRow: string[] = [];

  // 2. Encabezados de tabla simples y claros
  const dayHeaders = Array.from({ length: totalDays }, (_, i) => `Día ${i + 1}`);
  const headers = [
    'N°',
    'Actividad',
    ...dayHeaders,
    'Comentarios',
  ];

  // 3. Filas de actividades con representación gráfica directa
  const dataRows = tasks.map((task, idx) => {
    const endDay = getTaskEndDay(task);

    // Celdas del cronograma por cada día
    const timelineCells = Array.from({ length: totalDays }, (_, i) => {
      const day = i + 1;
      if (task.isMilestone) {
        return day === task.startDay ? '◆' : '';
      }
      return day >= task.startDay && day <= endDay ? '■' : '';
    });

    return [
      idx + 1,
      task.name,
      ...timelineCells,
      task.notes || '',
    ];
  });

  // 4. Fila final de leyenda explicativa
  const legendRow = [
    '',
    'Leyenda:  ■ Actividad en curso   |   ◆ Hito',
  ];

  // 5. Construcción de la hoja de cálculo
  const sheetData = [
    titleRow,
    subtitleRow,
    blankRow,
    headers,
    ...dataRows,
    blankRow,
    legendRow,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // 6. Configuración de anchos de columna:
  // N° y Actividad + columnas de días + Comentarios
  const infoColWidths = [
    { wch: 5 },  // N°
    { wch: 42 }, // Actividad
  ];

  // Ancho estrecho para las columnas de días para que simule una cuadrícula visual de Gantt
  const timelineColWidths = Array.from({ length: totalDays }, () => ({ wch: 6 }));
  const commentsColWidth = [{ wch: 40 }]; // Comentarios (notas adicionales)
  worksheet['!cols'] = [...infoColWidths, ...timelineColWidths, ...commentsColWidth];

  // 7. Combinar celdas del título para una presentación profesional
  const totalColumns = headers.length;
  worksheet['!merges'] = [
    // Título principal
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(6, totalColumns - 1) } },
    // Subtítulo
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.min(6, totalColumns - 1) } },
    // Leyenda
    { s: { r: sheetData.length - 1, c: 1 }, e: { r: sheetData.length - 1, c: Math.min(totalColumns - 1, 4) } },
  ];

  // 8. Crear el libro de trabajo y descargar
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cronograma');

  const sanitizedName = projectName
    .trim()
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_\- ]/g, '')
    .replace(/\s+/g, '_');

  const filename = `${sanitizedName || 'Cronograma'}_Gantt.xlsx`;
  XLSX.writeFile(workbook, filename);
}
