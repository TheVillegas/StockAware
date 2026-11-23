"""Tests for .github/scripts/sha-en-vivo-staging.py (BE-02)."""

import importlib.util
import io
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location(
    "sha_en_vivo", RAIZ / ".github/scripts/sha-en-vivo-staging.py"
)
modulo = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(modulo)

A = "a" * 40
B = "b" * 40


def deploy(status, sha):
    return {"deploy": {"id": "dep-x", "status": status, "commit": {"id": sha}}, "cursor": "c"}


class ShaEnVivoTest(unittest.TestCase):
    def test_toma_el_deploy_live(self):
        lista = [deploy("build_in_progress", B), deploy("live", A), deploy("deactivated", B)]
        self.assertEqual(modulo.sha_en_vivo(lista), A)

    def test_sin_live_devuelve_vacio(self):
        self.assertEqual(modulo.sha_en_vivo([deploy("deactivated", A)]), "")
        self.assertEqual(modulo.sha_en_vivo([]), "")

    def test_rechaza_sha_invalido(self):
        self.assertEqual(modulo.sha_en_vivo([deploy("live", "main; rm -rf /")]), "")
        self.assertEqual(modulo.sha_en_vivo([{"deploy": {"status": "live"}}]), "")

    def test_respuesta_que_no_es_lista_devuelve_vacio(self):
        self.assertEqual(modulo.sha_en_vivo({"message": "unauthorized"}), "")
        self.assertEqual(modulo.sha_en_vivo(["texto", None]), "")

    def test_escribe_la_salida_de_github(self):
        salida = io.StringIO()
        modulo.escribir_salida(A, salida)
        self.assertEqual(salida.getvalue(), f"sha={A}\n")


if __name__ == "__main__":
    unittest.main()
