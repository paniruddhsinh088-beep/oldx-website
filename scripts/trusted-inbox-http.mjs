import {createPrivateConversationHttp} from './product-conversation-http.mjs';
import {projectUnifiedInboxPage} from '../features/chat/unified-inbox.mjs';
// Reuses verified Firebase revocation, atomic quota enforcement, JSON deadlines,
// no-store and response projection. No route/host activation or maintenance APIs.
export const createTrustedInboxHttp=options=>createPrivateConversationHttp({...options,contract:{prefix:'chat.inbox.',keys:{page:['limit','cursor','snapshotId']},mutations:[],projection:(_op,value)=>projectUnifiedInboxPage(value)}});
