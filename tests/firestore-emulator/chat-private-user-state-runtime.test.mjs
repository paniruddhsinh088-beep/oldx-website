import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp
} from "firebase/firestore";

let env;
before(async () => {
  const rules = await readFile(new URL("./chat-private-user-state.candidate.rules", import.meta.url), "utf8");
  env = await initializeTestEnvironment({
    projectId: "demo-oldx-chat-private-state",
    firestore: { rules }
  });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "chats/chatA"), { participants: ["alice", "bob"] });
    await setDoc(doc(db, "chats/chatA/messages/message1"), { senderUid: "alice", body: "synthetic" });
    await setDoc(doc(db, "chats/chatB"), { participants: ["carol", "dave"] });
    await setDoc(doc(db, "chats/malformed"), { participants: ["alice"] });
    await setDoc(doc(db, "chats/chatA/userState/alice"), { unreadCount: 2 });
    await setDoc(doc(db, "chats/chatA/userState/bob"), { unreadCount: 1 });
  });
});
after(async () => { await env?.cleanup(); });

const dbFor = uid => env.authenticatedContext(uid).firestore();
const unauthDb = () => env.unauthenticatedContext().firestore();

test("only owner participant can read own private state", async () => {
  await assertSucceeds(getDoc(doc(dbFor("alice"), "chats/chatA/userState/alice")));
  await assertFails(getDoc(doc(dbFor("alice"), "chats/chatA/userState/bob")));
  await assertFails(getDoc(doc(dbFor("mallory"), "chats/chatA/userState/alice")));
  await assertFails(getDoc(doc(unauthDb(), "chats/chatA/userState/alice")));
});

test("clients cannot create, update, or delete private state cursor documents", async () => {
  const db = dbFor("alice");
  await assertFails(setDoc(doc(db, "chats/chatA/userState/alice"), { unreadCount: 99 }));
  await assertFails(deleteDoc(doc(db, "chats/chatA/userState/alice")));
});

test("malformed or missing chat membership fails closed", async () => {
  const db = dbFor("alice");
  await assertFails(getDoc(doc(db, "chats/malformed/userState/alice")));
  await assertFails(getDoc(doc(db, "chats/missing/userState/alice")));
});

test("owner can hide an existing message with exact server timestamp schema", async () => {
  const db = dbFor("alice");
  await assertSucceeds(setDoc(doc(db, "chats/chatA/userState/alice/hiddenMessages/message1"), {
    schemaVersion: 1, hiddenAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(db, "chats/chatA/userState/alice/hiddenMessages/missing"), {
    schemaVersion: 1, hiddenAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(db, "chats/chatA/userState/alice/hiddenMessages/message1"), {
    schemaVersion: 1, hiddenAt: serverTimestamp(), extra: true
  }));
});

test("another participant cannot read or delete owner's hide marker", async () => {
  const alice = dbFor("alice");
  const bob = dbFor("bob");
  await assertSucceeds(setDoc(doc(alice, "chats/chatA/userState/alice/hiddenMessages/message1"), {
    schemaVersion: 1, hiddenAt: serverTimestamp()
  }));
  await assertFails(getDoc(doc(bob, "chats/chatA/userState/alice/hiddenMessages/message1")));
  await assertFails(deleteDoc(doc(bob, "chats/chatA/userState/alice/hiddenMessages/message1")));
  await assertFails(setDoc(doc(alice, "chats/chatA/userState/alice/hiddenMessages/message1"), {
    schemaVersion: 1, hiddenAt: serverTimestamp()
  }));
});

test("owner can unhide only own marker; cannot update it", async () => {
  const db = dbFor("alice");
  const marker = doc(db, "chats/chatA/userState/alice/hiddenMessages/message1");
  await assertSucceeds(setDoc(marker, { schemaVersion: 1, hiddenAt: serverTimestamp() }));
  await assertFails(setDoc(marker, { schemaVersion: 1, hiddenAt: serverTimestamp() }, { merge: true }));
  await assertSucceeds(deleteDoc(marker));
});

test("typing presence is owner-written and participants-readable", async () => {
  const alice = dbFor("alice");
  const bob = dbFor("bob");
  const until = Timestamp.fromMillis(Date.now() + 60_000);
  await assertSucceeds(setDoc(doc(alice, "chats/chatA/typing/alice"), {
    activeUntil: until, updatedAt: serverTimestamp()
  }));
  await assertSucceeds(getDoc(doc(bob, "chats/chatA/typing/alice")));
  await assertFails(setDoc(doc(bob, "chats/chatA/typing/alice"), {
    activeUntil: until, updatedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(alice, "chats/chatA/typing/bob"), {
    activeUntil: until, updatedAt: serverTimestamp()
  }));
});

test("typing rejects expired, overlong, and extra-field records", async () => {
  const db = dbFor("alice");
  await assertFails(setDoc(doc(db, "chats/chatA/typing/alice"), {
    activeUntil: Timestamp.fromMillis(Date.now() - 1), updatedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(db, "chats/chatA/typing/alice"), {
    activeUntil: Timestamp.fromMillis(Date.now() + 5 * 60_000), updatedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(db, "chats/chatA/typing/alice"), {
    activeUntil: Timestamp.fromMillis(Date.now() + 60_000), updatedAt: serverTimestamp(), extra: 1
  }));
});

test("non-participants cannot read typing records", async () => {
  await assertFails(getDoc(doc(dbFor("mallory"), "chats/chatA/typing/alice")));
});

test("owner can list only their own private state and hidden markers", async () => {
  const alice = dbFor("alice");
  const bob = dbFor("bob");
  await assertSucceeds(getDocs(collection(alice, "chats/chatA/userState/alice/hiddenMessages")));
  await assertFails(getDocs(collection(bob, "chats/chatA/userState/alice/hiddenMessages")));
  await assertSucceeds(getDocs(collection(alice, "chats/chatA/typing")));
  await assertFails(getDocs(collection(dbFor("mallory"), "chats/chatA/typing")));
});
