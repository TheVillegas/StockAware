<?php
/**
 * Traduce las vistas de MySQL a PostgreSQL.
 *
 * Las definiciones que devuelve information_schema son mecanicas: backticks,
 * nombre del esquema pegado a cada tabla, y un punado de funciones que en
 * PostgreSQL se llaman distinto. Se traducen esas y se intenta crear cada
 * vista; las que dependen de otra se reintentan en pasadas sucesivas hasta
 * que no haya progreso. Lo que quede sin crear se informa al final, para
 * arreglarlo a mano y no fingir que salio bien.
 */
$c = mysqli_connect("srv25.cpanelhost.cl","cre95340_admin","Vaips*2026","cre95340_erp");
mysqli_set_charset($c,"utf8mb4");
/* Columnas ENUM: se castean a texto en las comparaciones. */
$COLS_ENUM = [];
$re = mysqli_query($c, "SELECT DISTINCT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND data_type='enum'");
while ($x = mysqli_fetch_assoc($re)) $COLS_ENUM[] = $x['column_name'];

/* Columnas enteras que el ERP cruza contra varchar. */
$COLS_INT_VS_TEXTO = ['codigo'];

$excl = array_flip(array_filter(array_map('trim', explode("\n", file_get_contents("/tmp/e2.txt")))));

/**
 * MySQL compara un ENUM contra cualquier literal sin quejarse: si el valor no
 * esta en la lista, simplemente no calza. PostgreSQL lanza error. Casteando a
 * texto se conserva la semantica original, incluidas las comparaciones que en
 * el ERP nunca calzan (v_personal busca tipo='SUCURSAL', que no existe en el
 * enum, asi que gl_sucursal siempre viene vacio).
 */
function casteaEnums(string $d, array $enums): string {
  foreach ($enums as $col) {
    $c = preg_quote($col, '/');
    $d = preg_replace(
      '/((?:"[^"]+"\.)?"' . $c . '")\s*(=|<>|!=|\bin\b)\s*\(?\s*\'/i',
      '($1)::text $2 \'', $d);
  }
  return $d;
}

/** MySQL convierte el texto a numero al comparar; aca se compara como texto. */
function casteaEnteros(string $d, array $intVarchar): string {
  foreach ($intVarchar as $col) {
    $c = preg_quote($col, '/');
    $d = preg_replace('/((?:"[^"]+"\.)?"' . $c . '")\s*=\s*((?:"[^"]+"\.)?"[^"]+")/i',
                      '($1)::text = ($2)::text', $d);
  }
  return $d;
}

/**
 * El ERP cruza enteros contra varchar en varios ON; MySQL convierte en
 * silencio y PostgreSQL se niega. Se comparan ambos lados como texto.
 * Para enteros normales el resultado es identico; la unica diferencia
 * aparecería con ceros a la izquierda, y por eso se comparan los conteos
 * de cada vista contra MySQL despues de crearlas.
 */
function casteaJoins(string $d): string {
  return preg_replace_callback('/\bon\s*\((.*?)\)(?=\s*(?:left|right|inner|cross|join|where|group|order|$))/is',
    function ($m) {
      $c = preg_replace('/("[^"]+"\."[^"]+")\s*=\s*("[^"]+"\."[^"]+")/', '($1)::text = ($2)::text', $m[1]);
      return 'on(' . $c . ')';
    }, $d);
}
/** Extrae el argumento de fn( ... ) respetando parentesis anidados. */
function reemplazaFuncion(string $d, string $fn, callable $arma): string {
  $out = ''; $i = 0; $n = strlen($d);
  while (($p = stripos($d, $fn . '(', $i)) !== false) {
    $out .= substr($d, $i, $p - $i);
    $j = $p + strlen($fn) + 1; $prof = 1; $arg = '';
    while ($j < $n) {
      $ch = $d[$j];
      if ($ch === '(') $prof++;
      elseif ($ch === ')') { $prof--; if ($prof === 0) break; }
      $arg .= $ch; $j++;
    }
    $out .= $arma($arg);
    $i = $j + 1;
  }
  return $out . substr($d, $i);
}

/** Cualquier igualdad entre dos columnas calificadas se compara como texto. */
function casteaIgualdades(string $d): string {
  return preg_replace('/("[^"]+"\."[^"]+")\s*=\s*("[^"]+"\."[^"]+")/', '($1)::text = ($2)::text', $d);
}

