import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
test("service chat drafts must remain explicitly non-deployable",()=>{
 const chat=read("service-chat.rules.fragment");
 const create=read("service-chat-create.candidate.rules.fragment");
 const base=read("firestore.rules.draft");
 assert.match(chat,/allow create, update, delete: if false;/);
 assert.match(create,/allow create: if false;/);
 assert.match(base,/DO NOT deploy/);
});
test("service chat launch cannot silently turn on via default flags",async()=>{
 const {evaluateServiceChatLaunch}=await import("../service-chat-launch-gate.js");
 assert.deepEqual(evaluateServiceChatLaunch(),{enabled:false,reason:"block-migration-not-ready"});
});
