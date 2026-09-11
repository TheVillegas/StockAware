<?php
/**
 * Extraccion anonimizada de cre95340_erp -> archivos COPY para PostgreSQL.
 *
 * SOLO LEE de MySQL. La base original nunca se modifica.
 *
 * El remapeo es consistente: un mismo valor original produce siempre el mismo
 * valor falso, en todas las tablas donde aparezca. Las llaves siguen siendo
 * llaves.
 *
 * No se tocan: montos, fechas, estados, tipos ni unidades.
 */

const CLAVE_SEMILLA = 'replica2026';   // clave de los 4 usuarios sembrados

$SALIDA = "/tmp/datos";
@mkdir($SALIDA, 0777, true);

$c = mysqli_connect("srv25.cpanelhost.cl","cre95340_admin","Vaips*2026","cre95340_erp");
mysqli_set_charset($c,"utf8mb4");

/* ---------------------------------------------------------------- mapeos --*/
$MAP = ['rut'=>[], 'cliente'=>[], 'personal'=>[], 'usuario'=>[], 'user'=>[]];

function digitoVerificador(int $n): string {
  $s = 0; $m = 2;
  foreach (array_reverse(str_split((string)$n)) as $d) { $s += $d * $m; $m = $m === 7 ? 2 : $m + 1; }
  $r = 11 - ($s % 11);
  return $r === 11 ? '0' : ($r === 10 ? 'K' : (string)$r);
}

/** RUT falso pero valido: mismo original -> mismo falso. */
function mapRut(string $orig): string {
  global $MAP;
  $orig = trim($orig);
  if ($orig === '' || $orig === '0') return $orig;
  if (!isset($MAP['rut'][$orig])) {
    $n = 10000000 + count($MAP['rut']) * 137;      // separados, sin colisiones
    $MAP['rut'][$orig] = $n . '-' . digitoVerificador($n);
  }
  return $MAP['rut'][$orig];
}

function mapId(string $tipo, $orig, int $desde = 1) {
  global $MAP;
  if (!isset($MAP[$tipo])) $MAP[$tipo] = [];
  $orig = (string)$orig;
  if ($orig === '' || $orig === '0') return $orig;
  if (!isset($MAP[$tipo][$orig])) $MAP[$tipo][$orig] = $desde + count($MAP[$tipo]);
  return $MAP[$tipo][$orig];
}

/* --------------------------------------------------- generadores de texto -*/
function seudonimo(string $prefijo, string $tipo, $semilla): string {
  return $prefijo . ' ' . str_pad((string)mapId($tipo, $semilla), 4, '0', STR_PAD_LEFT);
}
$COMUNAS  = ['Santiago','Providencia','Maipu','Concepcion','Valparaiso','Temuco','Antofagasta','La Serena'];
$CIUDADES = ['Santiago','Concepcion','Valparaiso','Temuco','Antofagasta','La Serena'];
function elige(array $l, $semilla): string { return $l[abs(crc32((string)$semilla)) % count($l)]; }
function fonoFalso($semilla): string { return '+569' . str_pad((string)(abs(crc32((string)$semilla)) % 100000000), 8, '0', STR_PAD_LEFT); }
function mailFalso($semilla): string { return 'contacto' . (abs(crc32((string)$semilla)) % 10000) . '@ejemplo.cl'; }
function direccionFalsa($semilla): string { return 'Calle ' . (abs(crc32((string)$semilla)) % 900 + 100) . ', Of. ' . (abs(crc32((string)$semilla)) % 90 + 10); }
function cuentaFalsa($semilla): string { return (string)(10000000 + abs(crc32((string)$semilla)) % 89999999); }
/* Contador, no hash: dos originales distintos nunca comparten valor falso,
   que es lo que exigen las columnas con indice unico (vehiculos.patente). */
/* Contador, no hash: dos originales distintos nunca comparten valor falso,
   que es lo que exigen las columnas con indice unico (vehiculos.patente).
   Si la columna es corta se recorta el prefijo, nunca el contador. */
