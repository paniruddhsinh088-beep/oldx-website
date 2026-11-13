import tempfile
import pathlib
import unittest
from scripts.phase_b_auth_receipt_guard import UID, EMAIL, read_receipt
from scripts.phase_b_auth_probe_offline_integration import offline_create, offline_cleanup, StopProbe, OfflineFakeAuth


class TestOfflineIntegration(unittest.TestCase):
    def test_successful_fake_session(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json'
            fake=OfflineFakeAuth()
            self.assertEqual(offline_create(p,'synthetic-session-123',fake),'CREATED_VERIFIED_OFFLINE_ONLY')
            self.assertEqual(read_receipt(p)['state'],'CREATED_VERIFIED')
            self.assertEqual(offline_cleanup(p,fake),'CLEANUP_VERIFIED_OFFLINE_ONLY')
            self.assertEqual(read_receipt(p)['state'],'CLEANUP_VERIFIED')
            self.assertIsNone(fake.lookup_uid())

    def test_timeout_after_remote_create_requires_manual_recovery(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json'
            fake=OfflineFakeAuth();fake.create_timeout=True
            with self.assertRaises(TimeoutError):
                offline_create(p,'synthetic-session-123',fake)
            self.assertIsNotNone(fake.lookup_uid())
            self.assertEqual(read_receipt(p)['state'],'CREATE_UNKNOWN')
            with self.assertRaises(StopProbe):
                offline_cleanup(p,fake)

    def test_timeout_after_remote_delete_leaves_unknown(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json'
            fake=OfflineFakeAuth()
            offline_create(p,'synthetic-session-123',fake)
            fake.delete_timeout=True
            with self.assertRaises(TimeoutError):
                offline_cleanup(p,fake)
            self.assertEqual(read_receipt(p)['state'],'DELETE_UNKNOWN')

    def test_identity_mismatch_prevents_delete(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json'
            fake=OfflineFakeAuth()
            offline_create(p,'synthetic-session-123',fake)
            fake.user['createdAt']='changed'
            with self.assertRaises(StopProbe):
                offline_cleanup(p,fake)
            self.assertEqual(read_receipt(p)['state'],'CREATED_VERIFIED')

    def test_existing_uid_prevents_any_journal_creation(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json'
            fake=OfflineFakeAuth()
            fake.user={'localId':UID,'email':EMAIL,'disabled':True,'createdAt':'existing'}
            with self.assertRaises(StopProbe):
                offline_create(p,'synthetic-session-123',fake)
            self.assertFalse(p.exists())

    def test_nonfake_adapter_blocked(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json'
            class LiveAdapter: pass
            with self.assertRaises(StopProbe):
                offline_create(p,'synthetic-session-123',LiveAdapter())
            self.assertFalse(p.exists())


if __name__=='__main__':
    unittest.main()
