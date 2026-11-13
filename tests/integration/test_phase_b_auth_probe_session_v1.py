"""All tests use fake HTTP and temporary receipts. Never contact Google."""
import pathlib
import tempfile
import unittest
from unittest.mock import patch

from scripts import phase_b_auth_probe_session_v1 as probe
from scripts.phase_b_auth_receipt_guard import UID, EMAIL, read_receipt


class SimulatedBackend:
    def __init__(self):
        self.user = None
        self.create_timeout = False
        self.delete_timeout = False
        self.events = []

    def lookup(self, *, email=False):
        self.events.append('lookup_email' if email else 'lookup_uid')
        return dict(self.user) if self.user else None

    def api(self, endpoint, body, *, api_key=None):
        self.events.append(endpoint)
        if endpoint == 'accounts':
            if api_key != 'staging-key-placeholder':
                raise ValueError('missing key')
            self.user = {'localId': UID, 'email': EMAIL, 'disabled': True,
                         'createdAt': '1731543000000'}
            if self.create_timeout:
                raise TimeoutError('simulated create outcome ambiguous')
            return {'localId': UID}
        if endpoint == 'accounts:delete':
            self.user = None
            if self.delete_timeout:
                raise TimeoutError('simulated delete outcome ambiguous')
            return {}
        raise AssertionError('Unexpected endpoint')


class TestOneSession(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = pathlib.Path(self.temp.name) / 'private' / 'receipt.json'
        self.fake = SimulatedBackend()
        patches = [
            patch.object(probe, 'JOURNAL', self.path),
            patch.object(probe, 'guard_identity', lambda: None),
            patch.object(probe, 'lookup', side_effect=self.fake.lookup),
            patch.object(probe, 'api', side_effect=self.fake.api),
            patch.object(probe.getpass, 'getpass', return_value='staging-key-placeholder'),
            patch('builtins.input', side_effect=[
                'ACCEPT-ONE-DISABLED-USER-RISK', 'CREATE-EXACT-DISABLED-PROBE',
                'DELETE-EXACT-VERIFIED-PROBE',
            ]),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def test_fake_end_to_end_and_durable_receipt(self):
        self.assertEqual(probe.execute(), 0)
        self.assertIsNone(self.fake.user)
        self.assertEqual(read_receipt(self.path)['state'], 'CLEANUP_VERIFIED')
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.fake.events.count('accounts'), 1)
        self.assertEqual(self.fake.events.count('accounts:delete'), 1)

    def test_timeout_after_possible_create_never_retries(self):
        self.fake.create_timeout = True
        with self.assertRaises(TimeoutError):
            probe.execute()
        self.assertIsNotNone(self.fake.user)
        self.assertEqual(read_receipt(self.path)['state'], 'CREATE_UNKNOWN')
        self.assertEqual(self.fake.events.count('accounts'), 1)
        self.assertEqual(self.fake.events.count('accounts:delete'), 0)

    def test_timeout_after_possible_delete_remains_unknown(self):
        self.fake.delete_timeout = True
        with self.assertRaises(TimeoutError):
            probe.execute()
        self.assertEqual(read_receipt(self.path)['state'], 'DELETE_UNKNOWN')
        self.assertEqual(self.fake.events.count('accounts:delete'), 1)

    def test_existing_uid_prevents_create(self):
        self.fake.user = {'localId': UID, 'email': EMAIL, 'disabled': True,
                          'createdAt': 'older'}
        with self.assertRaises(probe.Stop):
            probe.execute()
        self.assertFalse(self.path.exists())

    def test_existing_journal_blocks_second_session(self):
        probe.journal_directory()
        from scripts.phase_b_auth_receipt_guard import save_new, new_receipt
        save_new(self.path, new_receipt('synthetic-session-123'))
        with self.assertRaises(probe.Stop):
            probe.execute()
        self.assertNotIn('accounts', self.fake.events)

    def test_read_only_status_reports_present_as_not_clean(self):
        self.fake.user = {'localId': UID, 'email': EMAIL, 'disabled': True,
                          'createdAt': 'older'}
        self.assertEqual(probe.status(), 3)
        self.assertNotIn('accounts:delete', self.fake.events)


if __name__ == '__main__':
    unittest.main()
