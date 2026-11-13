#!/usr/bin/env python3
"""OLDX Phase B — single command for exact four-resource readiness.

Read-only remote checks. Offline typed schema validation. NO mutations.
Run from repo root:
  python3 scripts/phase_b_four_resource_gate.py --check-read-only
Only exact fixed staging IDs. Fails closed on any error or collision.
"""
import argparse
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREFLIGHT = ROOT / 'scripts' / 'phase-b-staging-readonly-preflight.py'
TYPED = ROOT / 'scripts' / 'phase-b-firestore-typed-fixture-preview.mjs'

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--check-read-only', action='store_true', required=True)
    args = p.parse_args()
    if not args.check_read_only:
        return 2
    print('PHASE B — 4 EXACT SYNTHETIC RESOURCES', flush=True)
    print('Step 1: offline Firestore typed schema and owner linkage', flush=True)
    # Printing schema would reveal only synthetic data, but suppress verbose output.
    # No shell, no credentials, no network and no mutation in typed preview.
    try:
        schema = subprocess.run(
            ['node', str(TYPED)], cwd=ROOT,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            check=False, timeout=25)
    except (OSError, subprocess.TimeoutExpired):
        schema = None
    if schema is None or schema.returncode != 0:
        print('STOP: OFFLINE_SCHEMA_REVIEW_FAILED', flush=True)
        return 3
    print('SCHEMA: PASS (offline)', flush=True)
    print('Step 2: exact two Auth UID + two Firestore path read-only lookups', flush=True)
    try:
        check = subprocess.run(
            [sys.executable, str(PREFLIGHT), '--check-read-only'],
            cwd=ROOT, check=False, timeout=150)
    except (OSError, subprocess.TimeoutExpired):
        print('STOP: CLOUD_READ_ONLY_PREFLIGHT_INCOMPLETE', flush=True)
        return 3
    if check.returncode != 0:
        print('STOP: CREATION NOT SAFE; NO MUTATIONS PERFORMED', flush=True)
        return 3
    print('READINESS: FOUR ABSENT AT CHECK TIME ONLY', flush=True)
    print('CREATE/DELETE: NOT IMPLEMENTED OR AUTHORIZED BY THIS COMMAND', flush=True)
    print('FIREBASE ID TOKEN + INVOKER + IAM/ACTIVATION GATES STILL OPEN', flush=True)
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print('STOP: UNEXPECTED_READ_ONLY_GATE_FAILURE')
        sys.exit(3)
