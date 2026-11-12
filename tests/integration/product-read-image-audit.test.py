"""Synthetic docker-save fixtures for the CI layer audit."""

import io
import json
import runpy
import tarfile
import unittest
from pathlib import Path


AUDITOR = runpy.run_path(str(Path(__file__).resolve().parents[2] / "scripts/audit-product-read-image.py"))
NPMRC = AUDITOR["NPMRC"]
KEY = b"-----BEGIN PRIVATE KEY-----\n" + b"A" * 32


def tar(entries):
    data = io.BytesIO()
    with tarfile.open(fileobj=data, mode="w") as archive:
        for path, content in entries:
            member = tarfile.TarInfo(path)
            member.size = len(content)
            archive.addfile(member, io.BytesIO(content))
    return data.getvalue()


def audit(first, second=(), config=None, count=2):
    manifest = [{"Config": "config.json", "Layers": ["one.tar", "two.tar"]}]
    image = tar([
        ("manifest.json", json.dumps(manifest).encode()),
        ("config.json", json.dumps(config or {}).encode()),
        ("one.tar", tar(first)),
        ("two.tar", tar(second)),
    ])
    return AUDITOR["audit"](io.BytesIO(image), b"built-in", count)


class ProductReadImageAudit(unittest.TestCase):
    def test_clean_image(self):
        self.assertEqual(audit([(NPMRC, b"built-in")], [("app/source", b"safe")]), 2)

    def test_deleted_sensitive_filename(self):
        with self.assertRaisesRegex(ValueError, "Sensitive filename in layer 1"):
            audit([("app/.firebaserc", b"synthetic")], [("app/.wh..firebaserc", b"")])

    def test_deleted_key_marker_spans_read_boundary(self):
        with self.assertRaisesRegex(ValueError, "Credential marker in layer 1"):
            audit([("app/renamed", b"x" * 65522 + KEY)], [("app/.wh.renamed", b"")])

    def test_history_key(self):
        with self.assertRaisesRegex(ValueError, "Credential marker in image config or history"):
            audit([], config={"history": [{"created_by": KEY.decode()}]})

    def test_modified_builtin_config(self):
        with self.assertRaisesRegex(ValueError, "Modified built-in npm config"):
            audit([(NPMRC, b"changed")])

    def test_missing_layer(self):
        with self.assertRaisesRegex(ValueError, "Saved layer count"):
            audit([], count=3)

    def test_known_base_path_does_not_exempt_changed_binary(self):
        with self.assertRaisesRegex(ValueError, "Credential marker in layer 1"):
            audit([(AUDITOR["GNUTLS_PATH"], KEY)])

    def test_npm_auth_assignment_requires_a_complete_key(self):
        self.assertEqual(audit([("app/constants.js", b"SOCKS5_NO_ACCEPTABLE_AUTH = syntheticIdentifier")]), 2)
        with self.assertRaisesRegex(ValueError, "Credential marker in layer 1"):
            audit([("app/renamed", b"//registry.example/:_authToken=syntheticFixtureValue")])

    def test_google_auth_documentation_placeholder_is_not_key_material(self):
        example = b'{"type":"service_account","private_key_id":"your-private-key-id","private_key":"your-private-key"}'
        self.assertEqual(audit([("app/node_modules/google-auth-library/README.md", example)]), 2)
        with self.assertRaisesRegex(ValueError, "Credential marker in layer 1"):
            audit([("app/renamed", example.replace(b'"your-private-key"', b'"fixture-key-material"'))])


if __name__ == "__main__":
    unittest.main()
