# Real Nest–FastAPI HTTP integration

This deterministic check starts the actual FastAPI application and a minimal Nest
HTTP application using the production `IntelligenceService` and response validators.
It requires no database, credentials, Render deployment or commercial-source access.

## Run locally

From the repository root, with Node 22, Python 3.13 and uv 0.8.15:

```sh
npm ci --prefix apps/backend
uv sync --frozen --project apps/intelligence-service
INTELLIGENCE_PYTHON="$(uv run --frozen --project apps/intelligence-service python -c 'import sys; print(sys.executable)')" \
  npm --prefix apps/backend run test:http:ci
```

The runner defaults to `apps/intelligence-service/.venv/bin/python` when
`INTELLIGENCE_PYTHON` is unset. Set it explicitly for a virtual environment outside
the checkout. Missing dependencies or an unavailable interpreter fail the check;
the runner does not install packages or fall back to a fake upstream.

## What it proves

- Real HTTP requests pass through Nest to `/v1/precios/preparar` and
  `/v1/precios/procesar`, with normalization, parsing, deduplication and Nest's
  candidate validation asserted against fixed fixtures.
- Invalid content remains `invalid_content`; internal request validation maps to
  `502 intelligence_error`, while public normalization keeps `422 invalid_request`.
- Request correlation reaches FastAPI logs; a stopped FastAPI process maps to
  `502 intelligence_unreachable` rather than fabricated data.

Both servers bind random loopback ports. Startup is bounded to 15 seconds, requests
to 7 seconds, and the test to 45 seconds. Cleanup closes Nest and terminates FastAPI
on success, assertion failure and SIGINT/SIGTERM; a nonresponsive child is killed
after 3 seconds. No compiled output or test cache is written into the checkout.

## CI boundary

`ci-intelligence-quality` runs this check after the locked Python checks and installs
Nest dependencies from its existing npm lockfile. The existing critical gate requires
that job to succeed before staging can deploy. This is service integration evidence,
not a browser E2E, authenticated ERP/database test, source-availability test or proof
that the live staging deployment serves the new revision.
