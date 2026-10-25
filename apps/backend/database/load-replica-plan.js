// Turns a pg_dump data script into SQL text and COPY payloads.
// node-pg cannot run psql meta-commands or COPY ... FROM stdin.

function planDump(sql) {
  const steps = [];
  const lines = sql.split('\n');
  const statement = [];

  function flushSql() {
    const text = statement.join('\n').trim();
    statement.length = 0;
    if (text) steps.push({ kind: 'sql', text });
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('\\')) continue;
    if (/^COPY\s.+ FROM stdin;\s*$/.test(line)) {
      flushSql();
      const payload = [];
      for (i += 1; i < lines.length; i += 1) {
        if (lines[i] === '\\.') break;
        payload.push(lines[i]);
      }
      steps.push({
        kind: 'copy',
        command: line.replace(/FROM stdin;\s*$/, 'FROM STDIN'),
        payload: `${payload.join('\n')}\n`,
      });
      continue;
    }
    statement.push(line);
  }
  flushSql();
  return steps;
}

module.exports = { planDump };
