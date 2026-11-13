#!/usr/bin/env python3
"""OLDX Phase B supervised preflight: exact four resource existence checks ONLY.

READ ONLY. No create/update/delete methods, no CLI provisioner, no Firebase SDK.
Never outputs access tokens, user profiles, document contents or raw API errors.
Usage: python3 scripts/phase-b-staging-readonly-preflight.py --check-read-only

IMPORTANT: A clear preflight is only a point-in-time observation; repeat right
before any separately authorized create-only calls. It does not prove cleanup.
"""
import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

PROJECT = "oldx-staging"
ACCOUNT = "yasminparmar087@gmail.com"
UIDS = ("synthetic-seller-a", "synthetic-buyer-b")
DOCS = (
    "marketplaceActors_v1/synthetic-seller-a",
    "marketplacePrivate_v1/product_synthetic-phase-b-read-01",
)
AUTH_URL = "https://identitytoolkit.googleapis.com/v1/projects/oldx-staging/accounts:lookup"
FIRESTORE_ROOT = "https://firestore.googleapis.com/v1/projects/oldx-staging/databases/%28default%29/documents/"


def gcloud(*args):
    return subprocess.check_output(["gcloud", *args], text=True, stderr=subprocess.DEVNULL).strip()


def check_auth(uid, token):
    if uid not in UIDS:
        raise ValueError("Unexpected UID")
    body = json.dumps({"localId": [uid]}).encode("utf-8")
    request = urllib.request.Request(AUTH_URL, data=body, method="POST", headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "X-Goog-User-Project": PROJECT,
    })
    # POST is the documented *lookup* method, not a mutation.
    with urllib.request.urlopen(request, timeout=20) as response:
        result = json.load(response)
    users = result.get("users", [])
    if not isinstance(users, list):
        raise ValueError("Malformed auth lookup response")
    if users:
        return "EXISTS"  # Fail closed even on malformed or unexpected user IDs.
    return "ABSENT"


def check_firestore(path, token):
    if path not in DOCS:
        raise ValueError("Unexpected Firestore path")
    path_encoded = "/".join(urllib.parse.quote(s, safe="") for s in path.split("/"))
    request = urllib.request.Request(FIRESTORE_ROOT + path_encoded, method="GET", headers={
        "Authorization": "Bearer " + token,
        "X-Goog-User-Project": PROJECT,
    })
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status == 200:
                return "EXISTS"
            return "BLOCKED"
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return "ABSENT"
        return "BLOCKED"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-read-only", action="store_true", required=True)
    args = parser.parse_args()
    if not args.check_read_only:
        raise ValueError("Read-only flag required")
    if gcloud("config", "get-value", "project") != PROJECT:
        print("STOP: WRONG_PROJECT")
        return 2
    if gcloud("auth", "list", "--filter=status:ACTIVE", "--format=value(account)") != ACCOUNT:
        print("STOP: WRONG_OPERATOR")
        return 2
    token = gcloud("auth", "print-access-token")
    if not token:
        print("STOP: NO_TOKEN")
        return 2

    print("OLDX PHASE B: EXACT-ID READ-ONLY PREFLIGHT")
    print("Project:", PROJECT)
    safe = True
    for uid in UIDS:
        try:
            result = check_auth(uid, token)
        except Exception:
            result = "BLOCKED"
        print("AUTH", uid, result)
        safe = safe and result == "ABSENT"
    for path in DOCS:
        try:
            result = check_firestore(path, token)
        except Exception:
            result = "BLOCKED"
        print("FIRESTORE", path, result)
        safe = safe and result == "ABSENT"
    print("READ ONLY: NO CREATE / UPDATE / DELETE")
    if safe:
        print("PREFLIGHT: FOUR ABSENT AT CHECK TIME; CREATION REMAINS BLOCKED")
        return 0
    print("STOP: COLLISION_OR_UNVERIFIED_RESOURCE")
    return 3


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        print("STOP: OPERATOR_OR_PROJECT_PREFLIGHT_ERROR")
        sys.exit(2)
