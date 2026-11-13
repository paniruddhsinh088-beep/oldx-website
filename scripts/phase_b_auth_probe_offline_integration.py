"""Phase B disposable Auth probe: OFFLINE integration contract with journal.

This module has NO HTTP/gcloud/Firebase imports or CLI execution path.
The injected adapter in tests is fake. Do not connect it to a live adapter
until owner-reviewed exact commands, supervised cleanup, and separate approval.
"""
from scripts.phase_b_auth_receipt_guard import (
    UID, EMAIL, new_receipt, save_new, read_receipt, transition_receipt,
    classify_recovery,
)


class StopProbe(RuntimeError):
    pass


class OfflineFakeAuth:
    """Simulation only. No networking; never pass a real HTTP transport."""
    def __init__(self):
        self.user = None
        self.create_timeout = False
        self.delete_timeout = False

    def lookup_uid(self):
        return dict(self.user) if self.user else None

    def lookup_email(self):
        return self.lookup_uid()

    def create_disabled_exact_uid(self):
        self.user = {
            'localId': UID, 'email': EMAIL, 'disabled': True,
            'createdAt': '1731543000000',
        }
        if self.create_timeout:
            raise TimeoutError('simulated create interruption')
        return {'localId': UID}

    def delete_exact_uid(self):
        self.user = None
        if self.delete_timeout:
            raise TimeoutError('simulated delete interruption')


def _stop(reason):
    raise StopProbe('STOP: ' + reason)


def _match(user, created_at=None):
    if (not isinstance(user, dict) or user.get('localId') != UID or
            user.get('email') != EMAIL or user.get('disabled') is not True):
        _stop('identity mismatch')
    ts = user.get('createdAt')
    if not isinstance(ts, str) or not ts or (created_at is not None and ts != created_at):
        _stop('creation evidence mismatch')
    return ts


def offline_create(journal_path, session_id, adapter):
    """Only fake adapter is allowed. No retries on ambiguous create.

    A receipt is written BEFORE create; on any uncertain API result the journal
    remains CREATE_UNKNOWN, deliberately requiring manual recovery.
    """
    if type(adapter) is not OfflineFakeAuth:
        _stop('live adapters forbidden in this offline module')
    if adapter.lookup_uid() is not None or adapter.lookup_email() is not None:
        _stop('pre-existing UID/email')
    save_new(journal_path, new_receipt(session_id))
    transition_receipt(journal_path, 'INTENT_RECORDED', 'CREATE_UNKNOWN')
    # Treat every failure after this point as ambiguous; never auto-retry.
    response = adapter.create_disabled_exact_uid()
    if not isinstance(response, dict) or response.get('localId') != UID:
        _stop('ambiguous create response')
    observed = adapter.lookup_uid()
    created_at = _match(observed)
    transition_receipt(
        journal_path, 'CREATE_UNKNOWN', 'CREATED_VERIFIED',
        created_at=created_at,
    )
    return 'CREATED_VERIFIED_OFFLINE_ONLY'


def offline_cleanup(journal_path, adapter):
    """Demo flow: check receipt, exact UID, then fake delete & verify.

    A genuine Auth delete has NO compare-and-swap/createdAt precondition;
    even this matching demo must not be treated as live deletion authority.
    """
    if type(adapter) is not OfflineFakeAuth:
        _stop('live adapters forbidden in this offline module')
    receipt = read_receipt(journal_path)
    if receipt['state'] != 'CREATED_VERIFIED':
        _stop('journal not confirmed')
    observed = adapter.lookup_uid()
    if classify_recovery(receipt, observed) != 'PRESENT_MATCHES_RECEIPT_MANUAL_APPROVAL_REQUIRED':
        _stop('recovery identity/evidence mismatch')
    transition_receipt(journal_path, 'CREATED_VERIFIED', 'DELETE_UNKNOWN')
    # A failure here leaves DELETE_UNKNOWN for a human to inspect.
    adapter.delete_exact_uid()
    if adapter.lookup_uid() is not None:
        _stop('delete not verified')
    transition_receipt(journal_path, 'DELETE_UNKNOWN', 'CLEANUP_VERIFIED')
    return 'CLEANUP_VERIFIED_OFFLINE_ONLY'
