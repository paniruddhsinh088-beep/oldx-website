import unittest
import tempfile
import pathlib
import os
from scripts.phase_b_auth_receipt_guard import new_receipt,save_new,read_receipt,classify_recovery,UID,EMAIL

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

if __name__=='__main__':unittest.main()
