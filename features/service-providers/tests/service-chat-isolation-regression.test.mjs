import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
test("draft chat rules preserve explicit product-chat isolation",()=>{
 const chat=read("service-chat.rules.fragment");
 assert.match(chat,/chatType', ''\) == 'service'/);
 assert.match(chat,/allow list: if false;/);
 assert.match(chat,/request\.auth\.uid in resource\.data\.participants/);
});
test("production rules provenance remains an explicit launch blocker",()=>{
 const doc=read("docs/firestore-rules-provenance-blocker.md");
 assert.match(doc,/legacy-chat-rules-audited launch flag must remain false/);
 assert.match(doc,/Do not infer production permissions from the draft/);
});
