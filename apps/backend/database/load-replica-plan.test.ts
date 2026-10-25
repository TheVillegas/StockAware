// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
const { planDump } = require('./load-replica-plan');

test('splits a pg_dump data script into SQL and COPY payloads', () => {
  const steps = planDump(`\\restrict token
SET statement_timeout = 0;
COPY public.t (id, name) FROM stdin;
1	uno
2	dos
\\.
SET client_encoding = 'UTF8';
`);

  expect(steps).toEqual([
    { kind: 'sql', text: 'SET statement_timeout = 0;' },
    {
      kind: 'copy',
      command: 'COPY public.t (id, name) FROM STDIN',
      payload: '1\tuno\n2\tdos\n',
    },
    { kind: 'sql', text: "SET client_encoding = 'UTF8';" },
  ]);
});
