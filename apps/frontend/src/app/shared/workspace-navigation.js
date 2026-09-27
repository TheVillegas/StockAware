const AREAS = [
  { key: 'operaciones', titulo: 'Operaciones de terreno', codigos: ['SOT'] },
  { key: 'bodega', titulo: 'Bodega y materiales', codigos: ['BODEGA'] },
  { key: 'compras', titulo: 'Compras', codigos: ['COMPRAS'] },
  { key: 'documentos', titulo: 'Documentos', codigos: ['DOCUMENTOS'] },
  {
    key: 'finanzas', titulo: 'Finanzas y reportes',
    codigos: ['ADM_PAGOS', 'CON_GASTOS', 'ING_GASTOS', 'INFORMES_GENERAL', 'INFORMES_GESTION'],
  },
  { key: 'administracion', titulo: 'Administración y maestros', codigos: ['ADMINISTRACION', 'MANTENEDOR'] },
];

function agruparAreas(grupos) {
  const menu = Array.isArray(grupos) ? grupos : [];
  const asignados = new Set();
  const areas = AREAS.flatMap(({ key, titulo, codigos }) => {
    const coincidencias = menu.filter((grupo) => codigos.includes(grupo.codigo));
    coincidencias.forEach((grupo) => asignados.add(grupo));
    return coincidencias.length ? [{ key, titulo, grupos: coincidencias }] : [];
  });
  const desconocidos = menu.filter((grupo) => !asignados.has(grupo));
  if (desconocidos.length) areas.push({ key: 'otros', titulo: 'Otros espacios', grupos: desconocidos });
  return areas;
}

function agruparAccesosInicio(grupos) {
  const menu = Array.isArray(grupos) ? grupos : [];
  const implementados = menu
    .map((grupo) => ({
      ...grupo,
      opciones: Array.isArray(grupo.opciones)
        ? grupo.opciones.filter((opcion) => opcion.implementada)
        : [],
    }))
    .filter((grupo) => grupo.opciones.length > 0);

  return agruparAreas(implementados).map((area) => ({
    ...area,
    opciones: area.grupos.flatMap((grupo) => grupo.opciones),
  }));
}

module.exports = { agruparAreas, agruparAccesosInicio };
