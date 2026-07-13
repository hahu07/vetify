/**
 * In-app notification feed — rows populated by the backend-side poller
 * (../notifications.ts), read here by whichever account they belong to.
 * See init.sql's notifications table comment for why this is poller-fed
 * rather than written directly by the choice-exercise routes.
 */
import { Router } from "express";
import { listNotificationsForUser, countUnreadNotifications, markNotificationRead, markAllNotificationsRead } from "../appdb.js";

// requireAuth() is applied once at the mount point (app.ts) — every route
// here just needs req.authUser, not a role check, since notifications apply
// to any authenticated account.
const router = Router();

router.get("/", async (req, res, next) => {
  try {
    res.json(await listNotificationsForUser(req.authUser!.userId));
  } catch (e) { next(e); }
});

router.get("/unread-count", async (req, res, next) => {
  try {
    res.json({ count: await countUnreadNotifications(req.authUser!.userId) });
  } catch (e) { next(e); }
});

// Scoped to (id, userId) inside markNotificationRead itself — a user can only
// ever mark their own notification read, never guess another account's id.
router.post("/:id/read", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid notification id" });
    const updated = await markNotificationRead(id, req.authUser!.userId);
    if (!updated) return res.status(404).json({ error: "Notification not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post("/read-all", async (req, res, next) => {
  try {
    await markAllNotificationsRead(req.authUser!.userId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
