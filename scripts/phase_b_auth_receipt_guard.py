"""OLDX offline-only receipt safety for the separately approved one-user Auth probe.
NO network/SDK/credentials/Create/Delete functionality. Never authorizes delete.
"""
import json
import os
import pathlib
import stat

PROJECT='oldx-staging'
UID='synthetic-auth-crud-probe-20261114'
EMAIL='oldx-auth-crud-probe-20261114@example.invalid'
STATES={'INTENT_RECORDED','CREATE_UNKNOWN','CREATED_VERIFIED','DELETE_UNKNOWN','CLEANUP_VERIFIED'}

def validate(r):
    if not isinstance(r,dict) or set(r)!= {'project','uid','sessionId','state','createdAt'}:
        raise ValueError('STOP: invalid receipt fields')
    if r['project']!=PROJECT or r['uid']!=UID or r['state'] not in STATES:
        raise ValueError('STOP: incorrect target/state')
    s=r['sessionId']
    if not isinstance(s,str) or not 12<=len(s)<=80 or not s.isascii() or not all(c.isalnum() or c in '-_' for c in s):
        raise ValueError('STOP: invalid session')
    if r['createdAt'] is not None and (not isinstance(r['createdAt'],str) or len(r['createdAt'])>64):
        raise ValueError('STOP: bad timestamp')
    if r['state']=='CREATED_VERIFIED' and not r['createdAt']:
        raise ValueError('STOP: evidence missing')
    return r

def new_receipt(session_id):
    return validate(dict(project=PROJECT,uid=UID,sessionId=session_id,state='INTENT_RECORDED',createdAt=None))

def save_new(path,receipt):
    validate(receipt)
    p=pathlib.Path(path)
    parent=p.parent.resolve(strict=True)
    if parent.stat().st_mode & (stat.S_IWGRP|stat.S_IWOTH):
        raise ValueError('STOP: unsafe parent')
    flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL
    if hasattr(os,'O_NOFOLLOW'): flags|=os.O_NOFOLLOW
    fd=os.open(p,flags,0o600)
    try:
        os.fchmod(fd,0o600)
        with os.fdopen(fd,'w',encoding='utf-8') as f:
            json.dump(receipt,f,sort_keys=True)
            f.write('\n')
            f.flush()
            os.fsync(f.fileno())
    except BaseException:
        try: os.unlink(p)
        except OSError: pass
        raise

def read_receipt(path):
    p=pathlib.Path(path)
    if p.is_symlink() or not stat.S_ISREG(p.stat().st_mode) or p.stat().st_mode & 0o077 or p.stat().st_size>2048:
        raise ValueError('STOP: unsafe receipt')
    return validate(json.loads(p.read_text('utf-8')))

def classify_recovery(receipt,observed):
    validate(receipt)
    if observed is None: return 'ABSENT_AT_CHECK_TIME_ONLY'
    if not isinstance(observed,dict) or observed.get('localId')!=UID or observed.get('email')!=EMAIL or observed.get('disabled') is not True:
        return 'STOP_IDENTITY_MISMATCH'
    if not receipt['createdAt'] or receipt['createdAt']!=observed.get('createdAt'):
        return 'STOP_CREATION_EVIDENCE_MISSING_OR_MISMATCH'
    return 'PRESENT_MATCHES_RECEIPT_MANUAL_APPROVAL_REQUIRED'
