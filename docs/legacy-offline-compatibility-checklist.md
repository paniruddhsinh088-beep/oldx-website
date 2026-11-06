# OLDX — offline legacy compatibility checklist

Prepared 7 November 2026. Repository review only; no live inventory has been read.
Use sanitized, already-authorized offline evidence or synthetic fixtures. Record
schemas, counts and provenance, not user text, contact details, IPs or tokens.
Unknown evidence remains UNKNOWN/HOLD; it must not become an empty collection,
false block flag, inferred participant or completed migration.

| Check | Required offline evidence / acceptance gate |
| --- | --- |
| Scope/completeness | Source project/database/collection families, schema versions, evidence date, complete bounded inventory coverage and omitted ranges. Known indexed v1 tests do not prove unknown legacy completeness. |
| Ownership | Canonical Product owner/Store or Provider identity, selected services, enquiry linkage and two distinct authenticated participant UIDs. Reject conflicting aliases or browser-owned privilege flags. |
| Ordering | Stable thread/message identity, sequence range, gaps/duplicates, source revision and timestamp types. Never silently reorder or discard messages. |
| Read state | Exact physical prefixes/counters, monotonic read sequences, per-message readBy/status semantics and reconciled visible unread. Missing thread state or incompatible read markers need a separately verified adapter. |
| Privacy | Hidden-for-self and delete-for-everyone field types, immutable sender, attachment/media authorization and preservation of original values. Unknown fields are not projected into public or notification data. |
| Block mapping | Both directions in both configured canonical stores, matching identities, explicit boolean state and policy provenance. Missing/conflicting records require independent reconciliation; no default false or automatic overwrite. |
| Writer/inventory fence | All source writers participate in revision/epoch invalidation; membership counts and ready inventory match. An unfenced old writer blocks migration and delivery acceptance. |
| Retry/audit | Bounded batch plan, durable checkpoint/receipt/audit, atomic failure/restart/lost-ack evidence and explicit stale-cursor rejection. Added prefixes alone do not finalize an index. |
| Notification eligibility | Both actor inventories current/complete, recipient consent and worker authorization server-owned, visibility/block/read-cursor checks fresh at every delivery checkpoint. Transport stays disabled. |
| Execution gate | Verified source compatibility, permissions, preservation/restore evidence and separately approved environment-specific acceptance. This checklist grants no live access, migration, billing or deployment permission. |
