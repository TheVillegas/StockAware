/**
 * Corrida de la metrica de calidad de datos (#49): npm run metrica:precios
 *
 * Para cada material del conjunto fijo lee las 5 fuentes con RecuperadorFuentes (mismo ritmo,
 * User-Agent y robots.txt que produccion), llama a /v1/precios/procesar de FastAPI y aplica
 * la validacion de NestJS. Solo lee: no usa la base ni guarda precios.
 * El resultado son conteos agregados; no se escribe contenido de las fuentes ni precios.
 */
import { writeFileSync, readFileSync } from 'fs';
import { ConfigService } from '@nestjs/config';

import { IntelligenceService } from '../../inteligencia/inteligencia.service';
import { validaProcesamiento } from '../../inteligencia/precios.dto';
import { CONFIG_FUENTES, FUENTES, Fuente } from '../fuentes/fuentes';
import { RecuperadorFuentes } from '../fuentes/recuperador';
import { ContadorFuente, ResultadoCrudo, cobertura, conTasa, contadorVacio, cuentaResultado } from './conteo';

const TIMEOUT_PROCESAR_MS = 5_000; // el mismo que IntelligenceService.procesar

interface MaterialConjunto {
  cod_material: string; nombre: string; rubro: string; motivo: string; url_rhona?: string; url_sodimac?: string;
}

/**
 * Igual que IntelligenceService.procesar, pero devuelve la respuesta cruda: el servicio solo
 * informa cuantos registros descarto, no por que regla. La respuesta se valida igual.
 */
async function procesaCrudo(base: string, m: MaterialConjunto, termino: string, fuentes: object[], pedidas: Fuente[]) {
  const cuerpo = { material: { cod_material: m.cod_material, nombre: m.nombre, termino_busqueda: termino }, referencia: new Date().toISOString(), fuentes };
  const res = await fetch(`${base}/v1/precios/procesar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(TIMEOUT_PROCESAR_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  validaProcesamiento(json, pedidas); // lanza ErrorFormato si la respuesta completa no cumple el contrato
  return json.resultados as ResultadoCrudo[];
}

async function main() {
  const fecha = new Date().toISOString().slice(0, 10);
  const [rutaConjunto = '../../docs/ep2/metrica/conjunto.json', rutaSalida = `../../docs/ep2/metrica/resultado-${fecha}.json`] = process.argv.slice(2);
  const base = (process.env.INTELLIGENCE_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '');
  const conjunto: { materiales: MaterialConjunto[] } = JSON.parse(readFileSync(rutaConjunto, 'utf8'));
  const inteligencia = new IntelligenceService({ get: () => base } as unknown as ConfigService);
  const recuperador = new RecuperadorFuentes();
  const contadores = Object.fromEntries(FUENTES.map((f) => [f, contadorVacio()])) as Record<Fuente, ContadorFuente>;
  const cotizables: Array<{ rubro: string; conPrecio: boolean }> = [];
  const fuera = { no_cotizables: 0, errores_preparar: 0, motivos: {} as Record<string, number> };
  const inicio = Date.now();

  for (const m of conjunto.materiales) {
    let prep;
    try {
      prep = await inteligencia.preparar(m.cod_material, m.nombre);
    } catch {
      // Sin termino no se puede consultar ninguna fuente: el material cuenta como sin precio.
      cotizables.push({ rubro: m.rubro, conPrecio: false });
      fuera.errores_preparar++;
      continue;
    }
    if (!prep.cotizable) {
      fuera.no_cotizables++;
      fuera.motivos[prep.motivo] = (fuera.motivos[prep.motivo] ?? 0) + 1;
      continue;
    }
    const urls: Partial<Record<Fuente, string>> = { rhona: m.url_rhona, sodimac: m.url_sodimac };
    const elegibles = FUENTES.filter((f) => !CONFIG_FUENTES[f].requiereUrl || urls[f]);
    FUENTES.filter((f) => !elegibles.includes(f)).forEach((f) => contadores[f].sin_url++);
    elegibles.forEach((f) => contadores[f].materiales_consultados++);

    const lecturas = await Promise.all(elegibles.map((f) => recuperador.lee(f, prep.termino_busqueda, urls[f])));
    const leidas = [];
    for (const l of lecturas) {
      if (l.estado === 'falla') contadores[l.fuente].errores_lectura[l.causa]++;
      else {
        if (l.parcial) contadores[l.fuente].lecturas_parciales++;
        leidas.push(l);
      }
    }
    let conPrecio = false;
    if (leidas.length) {
      const fuentes = leidas.map((l) => ({ fuente: l.fuente, tipo: l.tipo, contenido: l.contenido }));
      try {
        const resultados = await procesaCrudo(base, m, prep.termino_busqueda, fuentes, leidas.map((l) => l.fuente));
        for (const l of leidas) {
          conPrecio = cuentaResultado(contadores[l.fuente], l.fuente, resultados.find((r) => r.fuente === l.fuente)) || conPrecio;
        }
      } catch {
        leidas.forEach((l) => contadores[l.fuente].errores_procesamiento++);
      }
    }
    cotizables.push({ rubro: m.rubro, conPrecio });
    console.log(`${m.cod_material}: ${conPrecio ? 'con precio' : 'sin precio'}`);
  }

  const resultado = {
    fecha,
    materiales_en_conjunto: conjunto.materiales.length,
    ...fuera,
    duracion_s: Math.round((Date.now() - inicio) / 1000),
    por_fuente: Object.fromEntries(FUENTES.map((f) => [f, conTasa(contadores[f])])),
    cobertura: cobertura(cotizables),
  };
  writeFileSync(rutaSalida, `${JSON.stringify(resultado, null, 2)}\n`);
  console.log(`Resultado escrito en ${rutaSalida}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