function textoFalso($semilla, string $pre = 'Detalle', int $max = 0): string {
  $num = str_pad((string)mapId('texto', $semilla), 5, '0', STR_PAD_LEFT);
  if ($max <= 0) return $pre . ' ' . $num;
  if ($max <= strlen($num)) return substr($num, -$max);
  return substr($pre, 0, $max - strlen($num) - 1) . '-' . $num;
}

echo "Conectado. Construyendo mapeos...\n";

/* ------------------------------------------------------------- catalogo ---*/
$VACIAR = ['sot_at','sot_at_herramienta','sot_at_om','sot_at_personal','sot_at_vehiculo',
  'sot_entregable','sot_equipo','sot_informe','sot_presupuesto','sot_presupuesto_cargo',
  'sot_presupuesto_herramienta','sot_presupuesto_material','sot_presupuesto_personal',
  'sot_presupuesto_u_obra','sot_presupuesto_vehiculo','sot_trabajo','sot_trabajo_instalacion',
  'sot_trabajo_u_obra','registro','registro_error','base_digital','tab_lista_explode'];

/* Columnas con remapeo de llave: el mismo original da el mismo falso siempre. */
$LLAVES = [
  'data_clientes.codigo'=>'cliente','data_clientes_bco.cliente'=>'cliente',
  'data_clientes_cargos.codigo'=>'cliente','data_clientes_cheques.cliente'=>'cliente',
  'data_clientes_factura.codigo'=>'cliente','data_clientes_sucursal.cliente'=>'cliente',
  'centro_costo.cliente'=>'cliente','docs_emitidos.cliente'=>'cliente',
  'docs_emitidos_detalle.cliente'=>'cliente','docs_recibidos.cliente'=>'cliente',
  'docs_recibidos_detalle.cliente'=>'cliente','pagos.cliente'=>'cliente',
  'docs_pagos.cliente'=>'cliente','docs_pagos_fac.cliente'=>'cliente',
  'tab_cartola_bco.cliente'=>'cliente',
  'data_personal.codigo'=>'personal',
  'bodega.id_responsable'=>'usuario','mov_bodega.id_responsable'=>'usuario',
  'centro_costo.id_responsable'=>'usuario',
];

/* Tablas anonimizadas por completo: todo texto se reemplaza salvo lo preservado. */
$COMPLETAS = ['data_clientes_bco','data_clientes_cargos','data_clientes_cheques',
  'data_clientes_factura','data_clientes_sucursal','data_personal','empresa',
  'docs_recibidos','docs_recibidos_detalle','pagos','docs_pagos','docs_pagos_fac',
  'data_cheques','depositos','adm_bancos','tab_cartola_bco','rinde_gastos','cambia_pw'];

/* Tablas con columnas puntuales (lo que no esta listado no se toca). */
$PARCIALES = [
  'data_clientes' => ['codigo','rut','nombre','apellido','direcc','comuna','ciudad','fono',
                      'celular','email','contacto','bco_direcc','bco_comuna','bco_fono','codigo_cc'],
  'centro_costo'  => ['cliente','presupuesto','presupuesto_neto','id_responsable'],
  'docs_emitidos' => ['cliente','rut','usuario'],
  'docs_emitidos_detalle' => ['cliente'],
  'bodega'        => ['id_responsable'],
  'mov_bodega'    => ['id_responsable'],
  'herramientas'  => ['asigna','accion'],
  'vehiculos'     => ['patente','chasis','motor'],
];

/* Nunca se tocan, en ninguna tabla: sostienen el flujo del sistema. */
$INTOCABLES = ['estado','tipo','tipo_doc','tipo_reg','tipo_mov','tipo_vhe','tipo_pago','tipo_cli',
  'unidad','ccosto','ccosto_ap','numdoc','OC','HES','id','id_fac','id_bodega','id_pago','id_doc',
  'ref_id_doc','ref_num','ref_tipo','cod_material','producto','lote_pago','periodo','principal',
  /* Datos de flujo, no de identidad: clasifican y hacen avanzar el proceso.
     Se preservan por el mismo criterio con que quedan afuera los montos. */
  'categoria','subCategoria','indicador','OC_avance','IndExe','tipodoc','cod_tipo_doc','pw_estado'];

