import { createActor } from "@/backend";
import type { NotificationRecord } from "@/backend";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, BellOff, CheckCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface NotificationPanelProps {
  prefix: string;
}

function formatTs(ts: bigint): string {
  try {
    const ms = Number(ts / 1_000_000n);
    return formatDistanceToNow(new Date(ms), { addSuffix: true });
  } catch {
    return "recently";
  }
}

export function NotificationPanel({ prefix }: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [allItems, setAllItems] = useState<NotificationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const { actor, isFetching } = useActor(createActor);
  const queryClient = useQueryClient();

  // Unread count badge
  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      if (!actor) return 0;
      const res = await actor.getUnreadNotificationCount();
      if (res.__kind__ === "ok") return Number(res.ok);
      return 0;
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 60_000,
  });

  // Load notifications
  const { data: notifData, isLoading } = useQuery<{
    total: bigint;
    items: NotificationRecord[];
  } | null>({
    queryKey: ["notifications", "list", page],
    queryFn: async () => {
      if (!actor) return null;
      const res = await actor.getMyNotifications(BigInt(page), 20n);
      if (res.__kind__ === "ok")
        return { total: res.ok.total, items: res.ok.items };
      return null;
    },
    enabled: !!actor && !isFetching && open,
  });

  useEffect(() => {
    if (notifData) {
      setTotal(Number(notifData.total));
      if (page === 0) {
        setAllItems(notifData.items);
      } else {
        setAllItems((prev) => {
          const ids = new Set(prev.map((n) => n.sentAt.toString() + n.message));
          const fresh = notifData.items.filter(
            (n) => !ids.has(n.sentAt.toString() + n.message),
          );
          return [...prev, ...fresh];
        });
      }
    }
  }, [notifData, page]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleMarkAllRead = async () => {
    if (!actor) return;
    try {
      await actor.markNotificationsRead();
      queryClient.setQueryData(["notifications", "unread"], 0);
    } catch {
      // fail silently
    }
  };

  const handleOpen = () => {
    setPage(0);
    setAllItems([]);
    setOpen(true);
  };

  const handleLoadMore = () => setPage((p) => p + 1);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative text-muted-foreground hover:text-foreground"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        onClick={handleOpen}
        data-ocid={`${prefix}_topbar.notifications_button`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className="notification-badge absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Panel */}
      {open && (
        <section
          aria-label="Notifications"
          className="absolute right-0 top-10 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-xl"
          data-ocid={`${prefix}_topbar.notifications_panel`}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-display text-sm font-semibold text-foreground">
              Notifications
            </h3>
            <div className="flex items-center gap-1">
              {allItems.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleMarkAllRead}
                  data-ocid={`${prefix}_topbar.notifications_mark_read`}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                data-ocid={`${prefix}_topbar.notifications_close`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Items */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading && page === 0 ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : allItems.length === 0 ? (
              <div
                className="flex flex-col items-center gap-2 px-4 py-10 text-center"
                data-ocid={`${prefix}_topbar.notifications_empty`}
              >
                <BellOff className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  No notifications yet
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Status updates will appear here
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {allItems.map((notif, idx) => (
                  <li
                    key={`${notif.sentAt.toString()}-${idx}`}
                    className="px-4 py-3"
                    data-ocid={`${prefix}_topbar.notification_item.${idx + 1}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                          notif.success ? "bg-primary" : "bg-destructive"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-foreground">
                          {notif.message}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatTs(notif.sentAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Load more */}
            {allItems.length > 0 && allItems.length < total && (
              <div className="border-t border-border p-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  data-ocid={`${prefix}_topbar.notifications_load_more`}
                >
                  {isLoading
                    ? "Loading…"
                    : `Load more (${total - allItems.length} remaining)`}
                </Button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
