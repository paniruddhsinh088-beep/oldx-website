import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
test("service chat writes remain explicitly disabled in candidate and room fragment",()=>{
 const create=read("service-chat-create.candidate.rules.fragment");
 const chat=read("service-chat.rules.fragment");
 assert.match(create,/allow create: if false;/);
 assert.match(chat,/allow create, update, delete: if false;/);
 assert.match(chat,/allow get, list: if canReadServiceMessages\(\);/);
});
test("service chat block edges are separate from legacy user block lists",()=>{
 const edges=read("service-chat-block-edges.rules.fragment");
 assert.match(edges,/serviceChatBlocks\/\{blockerUid\}\/blocked\/\{blockedUid\}/);
 assert.match(edges,/allow update: if false;/);
 assert.match(edges,/Existing users\/\{uid\}\.blockedUsers must be reconciled/);
});
