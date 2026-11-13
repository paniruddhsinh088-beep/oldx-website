#!/usr/bin/env python3
"""OLDX Phase B exact-four staging provisioning review runner.

IMPORTANT: ALL CLOUD MUTATIONS ARE HARD-DISABLED IN THIS REVISION.
This is a source-review draft of a keyless authenticated REST workflow, NOT an
operator-approved live fixture tool. --plan is the only permitted mode.

No user should change WRITE_GATE without an independently reviewed next commit,
exact commands shown to Yasmin, proven supervised same-day cleanup capability,
secure test credential handling, and explicit fresh owner authorization.
"""
import argparse
import getpass
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

WRITE_GATE = False  # Security-critical invariant in this review commit.
PROJECT = "oldx-staging"
ACCOUNT = "yasminparmar087@gmail.com"
DATABASE = "(default)"
UIDS = ("synthetic-seller-a", "synthetic-buyer-b")
DOCS = (
    "marketplaceActors_v1/synthetic-seller-a",
    "marketplacePrivate_v1/product_synthetic-phase-b-read-01",
)
AUTH = "https://identitytoolkit.googleapis.com/v1/projects/" + PROJECT
FS = ("https://firestore.googleapis.com/v1/projects/" + PROJECT +
      "/databases/%28default%29/documents")
RUN_LABEL = "phase-b-supervised"
EXPECTED_OPERATOR = ACCOUNT


def cli_output(*args):
    return subprocess.check_output(["gcloud", *args], text=True,
                                   stderr=subprocess.DEVNULL).strip()


def operator_token():
    if cli_output("config", "get-value", "project") != PROJECT:
        raise RuntimeError("STOP: WRONG_PROJECT")
    if cli_output("auth", "list", "--filter=status:ACTIVE",
                  "--format=value(account)") != EXPECTED_OPERATOR:
        raise RuntimeError("STOP: WRONG_OPERATOR")
    token = cli_output("auth", "print-access-token")
    if not token:
        raise RuntimeError("STOP: NO_OAUTH_TOKEN")
    return token


def rest(method, url, token, payload=None):
    if method not in ("GET", "POST", "DELETE"):
        raise RuntimeError("STOP: UNSUPPORTED_HTTP_METHOD")
    if not url.startswith(("https://identitytoolkit.googleapis.com/v1/projects/oldx-staging/",
                           FS + "/")):
        raise RuntimeError("STOP: UNEXPECTED_RESOURCE_OR_ENDPOINT")
    # Only the exact two Cloud APIs are allowed; never follow any redirects.
    data = None if payload is None else json.dumps(payload, separators=(",", ":")).encode()
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + token,
        "X-Goog-User-Project": PROJECT,
        "Content-Type": "application/json",
    })
    opener = urllib.request.build_opener(NoRedirects())
    try:
        with opener.open(req, timeout=20) as response:
            raw = response.read(1024 * 1024)
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        # Never log the API response body: may contain secrets/PII.
        return error.code, {}


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise RuntimeError("STOP: REDIRECT")


def safe_doc_url(path):
    if path not in DOCS:
        raise RuntimeError("STOP: UNKNOWN_DOCUMENT")
    return FS + "/" + "/".join(urllib.parse.quote(x, safe="") for x in path.split("/"))


def auth_lookup(token, uid):
    if uid not in UIDS:
        raise RuntimeError("STOP: UNKNOWN_UID")
    status, response = rest("POST", AUTH + "/accounts:lookup", token, {"localId": [uid]})
    if status != 200 or not isinstance(response.get("users", []), list):
        raise RuntimeError("STOP: AUTH_LOOKUP_FAILED")
    users = response.get("users", [])
    if len(users) > 1 or any(u.get("localId") != uid for u in users):
        raise RuntimeError("STOP: INVALID_AUTH_LOOKUP")
    return users[0] if users else None


def doc_get(token, path):
    status, response = rest("GET", safe_doc_url(path), token)
    if status == 404:
        return None
    if status != 200 or response.get("name", "").split("/documents/")[-1] != path:
        raise RuntimeError("STOP: FIRESTORE_GET_FAILED")
    return response


def read_preflight(token):
    print("EXACT FOUR READ-ONLY COLLISION CHECKS")
    clear = True
    for uid in UIDS:
        found = auth_lookup(token, uid) is not None
        print("AUTH", uid, "EXISTS" if found else "ABSENT")
        clear = clear and not found
    for path in DOCS:
        found = doc_get(token, path) is not None
        print("FIRESTORE", path, "EXISTS" if found else "ABSENT")
        clear = clear and not found
    return clear


def require_write_gate():
    if not WRITE_GATE:
        raise RuntimeError("STOP: WRITE_GATE_FALSE_IN_REVIEW_BRANCH")
    # Not reachable in the committed version. These operations must still be
    # reviewed before anybody may enable the gate.
    raise RuntimeError("STOP: LIVE_WRITE_IMPLEMENTATION_NOT_APPROVED")


def provision_review_only(_token):
    require_write_gate()


def cleanup_review_only(_token):
    require_write_gate()


def print_plan():
    print("OLDX PHASE B — SOURCE-ONLY SUPERVISED CRUD REVIEW")
    print("PROJECT:", PROJECT, "| DATABASE:", DATABASE, "| OPERATOR:", ACCOUNT)
    print("AUTHORIZED UIDS:", ", ".join(UIDS))
    print("AUTHORIZED DOCUMENTS:", ", ".join(DOCS))
    print("AUTH CREATE: POST", AUTH + "/accounts?key=<STAGING_API_KEY>")
    print("  Admin OAuth + quota header; exact localId; synthetic email/password held in memory.")
    print("AUTH DELETE: POST", AUTH + "/accounts:delete")
    print("  Exact localId; creation evidence required; no atomic generation guard.")
    print("FIRESTORE CREATE: POST", FS + "/{collection}?documentId={exactId}")
    print("FIRESTORE DELETE: DELETE", FS + "/{exactPath}?currentDocument.updateTime={freshTime}")
    print("REQUIREMENTS: fresh 4/4 collision check, reviewed payloads, secure secrets,")
    print("  approved exact commands, logged per-ID provenance, confirmed same-day cleanup,")
    print("  no unexpected reads/writes or enabled runtime tests without separate approval.")
    print("MUTATION GATE: CLOSED | NO CLOUD REQUESTS MADE IN --plan")
    print("ACTUAL WRITE/DELETE: NOT IMPLEMENTED; SOURCE REVIEW ONLY")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("plan", "create", "cleanup"), required=True)
    args = parser.parse_args()
    if args.mode == "plan":
        print_plan()
        return 0
    # Prevent any token retrieval/HTTP call for all non-plan modes.
    # Also print no secret values or detailed API responses.
    raise RuntimeError("STOP: LIVE_CREATE_DELETE_DISABLED_IN_SOURCE_REVIEW")


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        label = str(exc)
        if not label.startswith("STOP:"):
            label = "STOP: REVIEW_RUNNER_ERROR"
        print(label)
        sys.exit(2)
