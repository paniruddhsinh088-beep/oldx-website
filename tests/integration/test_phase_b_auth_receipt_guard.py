import unittest
import tempfile
import pathlib
import os
from scripts.phase_b_auth_receipt_guard import new_receipt,save_new,read_receipt,classify_recovery,transition_receipt,UID,EMAIL

class TestReceipt(unittest.TestCase):
    def test_exclusive_private(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json';r=new_receipt('synthetic-session-123')
            save_new(p,r);self.assertEqual(p.stat().st_mode & 0o777,0o600)
            self.assertEqual(read_receipt(p)['uid'],UID)
            with self.assertRaises(FileExistsError):save_new(p,r)
    def test_no_secret(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json';save_new(p,new_receipt('synthetic-session-123'))
            v=p.read_text()
            self.assertNotIn('email',v.lower());self.assertNotIn('password',v.lower())
    def test_missing_evidence_stops(self):
        r=new_receipt('synthetic-session-123')
        o=dict(localId=UID,email=EMAIL,disabled=True,createdAt='123')
        self.assertIn('STOP_',classify_recovery(r,o))
    def test_correct_evidence_requires_manual_approval(self):
        r=new_receipt('synthetic-session-123');r.update(state='CREATED_VERIFIED',createdAt='123')
        o=dict(localId=UID,email=EMAIL,disabled=True,createdAt='123')
        self.assertEqual(classify_recovery(r,o),'PRESENT_MATCHES_RECEIPT_MANUAL_APPROVAL_REQUIRED')
    def test_absence_is_temporal(self):
        self.assertEqual(classify_recovery(new_receipt('synthetic-session-123'),None),'ABSENT_AT_CHECK_TIME_ONLY')
    def test_wrong_uid_and_public_receipt_stop(self):
        r=new_receipt('synthetic-session-123');r['uid']='other'
        with self.assertRaises(ValueError):classify_recovery(r,None)
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json';save_new(p,new_receipt('synthetic-session-123'))
            os.chmod(p,0o644)
            with self.assertRaises(ValueError):read_receipt(p)


class TestTransitions(unittest.TestCase):
    def test_safe_offline_state_cycle_and_permissions(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json'
            save_new(p,new_receipt('synthetic-session-123'))
            self.assertEqual(transition_receipt(p,'INTENT_RECORDED','CREATE_UNKNOWN')['state'],'CREATE_UNKNOWN')
            self.assertEqual(transition_receipt(p,'CREATE_UNKNOWN','CREATED_VERIFIED',created_at='123')['createdAt'],'123')
            self.assertEqual(transition_receipt(p,'CREATED_VERIFIED','DELETE_UNKNOWN')['state'],'DELETE_UNKNOWN')
            self.assertEqual(transition_receipt(p,'DELETE_UNKNOWN','CLEANUP_VERIFIED')['state'],'CLEANUP_VERIFIED')
            self.assertEqual(p.stat().st_mode & 0o777,0o600)
            self.assertEqual(read_receipt(p)['state'],'CLEANUP_VERIFIED')

    def test_stale_state_must_not_override_journal(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json'
            save_new(p,new_receipt('synthetic-session-123'))
            with self.assertRaisesRegex(ValueError,'STOP'):
                transition_receipt(p,'CREATE_UNKNOWN','CREATED_VERIFIED',created_at='123')
            self.assertEqual(read_receipt(p)['state'],'INTENT_RECORDED')

    def test_missing_creation_evidence_must_stop(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json'
            save_new(p,new_receipt('synthetic-session-123'))
            transition_receipt(p,'INTENT_RECORDED','CREATE_UNKNOWN')
            with self.assertRaisesRegex(ValueError,'STOP'):
                transition_receipt(p,'CREATE_UNKNOWN','CREATED_VERIFIED')
            self.assertEqual(read_receipt(p)['state'],'CREATE_UNKNOWN')

    def test_illegal_direct_to_cleanup_must_stop(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'receipt.json'
            save_new(p,new_receipt('synthetic-session-123'))
            with self.assertRaisesRegex(ValueError,'STOP'):
                transition_receipt(p,'INTENT_RECORDED','CLEANUP_VERIFIED')

    def test_symlink_and_public_journal_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            folder=pathlib.Path(d)
            p=folder/'receipt.json'
            save_new(p,new_receipt('synthetic-session-123'))
            os.chmod(p,0o644)
            with self.assertRaisesRegex(ValueError,'STOP'):
                transition_receipt(p,'INTENT_RECORDED','CREATE_UNKNOWN')
            q=folder/'link.json'
            q.symlink_to(p)
            with self.assertRaisesRegex(ValueError,'STOP'):
                transition_receipt(q,'INTENT_RECORDED','CREATE_UNKNOWN')

if __name__=='__main__':unittest.main()
