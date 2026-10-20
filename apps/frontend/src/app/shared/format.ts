export const clp = (n: unknown): string =>
  n == null || n === '' ? '' : '$' + Math.round(Number(n)).toLocaleString('es-CL');

export const fechaTabla = (iso: unknown): string => {
  const [y, m, d] = String(iso ?? '').slice(0, 10).split('-');
  return y && m && d ? `${d}-${m}-${y}` : '';
};

export const etiquetaEstado = (estado: string): string => {
  const texto = String(estado ?? '').toLowerCase();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
};

export const tonoEstado = (estado: string): string => {
  if (estado === 'PENDIENTE') return 'warn';
  if (estado === 'EMITIDO' || estado === 'ACEPTADO') return 'info';
  if (estado === 'CERRADO' || estado === 'PAGO' || estado === 'DISTRIBUIDO') return 'ok';
  if (estado === 'ELIMINADO' || estado === 'ANULADO' || estado === 'RECHAZADO') return 'crit';
  return 'info';
};

export const rangoLista = (pagina: number, cantidad: number, total: number, frase: string, limite = 50): string => {
  if (!cantidad) return `Mostrando 0 de ${total} ${frase}`;
  const desde = (pagina - 1) * limite + 1;
  return `Mostrando ${desde}-${desde + cantidad - 1} de ${total} ${frase}`;
};