/** Elige el reemplazo segun el nombre y el tipo de la columna. */
function anonimizaValor(string $col, string $tipoSql, $v, $semilla) {
  if ($v === null || $v === '') return $v;
  $n = strtolower($col);
  // El tipo manda sobre el nombre: "comuna" puede ser un id, no un texto.
  if (preg_match('/^(int|bigint|smallint|tinyint|mediumint|decimal|double|float)/i', $tipoSql)) return 0;
  if (preg_match('/^(date|datetime|timestamp|time|year)/i', $tipoSql)) return $v;
  if (preg_match('/^(fecha|fec_|ult_|f_ini|f_fin)/', $n)) return $v;
  if (str_contains($n,'rut'))                      return mapRut((string)$v);
  if (str_contains($n,'mail'))                     return mailFalso($semilla.$col);
  if (str_contains($n,'fono') || str_contains($n,'celular')) return fonoFalso($semilla.$col);
  if (str_contains($n,'direcc'))                   return direccionFalsa($semilla.$col);
  if (str_contains($n,'comuna'))                   return elige($GLOBALS['COMUNAS'], $semilla.$col);
  if (str_contains($n,'ciudad'))                   return elige($GLOBALS['CIUDADES'], $semilla.$col);
  if (str_contains($n,'ctacte') || str_contains($n,'cuenta') || str_contains($n,'cheque')) return cuentaFalsa($semilla.$col);
  if (str_contains($n,'nombre') || str_contains($n,'apellido') || str_contains($n,'materno')
      || str_contains($n,'razon') || str_contains($n,'contacto') || str_contains($n,'asigna')) return seudonimo('Registro','texto',$semilla.$col);
  if (str_contains($n,'banco'))                    return 'Banco ' . (abs(crc32($semilla.$col)) % 20 + 1);
  if (preg_match('/^(int|bigint|smallint|decimal|double|float)/i', $tipoSql)) return 0;
  $max = preg_match('/^(varchar|char)\((\d+)\)/i', $tipoSql, $m) ? (int)$m[2] : 0;
  return textoFalso($semilla.$col, 'Detalle', $max);
}

/* ------------------------------------------------------------ ccosto -----*/
/* El codigo de centro de costo lleva el codigo del cliente como prefijo
   ("16-00-12-001" pertenece al cliente 16), asi que delataria al cliente ya
   anonimizado. Se reescribe el prefijo con el mismo mapeo, y el texto libre
   que llevan algunas filas ("18-10-21-176 PEPP") se cambia por un token: sin
   ese token cuatro centros distintos colapsarian en uno y ccosto es unico.
   OJO: ccosto_ap NO pasa por aca, es la categoria contable ("1.2.1"). */
function mapCcosto($v) {
  static $cache = [];
  if ($v === null) return $v;
  $v = trim((string)$v);
  if ($v === '' || $v === '0') return $v;
  if (isset($cache[$v])) return $cache[$v];

  if (preg_match('/^(\d+)((?:-\d+)*)\s*(.*)$/', $v, $m)) {
    $nuevo = mapId('cliente', $m[1]) . $m[2];
    if (trim($m[3]) !== '') $nuevo .= ' T' . str_pad((string)mapId('cctxt', $v), 4, '0', STR_PAD_LEFT);
  } else {
    $nuevo = 'CC-' . str_pad((string)mapId('cctxt', $v), 4, '0', STR_PAD_LEFT);
  }
  return $cache[$v] = $nuevo;
}
/* ------------------------------------------------------------- usuarios ---*/
/* Sobreviven cuatro: admin y tres genericos. Toda referencia se reapunta. */
$USUARIOS_FINALES = [
  1 => ['user'=>'admin',    'nombre'=>'Administrador',      'perfil'=>1],
  2 => ['user'=>'gestion',  'nombre'=>'Control de Gestion', 'perfil'=>29],
  3 => ['user'=>'operador', 'nombre'=>'Operador',           'perfil'=>25],
  4 => ['user'=>'consulta', 'nombre'=>'Consulta',           'perfil'=>35],
];
function mapUsuario($id) {
  $id = (string)$id;
  if ($id === '' || $id === '0') return $id;
  if ($id === '1') return 1;
  return 2 + (abs(crc32($id)) % 3);
}
function mapUser($u) {
  global $USUARIOS_FINALES;
  $u = trim((string)$u);
  if ($u === '') return $u;
  if (strtolower($u) === 'admin') return 'admin';
  return $USUARIOS_FINALES[2 + (abs(crc32($u)) % 3)]['user'];
}

