import "dotenv/config";
import { buildApp } from "./app.js";
import { validateBackendConfig } from "./config.js";
import { logger } from "./logger.js";
import { listFinancerPartyRegistrations } from "./appdb.js";
import { registerDynamicParty, fiPartyKey } from "./canton.js";
import { startNotificationPoller } from "./notifications.js";

// Fail fast in production, warn loudly in dev (review gap G7).
validateBackendConfig();

const PORT = parseInt(process.env.PORT ?? "3000", 10);

// Replay every self-serve-signed-up financer's dynamically-allocated Canton
// party into canton.ts's in-memory registry — that registry isn't persisted
// anywhere else, so without this a restart would strand every previously
// signed-up FI with no resolvable party until they re-signed up.
async function restoreDynamicParties(): Promise<void> {
  const registrations = await listFinancerPartyRegistrations();
  for (const { id, cantonPartyId, cantonPartyJwt } of registrations) {
    registerDynamicParty(fiPartyKey(id), cantonPartyId, cantonPartyJwt ?? "");
  }
  if (registrations.length > 0) {
    logger.info({ count: registrations.length }, "Restored dynamically-allocated financer Canton parties");
  }
}

restoreDynamicParties()
  .catch((err) => logger.error({ err }, "Failed to restore dynamic financer parties — signed-up FIs may be unable to act until they re-signup"))
  .finally(() => {
    buildApp().listen(PORT, () => {
      logger.info({ port: PORT }, `Vetify API listening on http://localhost:${PORT}`);
    });
    startNotificationPoller();
  });
