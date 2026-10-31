/**
 * Synthetic Admin authorization reference model.
 * Not a production authorization layer; server token verification and role lookup
 * must be implemented independently before any real privilege is granted.
 */
const ADMIN_OPERATIONS = new Set([
  "dashboard.read",
  "users.list", "users.read", "users.suspend", "users.restore", "users.deletion.request",
  "products.list", "products.read", "products.create", "products.update",
  "products.feature", "products.verify", "products.quarantine", "products.restore",
  "stores.list", "stores.read", "stores.review", "stores.verify", "stores.suspend", "stores.restore",
  "reports.list", "reports.read", "reports.resolve", "reports.escalate",
  "settings.business.read", "settings.business.update",
  "audit.read"
]);
const OWNER_ONLY = new Set(["roles.grant", "roles.revoke", "roles.promote", "audit.erase", "audit.disable"]);
const NEVER_ADMIN = new Set(["secrets.read", "passwords.read", "tokens.read", "serviceCredentials.read", "productionInfrastructure.manage"]);

export function adminDecision({ role = "user", active = false, operation, caseLinked = false }) {
  if (NEVER_ADMIN.has(operation) || OWNER_ONLY.has(operation)) return false;
  if (role !== "admin" || active !== true) return false;
  if (operation === "chats.safety.read") return caseLinked === true;
  return ADMIN_OPERATIONS.has(operation);
}
