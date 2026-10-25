import { idCorrelacion } from './correlacion';

const CAMPOS_SECRETOS = /^(authorization|cookie|set-cookie|password|token|access_token|refresh_token|jwt|secret|api[_-]?key)$/i;

export function redactarTexto(valor: string): string {
  return valor.replace(/([?&](?:token|password|access_token|jwt|secret)=)[^&\s]*/gi, '$1redacted');
}

export function registro(evento: Record<string, string | number | undefined>): void {
  const linea: Record<string, string | number> = { time: new Date().toISOString() };
  for (const [clave, valor] of Object.entries(evento)) {
    if (valor === undefined || CAMPOS_SECRETOS.test(clave)) continue;
    linea[clave] = typeof valor === 'string' ? redactarTexto(valor) : valor;
  }
  process.stdout.write(`${JSON.stringify(linea)}\n`);
}

export function registrarFallaFuente(datos: {
  fuente: string;
  causa: string;
  url: string;
  http?: number;
}): void {
  let host = '';
  try {
    host = new URL(datos.url).hostname;
  } catch {
    host = '';
  }
  registro({
    nivel: 'error',
    evento: 'fuente_externa',
    correlation_id: idCorrelacion(),
    fuente: datos.fuente,
    causa: datos.causa,
    host,
    http: datos.http,
  });
}