/* ------------------------------------------------------------ extraccion --*/
function copyEscape($v, string $tipo = '', bool $nulo = true): string {
  if ($v === null) return '\N';
  $v = (string)$v;
  $esFecha = (bool)preg_match('/^(date|datetime|timestamp)/i', $tipo);
  // PostgreSQL rechaza 0000-00-00 y cualquier fecha con mes o dia en 00.
  if ($esFecha && preg_match('/^\d{4}-(00|\d{2})-(00|\d{2})/', $v, $m)
      && (str_starts_with($v, '0000') || $m[1] === '00' || $m[2] === '00')) {
    return $nulo ? '\N' : (str_starts_with(strtolower($tipo), 'date') && !str_contains(strtolower($tipo), 'time')
      ? '1900-01-01' : '1900-01-01 00:00:00');
  }
  if ($v === '' && preg_match('/^(int|bigint|smallint|tinyint|mediumint|decimal|double|float)/i', $tipo)) return $nulo ? '\N' : '0';
  // El valor falso nunca debe exceder el largo declarado de la columna.
  if (preg_match('/^(varchar|char)\((\d+)\)/i', $tipo, $m) && mb_strlen($v) > (int)$m[2]) $v = mb_substr($v, 0, (int)$m[2]);
  return str_replace(["\\", "\t", "\n", "\r"], ['\\', '\t', '\n', '\r'], $v);
}

$tablas = array_filter(array_map('trim', explode("\n", file_get_contents("/tmp/tablas.txt"))));
$informe = []; $totalFilas = 0;

