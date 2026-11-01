/** Pure service-chat launch gate: conservative, no database side effects. */
import {evaluateLegacyBlockMigration} from "./legacy-block-migration-gate.js";
export function evaluateServiceChatLaunch({migration,deployedRulesSourceVerified=false,legacyChatRulesAudited=false,serverBlockRulesVerified=false,clientWriteRulesVerified=false}={}) {
 const check=evaluateLegacyBlockMigration(migration);
 if(!check.ready) return Object.freeze({enabled:false,reason:"block-migration-not-ready"});
 if(deployedRulesSourceVerified!==true) return Object.freeze({enabled:false,reason:"deployed-rules-source-not-verified"});
 if(legacyChatRulesAudited!==true) return Object.freeze({enabled:false,reason:"legacy-chat-rules-not-audited"});
 if(serverBlockRulesVerified!==true) return Object.freeze({enabled:false,reason:"server-block-rules-not-verified"});
 if(clientWriteRulesVerified!==true) return Object.freeze({enabled:false,reason:"client-write-rules-not-verified"});
 return Object.freeze({enabled:true,reason:"preflight-passed"});
}
