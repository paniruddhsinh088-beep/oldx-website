import { createIsolatedMediaRelease, MEDIA_MODERATION_FIELDS } from './firebase-media-release.mjs';
import { createPrivateConversationHttp } from './product-conversation-http.mjs';
import { copyRecord } from './isolated-firestore-context.mjs';

// Explicit demo/loopback command only. No route registration or live binding.
export function createIsolatedMarketplaceMediaModerationHttp({
  enabled = false, verifyFirebaseToken, consumeRateLimit, timeoutMs = 5000,
  now = Date.now, ...repositoryOptions
} = {}) {
  return createPrivateConversationHttp({
    enabled, verifyFirebaseToken, consumeRateLimit, timeoutMs, now,
    contract: {
      prefix: 'marketplace.media.',
      keys: { moderate: MEDIA_MODERATION_FIELDS },
      mutations: ['moderate'],
      projection(_operation, result) {
        const dto = copyRecord(result, ['ok', 'status', 'revision']);
        return dto?.ok === true && ['moderated', 'replayed'].includes(dto.status)
          && Number.isSafeInteger(dto.revision) && dto.revision > 0 ? dto : null;
      }
    },
    createRepository: scope => {
      const release = createIsolatedMediaRelease({
        ...repositoryOptions, enabled: true, authenticate: scope.authenticate, timeoutMs: scope.timeoutMs, now
      });
      return { moderate: release.moderateMarketplace };
    }
  });
}