foreach ($tablas as $t) {
  $cols = []; $tipos = []; $nulos = [];
  $r = mysqli_query($c, "SELECT column_name,column_type,is_nullable FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='$t' ORDER BY ordinal_position");
  while ($x = mysqli_fetch_assoc($r)) { $cols[] = $x['column_name']; $tipos[$x['column_name']] = $x['column_type']; $nulos[$x['column_name']] = ($x['is_nullable'] === 'YES'); }

  $fh = fopen("$SALIDA/$t.tsv", 'w');
  if (in_array($t, $VACIAR, true)) { fclose($fh); $informe[$t] = 'VACIADA'; continue; }

  /* que se anonimiza en esta tabla */
  $objetivo = [];
  if (in_array($t, $COMPLETAS, true)) {
    foreach ($cols as $col) {
      if (in_array($col, $INTOCABLES, true)) continue;
      if (str_starts_with($tipos[$col], 'enum')) continue;
      if (preg_match('/^(date|datetime|timestamp|time|year)/i', $tipos[$col])) continue;
      if (preg_match('/^(fecha|fec_|ult_)/i', $col)) continue;   // fechas guardadas como varchar
      if (preg_match('/^(int|bigint|smallint|decimal|double|float)/i', $tipos[$col])
          && !isset($LLAVES["$t.$col"])) continue;      // montos y contadores quedan
      $objetivo[] = $col;
    }
  } elseif (isset($PARCIALES[$t])) {
    $objetivo = $PARCIALES[$t];
  }

  /* usuarios: sobreviven exactamente cuatro, tomando una fila real de plantilla */
  if ($t === 'usuarios') {
    $r = mysqli_query($c, "SELECT * FROM usuarios WHERE usr_estado='ACTIVO' LIMIT 1");
    $plantilla = mysqli_fetch_assoc($r);
    foreach ($USUARIOS_FINALES as $uid => $u) {
      $out = [];
      foreach ($cols as $col) {
        $v = match ($col) {
          'usr_id'     => $uid,
          'usr_user'   => $u['user'],
          'usr_nombre' => $u['nombre'],
          'usr_perfil' => $u['perfil'],
          'usr_estado' => 'ACTIVO',
          'usr_rut'    => mapRut('9000000' . $uid . '-0'),
          'usr_mail'   => $u['user'] . '@ejemplo.cl',
          /* Mismo esquema que el ERP: HMAC-SHA256 con el PEPPER (que no existe
             en parametros, o sea clave vacia) y bcrypt sobre ese resultado.
             usr_clave va vacia, que es el estado posterior a la migracion. */
          'usr_passwd' => password_hash(hash_hmac('sha256', CLAVE_SEMILLA, ''), PASSWORD_BCRYPT),
          'usr_clave'  => '',
          default       => (in_array($col, $INTOCABLES, true) || str_starts_with($tipos[$col], 'enum'))
                            ? $plantilla[$col]
                            : anonimizaValor($col, $tipos[$col], $plantilla[$col], $uid),
        };
        $out[] = copyEscape($v, $tipos[$col], $nulos[$col]);
      }
      fwrite($fh, implode("\t", $out) . "\n");
    }
    fclose($fh);
    $informe[$t] = '4 filas | admin + 3 genericos, 137 originales descartados';
    $totalFilas += 4;
    echo str_pad($t, 32) . "       4 filas (admin + 3 genericos)\n";
    continue;
  }

  $n = 0;
  $q = mysqli_query($c, "SELECT * FROM `$t`", MYSQLI_USE_RESULT);
  while ($fila = mysqli_fetch_assoc($q)) {
    $semilla = $fila[$cols[0]] ?? $n;
    $out = [];
    foreach ($cols as $col) {
      $v = $fila[$col];
      if ($col === 'ccosto' || $col === 'codigo_cc') {
        $v = mapCcosto($v);                       // nunca ccosto_ap
      } elseif ($t === 'usuarios') {
        $v = match ($col) {
          'usr_id' => mapUsuario($v), 'usr_user' => mapUser($v),
          default  => in_array($col, $INTOCABLES, true) ? $v : anonimizaValor($col, $tipos[$col], $v, $semilla),
        };
      } elseif (in_array($col, $objetivo, true)) {
        if (isset($LLAVES["$t.$col"])) {
          $tipo = $LLAVES["$t.$col"];
          $v = $tipo === 'usuario' ? mapUsuario($v) : mapId($tipo, $v);
        } elseif (in_array($col, ['presupuesto','presupuesto_neto'], true)) {
          $v = 0;
        } elseif (in_array($col, ['usuario','user','usr_rinde','usr_reporte','user_ing','user_valida','user_confirma','pw_user'], true)) {
          $v = mapUser($v);
        } else {
          $v = anonimizaValor($col, $tipos[$col], $v, $semilla);
        }
      } elseif (in_array($col, ['usuario','user_ing','user_valida','user_confirma'], true) && isset($PARCIALES[$t]) && in_array($col, $PARCIALES[$t], true)) {
        $v = mapUser($v);
      }
      $out[] = copyEscape($v, $tipos[$col], $nulos[$col]);
    }
    fwrite($fh, implode("\t", $out) . "\n");
    $n++;
  }
  mysqli_free_result($q);
  fclose($fh);
  $informe[$t] = "$n filas" . ($objetivo ? ' | anonimiza: ' . implode(', ', $objetivo) : ' | sin cambios');
  $totalFilas += $n;
  echo str_pad($t, 32) . str_pad((string)$n, 8, ' ', STR_PAD_LEFT) . " filas\n";
}

file_put_contents("$SALIDA/_informe.txt", implode("\n", array_map(fn($k,$v)=>str_pad($k,32).$v, array_keys($informe), $informe)));
echo "\nTOTAL: $totalFilas filas | mapeos: cliente=".count($MAP['cliente'])." rut=".count($MAP['rut'])." personal=".count($MAP['personal'])."\n";
