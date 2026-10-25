// Walks a pg_dump data script one line at a time.
// node-pg cannot run psql meta-commands or COPY ... FROM stdin.
// The walker does not keep COPY rows, so a large dump stays small in memory.

function createDumpFeeder() {
  const statement = [];
  let copying = false;

  function flushSql() {
    const text = statement.join('\n').trim();
    statement.length = 0;
    return text ? [{ kind: 'sql', text }] : [];
  }

  return {
    push(line) {
      if (copying) {
        if (line === '\\.') {
          copying = false;
          return [{ kind: 'copy-end' }];
        }
        return [{ kind: 'copy-row', line }];
      }
      if (line.startsWith('\\')) return [];
      if (/^COPY\s.+ FROM stdin;\s*$/.test(line)) {
        copying = true;
        return flushSql().concat({
          kind: 'copy-start',
          command: line.replace(/FROM stdin;\s*$/, 'FROM STDIN'),
        });
      }
      statement.push(line);
      return [];
    },
    finish() {
      if (copying) throw new Error('dump ended inside COPY');
      return flushSql();
    },
  };
}

function planDump(sql) {
  const feeder = createDumpFeeder();
  const steps = [];
  let copy = null;
  for (const line of sql.split('\n')) {
    for (const action of feeder.push(line)) {
      if (action.kind === 'sql') steps.push(action);
      else if (action.kind === 'copy-start') copy = { kind: 'copy', command: action.command, rows: [] };
      else if (action.kind === 'copy-row') copy.rows.push(action.line);
      else if (action.kind === 'copy-end') {
        steps.push({ kind: 'copy', command: copy.command, payload: `${copy.rows.join('\n')}\n` });
        copy = null;
      }
    }
  }
  return steps.concat(feeder.finish());
}

module.exports = { createDumpFeeder, planDump };
