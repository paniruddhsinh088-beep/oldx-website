#!/usr/bin/env python3
"""OLDX one-user Firebase Auth CRUD proof — versioned reviewed source.

Modes: --review (zero network), --status (one exact UID lookup only),
--execute (one exact disabled/passwordless Auth create, verify, delete, verify).

DO NOT USE --execute unless Yasmin separately confirms live execution after
reviewing THIS version and a supervised cleanup/recovery window is arranged.
No guaranteed rollback: ambiguous API results may leave a disabled user.
"""
import argparse
import getpass
import json
from pathlib import Path
import stat
import subprocess
import sys
import uuid
from urllib import error, parse, request

from scripts.phase_b_auth_receipt_guard import (
    UID, EMAIL, PROJECT, new_receipt, save_new, read_receipt,
    transition_receipt, classify_recovery,
)

OPERATOR = 'yasminparmar087@gmail.com'
BASE = 'https://identitytoolkit.googleapis.com/v1/projects/' + PROJECT
JOURNAL = Path.home() / '.config' / 'oldx-phase-b-auth-probe' / 'receipt.json'


class Stop(RuntimeError):
    pass


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Stop('STOP: redirect blocked')


OPENER = request.build_opener(NoRedirect())


def gcloud(*args):
    return subprocess.check_output(
        ['gcloud', *args], text=True, stderr=subprocess.DEVNULL
    ).strip()


def guard_identity():
    if gcloud('config', 'get-value', 'project') != PROJECT:
        raise Stop('STOP: wrong active project')
    if gcloud('auth', 'list', '--filter=status:ACTIVE', '--format=value(account)') != OPERATOR:
        raise Stop('STOP: wrong active operator')


def api(endpoint, body, *, api_key=None):
    if endpoint not in ('accounts:lookup', 'accounts', 'accounts:delete'):
        raise Stop('STOP: unexpected API endpoint')
    guard_identity()  # Recheck and refresh OAuth token for EVERY API request.
    token = gcloud('auth', 'print-access-token')
    if not token:
        raise Stop('STOP: missing access token')
    url = BASE + '/' + endpoint
    if endpoint == 'accounts':
        if not api_key or len(api_key) > 256:
            raise Stop('STOP: staging Web API key required')
        url += '?' + parse.urlencode({'key': api_key})
    req = request.Request(url, method='POST',
        data=json.dumps(body, separators=(',', ':')).encode(), headers={
            'Authorization': 'Bearer ' + token,
            'X-Goog-User-Project': PROJECT,
            'Content-Type': 'application/json',
        })
    try:
        with OPENER.open(req, timeout=20) as resp:
            if resp.status != 200:
                raise Stop('STOP: unexpected API response status')
            raw = resp.read(65537)
            if len(raw) > 65536:
                raise Stop('STOP: oversized API response')
            data = json.loads(raw or b'{}')
            if not isinstance(data, dict):
                raise Stop('STOP: malformed API response')
            return data
    except error.HTTPError as exc:
        # Never print raw API response, tokens, user details or URL/API key.
        raise Stop('STOP: Auth API HTTP ' + str(exc.code)) from None
    # Timeout/connection failures are ambiguous. Never automatically retry.


def lookup(*, email=False):
    result = api('accounts:lookup', {'email':[EMAIL]} if email else {'localId':[UID]})
    users = result.get('users', [])
    if not isinstance(users, list) or len(users) > 1:
        raise Stop('STOP: invalid exact lookup result')
    if users and (users[0].get('localId') != UID or users[0].get('email') != EMAIL):
        raise Stop('STOP: unexpected UID/email')
    return users[0] if users else None


def journal_directory():
    root = JOURNAL.parent
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if (root.is_symlink() or not stat.S_ISDIR(root.stat().st_mode) or
            root.stat().st_mode & 0o077):
        raise Stop('STOP: unsafe journal directory')
    return root


def receipt_status():
    if not JOURNAL.exists() and not JOURNAL.is_symlink():
        return None
    return read_receipt(JOURNAL)


