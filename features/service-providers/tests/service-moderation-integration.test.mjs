import test from "node:test";
import assert from "node:assert/strict";
import {mountFirestoreServiceModeration} from "../service-moderation-integration.js";
test("integration remains disabled by default",()=>{
 assert.throws(()=>mountFirestoreServiceModeration(null,{}),/disabled/);
});
test("enabled integration still requires authentication",()=>{
 assert.throws(()=>mountFirestoreServiceModeration(null,{enabled:true,auth:{currentUser:null},db:{collection(){}}}),/Sign in/);
});
