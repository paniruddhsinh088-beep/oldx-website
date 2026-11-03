import {createPrivateConversationHttp} from './product-conversation-http.mjs';
import {projectServiceConversation} from '../features/service-providers/conversation-dto.mjs';
// Reuses verified token/revocation, fail-closed rate enforcement, bounded JSON,
// cancellation/deadline, no-store and unknown-outcome handling. No endpoint.
export function createProviderConversationHttp(options={}){return createPrivateConversationHttp({...options,contract:{prefix:'provider.conversation.',projection:projectServiceConversation,keys:{read:['providerId','enquiryId','expectedRevision','afterSequence','limit'],send:['providerId','enquiryId','expectedRevision','expectedEnquiryRevision','expectedGeneration','requestId','text']}}});}