function traduce(string $d): string {
  // Solo el nombre de la base. Un patron generico se comeria tambien los
  // alias de tabla (`p`.`codigo` -> `codigo`) y todo quedaria ambiguo.
  $d = str_replace('`cre95340_erp`.', '', $d);
  $d = str_replace('`', '"', $d);                         // identificadores
  $r = [
    '/\bifnull\s*\(/i'      => 'coalesce(',
    '/\bcurdate\s*\(\s*\)/i'=> 'current_date',
    '/\bnow\s*\(\s*\)/i'    => 'now()',
    '/\bcurrent_timestamp\s*\(\s*\)/i' => 'current_timestamp',
    '/\bunix_timestamp\s*\(/i' => 'extract(epoch from ',
    '/\brand\s*\(\s*\)/i'   => 'random()',
  ];
  foreach ($r as $de => $a) $d = preg_replace($de, $a, $d);
  // datediff(a,b) -> (a::date - b::date)
  $d = preg_replace('/\bdatediff\s*\(([^,]+),([^)]+)\)/i', '(($1)::date - ($2)::date)', $d);
  // if(cond, a, b) -> CASE WHEN cond THEN a ELSE b END
  for ($i = 0; $i < 6; $i++) {
    $d = preg_replace_callback('/\bif\s*\(((?:[^()]|\([^()]*\))*)\)/i', function ($m) {
      $p = []; $prof = 0; $act = '';
      foreach (str_split($m[1]) as $ch) {
        if ($ch === '(') $prof++;
        if ($ch === ')') $prof--;
        if ($ch === ',' && $prof === 0) { $p[] = $act; $act = ''; continue; }
        $act .= $ch;
      }
      $p[] = $act;
      return count($p) === 3 ? "(CASE WHEN {$p[0]} THEN {$p[1]} ELSE {$p[2]} END)" : $m[0];
    }, $d);
  }
  // MySQL admite JOIN sin ON (producto cartesiano); PostgreSQL exige la clausula.
  $d = preg_replace('/\bjoin\s+("(?:[^"]+)"\s+"(?:[^"]+)")\s*\)/i', 'cross join $1)', $d);
  // interval `col` month  ->  ((col)::text || ' month')::interval
  $d = preg_replace('/\binterval\s+((?:"[^"]+"\.)?"[^"]+")\s+(day|month|year|hour|minute)\b/i',
                    "(($1)::text || ' $2')::interval", $d);
  // to_days(x) -> dias desde una epoca fija; sirve igual para restar fechas
  $d = reemplazaFuncion($d, 'to_days', fn($a) => "(($a)::date - date '0001-01-01')");
  $d = preg_replace('/\bweekday\s*\(([^()]*)\)/i', "(extract(isodow from (\$1)::date) - 1)", $d);
  // convert(x using utf8) -> x
  $d = preg_replace('/\bconvert\s*\(\s*(.+?)\s+using\s+[a-z0-9_]+\s*\)/i', '$1', $d);
  $d = casteaEnums($d, $GLOBALS['COLS_ENUM']);
  $d = casteaEnteros($d, $GLOBALS['COLS_INT_VS_TEXTO']);
  $d = casteaIgualdades($d);
  return $d;
}

$r = mysqli_query($c,"SELECT table_name, view_definition FROM information_schema.views WHERE table_schema=DATABASE() ORDER BY table_name");
$pendientes = [];
while ($x = mysqli_fetch_assoc($r)) {
  if (isset($excl[$x['table_name']])) continue;
  $pendientes[$x['table_name']] = traduce($x['view_definition']);
}

/**
 * Orden topologico: una vista que menciona a otra tiene que crearse despues.
 * Sin esto el archivo solo sirve si se corre varias veces, y el arranque
 * automatico de PostgreSQL lo ejecuta una sola vez.
 */
$orden = [];
$puestas = [];
$restantes = $pendientes;
for ($vuelta = 0; $vuelta < 40 && $restantes; $vuelta++) {
  $progreso = false;
  foreach ($restantes as $n => $d) {
    $listo = true;
    foreach ($pendientes as $otra => $_) {
      if ($otra === $n || isset($puestas[$otra])) continue;
      if (preg_match('/"' . preg_quote($otra, '/') . '"/', $d)) { $listo = false; break; }
    }
    if ($listo) {
      $orden[$n] = $d; $puestas[$n] = true; unset($restantes[$n]); $progreso = true;
    }
  }
  if (!$progreso) break;   // ciclo o dependencia externa: se emiten al final
}
foreach ($restantes as $n => $d) $orden[$n] = $d;

echo "-- Vistas de la replica, traducidas desde MySQL\n";
echo "-- " . count($orden) . " vistas, en orden de dependencia\n";
if ($restantes) {
  echo "-- Sin orden resoluble (" . count($restantes) . "): " . implode(', ', array_keys($restantes)) . "\n";
}
echo "\n";
/*
 * Cada vista va en su propio bloque con manejo de excepcion. PostgreSQL corre
 * los scripts de arranque con ON_ERROR_STOP activo: sin esto, la primera vista
 * que no traduzca aborta el archivo y se pierden todas las siguientes.
 * Las que fallan quedan como WARNING en el log del contenedor, visibles.
 */
foreach ($orden as $n => $d) {
  echo "DO \$bloque\$ BEGIN\n";
  echo "  EXECUTE \$vista\$CREATE OR REPLACE VIEW \"$n\" AS $d\$vista\$;\n";
  echo "EXCEPTION WHEN others THEN\n";
  echo "  RAISE WARNING 'No se pudo crear la vista $n: %', SQLERRM;\n";
  echo "END \$bloque\$;\n\n";
}
