"""Ensayo aislado del contrato de salud, sin despliegue ni servicios externos."""
import http.server
import json
import pathlib
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
GATE = ROOT / '.github/scripts/comprobar-salud-staging.py'
ROLLBACK = '9ceaac1a73daeb5ce4e8f911b4d678c91950176b'


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps(self.server.payload).encode()
        self.send_response(200)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class RollbackHealthRehearsal(unittest.TestCase):
    def test_contract(self):
        api = {'estado': 'ok', 'servicio': 'erp-backend', 'postgres': 'ok', 'version': ROLLBACK}
        intel = {'status': 'ok', 'service': 'intelligence-service', 'version': ROLLBACK}
        cases = [
            ('sha_incorrecto', 'api', {**api, 'version': 'otro'}, 1),
            ('rollback_api', 'api', api, 0),
            ('rollback_intelligence', 'intelligence', intel, 0),
            ('postgres_falla', 'api', {**api, 'postgres': 'error'}, 1),
        ]
        server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                for name, kind, payload, expected in cases:
                    with self.subTest(name=name):
                        server.payload = payload
                        with urllib.request.urlopen(f'http://127.0.0.1:{server.server_port}/', timeout=5) as response:
                            body = response.read()
                        path = pathlib.Path(tmp) / 'health.json'
                        path.write_bytes(body)
                        result = subprocess.run([sys.executable, str(GATE), kind, str(path), ROLLBACK], capture_output=True, text=True, timeout=5)
                        self.assertEqual((result.returncode, result.stdout, result.stderr), (expected, '', ''))
        finally:
            server.shutdown()
            thread.join()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
