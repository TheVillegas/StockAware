"""Tests for .github/scripts/smoke-staging.py against a local fake API (BE-10)."""

import importlib.util
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location(
    "smoke_staging", RAIZ / ".github/scripts/smoke-staging.py"
)
smoke = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(smoke)

TOKEN = "token-ficticio-123"


class FakeApi(BaseHTTPRequestHandler):
    respuestas: dict = {}
    vistos: list = []

    def log_message(self, *args):  # silence
        pass

    def _responder(self, clave):
        FakeApi.vistos.append((clave, self.headers.get("Authorization")))
        status, cuerpo = FakeApi.respuestas.get(clave, (404, {"error": "x"}))
        datos = json.dumps(cuerpo).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(datos)))
        self.end_headers()
        self.wfile.write(datos)

    def do_GET(self):
        self._responder("GET " + self.path)

    def do_POST(self):
        largo = int(self.headers.get("Content-Length") or 0)
        cuerpo = json.loads(self.rfile.read(largo) or b"{}")
        FakeApi.vistos.append(("BODY", cuerpo))
        self._responder("POST " + self.path)


def sanas():
    return {
        "POST /api/auth/login": (201, {"access_token": TOKEN}),  # Nest default for POST
        "GET /api/bodega/stock?bodega=3": (200, [{"cod_material": "M-1"}]),
        "GET /api/precios/M-1": (200, {"cod_material": "M-1", "fuentes": []}),
        "GET /api/recomendaciones?bodega=3&modo=adaptativo": (
            200,
            {"modo": "adaptativo", "degradado": False, "items": []},
        ),
        "GET /api/mantenedores/usuarios": (403, {"message": "x"}),
    }


class SmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), FakeApi)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}/api"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        FakeApi.respuestas = sanas()
        FakeApi.vistos = []
        self.env = {
            "STAGING_API_BASE": self.base,
            "STAGING_SMOKE_USER": "smoke",
            "STAGING_SMOKE_PASSWORD": "clave-ficticia",
            "STAGING_SMOKE_BODEGA": "3",
            "STAGING_SMOKE_MATERIAL": "M-1",
            "STAGING_SMOKE_FORBIDDEN_PATH": "/mantenedores/usuarios",
        }

    def correr(self):
        salida = []
        codigo = smoke.main(self.env, salida.append)
        return codigo, "\n".join(salida)

    def test_todo_sano_pasa_y_usa_el_token(self):
        codigo, salida = self.correr()
        self.assertEqual(codigo, 0, salida)
        self.assertIn("Smoke de staging OK", salida)
        self.assertIn(("BODY", {"user": "smoke", "clave": "clave-ficticia"}), FakeApi.vistos)
        autenticadas = [a for c, a in FakeApi.vistos if c.startswith("GET")]
        self.assertEqual(autenticadas, [f"Bearer {TOKEN}"] * 4)
        self.assertNotIn(TOKEN, salida)
        self.assertNotIn("clave-ficticia", salida)

    def test_falta_configuracion(self):
        del self.env["STAGING_SMOKE_PASSWORD"]
        del self.env["STAGING_SMOKE_BODEGA"]
        codigo, salida = self.correr()
        self.assertEqual(codigo, 1)
        self.assertIn("STAGING_SMOKE_PASSWORD", salida)
        self.assertIn("STAGING_SMOKE_BODEGA", salida)
        self.assertEqual(FakeApi.vistos, [])

    def falla_en(self, clave, respuesta, paso):
        FakeApi.respuestas[clave] = respuesta
        codigo, salida = self.correr()
        self.assertEqual(codigo, 1)
        self.assertIn(f"Smoke falló en {paso}", salida)
        self.assertNotIn(TOKEN, salida)

    def test_login_rechazado(self):
        self.falla_en("POST /api/auth/login", (401, {"error": "x"}), "login")

    def test_login_sin_token(self):
        self.falla_en("POST /api/auth/login", (201, {}), "login")

    def test_stock_caido(self):
        self.falla_en("GET /api/bodega/stock?bodega=3", (500, {}), "stock")

    def test_stock_no_es_lista(self):
        self.falla_en("GET /api/bodega/stock?bodega=3", (200, {}), "stock")

    def test_precios_otro_material(self):
        self.falla_en("GET /api/precios/M-1", (200, {"cod_material": "M-2"}), "precios")

    def test_recomendaciones_degradadas(self):
        self.falla_en(
            "GET /api/recomendaciones?bodega=3&modo=adaptativo",
            (200, {"degradado": True, "items": []}),
            "recomendaciones",
        )

    def test_ruta_sin_permiso_accesible(self):
        self.falla_en("GET /api/mantenedores/usuarios", (200, {}), "permiso")


if __name__ == "__main__":
    unittest.main()