def status():
    guard_identity()
    receipt = receipt_status()
    current = lookup()
    if current is None:
        print('AUTH: ABSENT AT CHECK TIME')
        if receipt:
            print('JOURNAL:', receipt['state'])
        return 0
    if current.get('disabled') is not True:
        print('STOP: unexpected enabled Auth user')
        return 3
    print('AUTH: PRESENT (exact synthetic UID)')
    if not receipt:
        print('STOP: NO JOURNAL — deletion prohibited')
        return 3
    print('JOURNAL:', receipt['state'])
    print('RECOVERY:', classify_recovery(receipt, current))
    return 3


def confirm(phrase):
    if input('Type ' + phrase + ' to continue: ').strip() != phrase:
        raise Stop('STOP: operator declined')


def execute():
    guard_identity()
    if receipt_status() is not None:
        raise Stop('STOP: previous receipt exists; inspect --status before any new create')
    if lookup() is not None or lookup(email=True) is not None:
        raise Stop('STOP: UID or email already exists')
    print('Exact Auth UID and email ABSENT at preflight time.')
    print('If an API response is lost, this test may leave a disabled user.')
    confirm('ACCEPT-ONE-DISABLED-USER-RISK')
    key = getpass.getpass('Staging Web API key (hidden): ').strip()
    if not key or len(key) > 256:
        raise Stop('STOP: invalid staging Web API key')
    journal_directory()
    save_new(JOURNAL, new_receipt('session-' + uuid.uuid4().hex))
    transition_receipt(JOURNAL, 'INTENT_RECORDED', 'CREATE_UNKNOWN')
    print('Persistent CREATE_UNKNOWN receipt saved before create.')
    confirm('CREATE-EXACT-DISABLED-PROBE')
    result = api('accounts', {
        'localId': UID, 'email': EMAIL,
        'disabled': True, 'emailVerified': False,
    }, api_key=key)
    if result.get('localId') != UID:
        raise Stop('STOP: create result ambiguous; use --status')
    user = lookup()
    if (not user or user.get('disabled') is not True or
            not isinstance(user.get('createdAt'), str) or not user.get('createdAt')):
        raise Stop('STOP: created account cannot be verified; use --status')
    created_at = user['createdAt']
    transition_receipt(JOURNAL, 'CREATE_UNKNOWN', 'CREATED_VERIFIED',
                       created_at=created_at)
    print('CREATED_VERIFIED: persistent creation evidence recorded.')
    print('Auth delete has NO atomic UID-generation precondition.')
    confirm('DELETE-EXACT-VERIFIED-PROBE')
    again = lookup()
    if not again or again.get('createdAt') != created_at or again.get('disabled') is not True:
        raise Stop('STOP: UID or creation timestamp changed; no delete')
    transition_receipt(JOURNAL, 'CREATED_VERIFIED', 'DELETE_UNKNOWN')
    api('accounts:delete', {'localId': UID})
    if lookup() is not None:
        raise Stop('STOP: Auth UID still present; use --status')
    transition_receipt(JOURNAL, 'DELETE_UNKNOWN', 'CLEANUP_VERIFIED')
    print('CLEANUP VERIFIED: exact UID absent at check time.')
    return 0


def main():
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument('--review', action='store_true')
    modes.add_argument('--status', action='store_true')
    modes.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    if args.review:
        print('REVIEW ONLY: zero Cloud requests or changes')
        print('PROJECT:', PROJECT, 'UID:', UID)
        print('disabled/passwordless; precreate journal; exact lookup; exact delete')
        print('LIVE EXECUTION NOT APPROVED; CLEANUP NOT GUARANTEED')
        return 0
    if args.status:
        return status()
    return execute()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        print(str(exc) if isinstance(exc, Stop) else 'STOP: ambiguous/unexpected failure')
        print('Do NOT retry creation or deletion automatically; use --status and supervised review.')
        sys.exit(2)
