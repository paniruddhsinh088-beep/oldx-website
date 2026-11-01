import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../contact-policy.js", import.meta.url), "utf8");
const { getServiceContactPermissions, requestServiceContact } =
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

const active = { viewerUid:"buyer", providerUid:"provider", providerStatus:"active" };

test("signed-in buyer can contact active provider", () => {
  const p = getServiceContactPermissions(active);
  assert.equal(p.canChat,true);
  assert.equal(p.canWhatsApp,true);
  assert.equal(p.canCall,true);
});
test("guest cannot chat or use WhatsApp", () => {
  const p = getServiceContactPermissions({...active, viewerUid:null});
  assert.equal(p.canChat,false);
  assert.equal(p.canWhatsApp,false);
  assert.equal(p.requiresSignIn,true);
});
test("provider cannot contact own profile", () => {
  const p = getServiceContactPermissions({...active, viewerUid:"provider"});
  assert.equal(p.canChat,false);
  assert.equal(p.canWhatsApp,false);
  assert.equal(p.canCall,false);
});
test("blocked by either participant disables contact", () => {
  for (const key of ["blockedByViewer","blockedByProvider"]) {
    const p = getServiceContactPermissions({...active,[key]:true});
    assert.equal(p.canChat,false);
    assert.equal(p.canWhatsApp,false);
    assert.equal(p.canCall,false);
  }
});
test("inactive or suspended provider cannot be contacted", () => {
  for (const providerStatus of ["pending","suspended",null]) {
    const p = getServiceContactPermissions({...active,providerStatus});
    assert.equal(p.canChat,false);
    assert.equal(p.canWhatsApp,false);
    assert.equal(p.canCall,false);
  }
});
test("missing provider uid disables contact", () => {
  assert.equal(getServiceContactPermissions({...active,providerUid:null}).canChat,false);
});
test("permission is refreshed when action is clicked", async () => {
  let called=0, resolved=0;
  const result=await requestServiceContact({
    action:"chat",
    resolvePermissions:async()=>{resolved++;return {...active,blockedByProvider:true};},
    onAllowed:async()=>{called++;}
  });
  assert.equal(result.allowed,false);
  assert.equal(resolved,1);
  assert.equal(called,0);
});
test("allowed action calls handler once", async () => {
  let called=0;
  const result=await requestServiceContact({
    action:"whatsapp",resolvePermissions:async()=>active,
    onAllowed:async()=>{called++;}
  });
  assert.equal(result.allowed,true);
  assert.equal(called,1);
});
test("unknown action is rejected", async () => {
  await assert.rejects(requestServiceContact({
    action:"delete",resolvePermissions:async()=>active,onAllowed:async()=>{}
  }),TypeError);
});
