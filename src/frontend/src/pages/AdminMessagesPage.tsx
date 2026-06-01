import { createActor } from "@/backend";
import type {
  BusinessProfile,
  DirectMessageThread,
  FinancierProfile,
  IndividualProfile,
  Message,
} from "@/backend";
import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useActor } from "@caffeineai/core-infrastructure";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  MessageCircle,
  RefreshCw,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function formatTs(ts: bigint): string {
  try {
    return formatDistanceToNow(new Date(Number(ts / 1_000_000n)), {
      addSuffix: true,
    });
  } catch {
    return "";
  }
}

function formatDate(ts: bigint): string {
  try {
    return new Date(Number(ts / 1_000_000n)).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

interface UserDirectoryEntry {
  principal: string;
  name: string;
  role: "business" | "financier" | "individual";
  status?: string;
}

export default function AdminMessagesPage() {
  const { actor, isFetching } = useActor(createActor);
  const { principal: currentUserPrincipal } = useAuth();

  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [selectedThread, setSelectedThread] =
    useState<DirectMessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingDirectory, setLoadingDirectory] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [userDirectory, setUserDirectory] = useState<UserDirectoryEntry[]>([]);
  const [directoryOpen, setDirectoryOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Load admin's own threads ──
  const loadThreads = useCallback(async () => {
    if (!actor || isFetching) return;
    setLoadingThreads(true);
    try {
      const result = await actor.get_my_threads();
      setThreads(result);
    } catch (e) {
      console.error("Failed to load threads", e);
    } finally {
      setLoadingThreads(false);
    }
  }, [actor, isFetching]);

  // ── Load messages for selected thread ──
  const loadMessages = useCallback(
    async (thread: DirectMessageThread) => {
      if (!actor) return;
      setLoadingMessages(true);
      try {
        const parts = thread.threadId.split("_");
        const applicantId = parts[0] ?? "";
        const financierId = parts[1] ?? "";
        const msgs = await actor.get_thread_messages(applicantId, financierId);
        setMessages(msgs);
      } catch (e) {
        console.error("Failed to load messages", e);
      } finally {
        setLoadingMessages(false);
      }
    },
    [actor],
  );

  const selectThread = (thread: DirectMessageThread) => {
    setSelectedThread(thread);
    loadMessages(thread);
  };

  // ── Build participant directory from admin list endpoints ──
  const loadDirectory = useCallback(async () => {
    if (!actor || isFetching) return;
    setLoadingDirectory(true);
    try {
      const entries: UserDirectoryEntry[] = [];

      const bizPage = await actor.adminListBusinesses(0n, 1000n);
      if (bizPage?.items) {
        for (const b of bizPage.items) {
          entries.push({
            principal: b.userId.toString(),
            name: b.businessName || b.contactPerson || "Unnamed Business",
            role: "business",
            status: b.registrationStatus,
          });
        }
      }

      const finPage = await actor.adminListFinanciers(0n, 1000n);
      if (finPage?.items) {
        for (const f of finPage.items) {
          entries.push({
            principal: f.userId.toString(),
            name: f.institutionName || f.contactPerson || "Unnamed Financier",
            role: "financier",
            status: f.registrationStatus,
          });
        }
      }

      const indResult = await actor.adminListIndividuals(0n, 1000n);
      if (
        indResult &&
        "ok" in indResult &&
        indResult.ok &&
        indResult.ok.items
      ) {
        for (const i of indResult.ok.items) {
          entries.push({
            principal: i.id.toString(),
            name: i.fullName || "Unnamed Individual",
            role: "individual" as const,
            status: i.registrationStatus,
          });
        }
      }

      setUserDirectory(entries);
    } catch (e) {
      console.error("Failed to load directory", e);
    } finally {
      setLoadingDirectory(false);
    }
  }, [actor, isFetching]);

  // ── Initial loads ──
  useEffect(() => {
    if (!actor || isFetching) return;
    loadThreads();
    loadDirectory();
  }, [actor, isFetching, loadThreads, loadDirectory]);

  // ── Scroll to bottom on new messages ──
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll triggered by messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Filter threads ──
  const filteredThreads = useMemo(() => {
    let result = [...threads];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => {
        const nameMatch = t.participantIds.some((pid) => {
          const entry = userDirectory.find(
            (u) => u.principal === pid.toString(),
          );
          return entry?.name.toLowerCase().includes(q);
        });
        const idMatch = t.threadId.toLowerCase().includes(q);
        return nameMatch || idMatch;
      });
    }

    if (dateFrom) {
      const fromTs = new Date(dateFrom).getTime() * 1_000_000;
      result = result.filter((t) => Number(t.lastMessageAt) >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo).getTime() * 1_000_000;
      result = result.filter((t) => Number(t.lastMessageAt) <= toTs);
    }

    return result.sort(
      (a, b) => Number(b.lastMessageAt) - Number(a.lastMessageAt),
    );
  }, [threads, searchQuery, dateFrom, dateTo, userDirectory]);

  // ── Resolve participant info ──
  const getParticipantInfo = (principalStr: string) => {
    return (
      userDirectory.find((u) => u.principal === principalStr) || {
        name: `${principalStr.slice(0, 12)}…`,
        role: "unknown" as const,
      }
    );
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "business":
        return (
          <Badge variant="outline" className="text-[10px]">
            Business
          </Badge>
        );
      case "financier":
        return (
          <Badge variant="outline" className="text-[10px]">
            Financier
          </Badge>
        );
      case "individual":
        return (
          <Badge variant="outline" className="text-[10px]">
            Individual
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            Unknown
          </Badge>
        );
    }
  };

  return (
    <AdminLayout>
      <div
        className="flex h-[calc(100vh-3.5rem)] flex-col md:flex-row"
        data-ocid="admin_messages.page"
      >
        {/* Thread list sidebar */}
        <aside
          className={cn(
            "w-full border-b border-border bg-card md:w-80 md:shrink-0 md:border-b-0 md:border-r",
            selectedThread ? "hidden md:flex md:flex-col" : "flex flex-col",
          )}
        >
          {/* Header */}
          <div className="border-b border-border px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-foreground">
                  Message Compliance
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Read-only view of all financier-applicant conversations
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  loadThreads();
                  loadDirectory();
                }}
                disabled={loadingThreads}
                data-ocid="admin_messages.refresh_button"
                aria-label="Refresh threads"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loadingThreads && "animate-spin")}
                />
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name or thread ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-sm"
                data-ocid="admin_messages.search_input"
              />
            </div>

            {/* Date filters */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label
                  htmlFor="date-from"
                  className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
                >
                  From
                </label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-0.5 text-xs h-8"
                  data-ocid="admin_messages.date_from_input"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor="date-to"
                  className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
                >
                  To
                </label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-0.5 text-xs h-8"
                  data-ocid="admin_messages.date_to_input"
                />
              </div>
            </div>

            {/* Directory toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setDirectoryOpen((o) => !o)}
              data-ocid="admin_messages.directory_toggle"
            >
              <Users className="mr-1.5 h-3.5 w-3.5" />
              {directoryOpen ? "Hide" : "Show"} Participant Directory (
              {userDirectory.length})
            </Button>

            {directoryOpen && (
              <div
                className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/30 p-2 space-y-1"
                data-ocid="admin_messages.directory_panel"
              >
                {loadingDirectory ? (
                  <div className="space-y-1">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                ) : userDirectory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No users found.
                  </p>
                ) : (
                  userDirectory.map((u) => (
                    <div
                      key={u.principal}
                      className="flex items-center justify-between text-xs py-0.5"
                    >
                      <span className="truncate font-medium">{u.name}</span>
                      {getRoleBadge(u.role)}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Thread list */}
          <ScrollArea className="flex-1">
            {loadingThreads ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredThreads.length === 0 ? (
              <div
                className="flex flex-col items-center px-4 py-12 text-center"
                data-ocid="admin_messages.empty_state"
              >
                <MessageCircle className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  No conversations found
                </p>
                <p className="mt-1 text-xs text-muted-foreground max-w-[16rem]">
                  {threads.length === 0
                    ? "Thread monitoring shows conversations where you are a participant. Full cross-user thread access requires a dedicated admin messaging API."
                    : "Try adjusting your search or date filters."}
                </p>
              </div>
            ) : (
              <div className="compliance-thread-list space-y-0.5 p-2">
                {filteredThreads.map((thread, idx) => {
                  const lastMsg = thread.messages[thread.messages.length - 1];
                  const isActive = selectedThread?.threadId === thread.threadId;

                  const participants = thread.participantIds.map((pid) =>
                    getParticipantInfo(pid.toString()),
                  );

                  return (
                    <button
                      key={thread.threadId}
                      type="button"
                      onClick={() => selectThread(thread)}
                      className={cn(
                        "compliance-thread-item w-full rounded-lg px-3 py-3 text-left transition-colors",
                        isActive
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-muted/60 text-foreground",
                      )}
                      data-ocid={`admin_messages.thread.item.${idx + 1}`}
                    >
                      {/* Thread ID */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground truncate">
                          {thread.threadId}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatTs(thread.lastMessageAt)}
                        </span>
                      </div>

                      {/* Participants */}
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {participants.map((p, pIdx) => (
                          <span
                            key={`${thread.threadId}-${p.name}`}
                            className="flex items-center gap-1"
                          >
                            {getRoleBadge(p.role)}
                            <span className="text-xs font-medium truncate max-w-[6rem]">
                              {p.name}
                            </span>
                            {pIdx < participants.length - 1 && (
                              <span className="text-muted-foreground">↔</span>
                            )}
                          </span>
                        ))}
                      </div>

                      {/* Last message preview */}
                      {lastMsg && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {lastMsg.messageText}
                        </p>
                      )}

                      {/* Message count */}
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MessageCircle className="h-3 w-3" />
                        {thread.messages.length} message
                        {thread.messages.length !== 1 ? "s" : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </aside>

        {/* Conversation panel */}
        <div
          className={cn(
            "flex flex-1 flex-col bg-background",
            !selectedThread && "hidden md:flex",
          )}
        >
          {!selectedThread ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
              <Shield className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Select a conversation to review
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                This is a read-only compliance view. You cannot send messages
                from here.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground md:hidden"
                  onClick={() => setSelectedThread(null)}
                  aria-label="Back to threads"
                  data-ocid="admin_messages.back_button"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono text-muted-foreground truncate">
                    {selectedThread.threadId}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {selectedThread.participantIds.map((pid, pIdx) => {
                      const info = getParticipantInfo(pid.toString());
                      return (
                        <span
                          key={`${selectedThread.threadId}-${info.name}`}
                          className="flex items-center gap-1"
                        >
                          {getRoleBadge(info.role)}
                          <span className="text-sm font-medium truncate max-w-[8rem]">
                            {info.name}
                          </span>
                          {pIdx < selectedThread.participantIds.length - 1 && (
                            <span className="text-muted-foreground text-xs">
                              ↔
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(selectedThread.lastMessageAt)}
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-4">
                {loadingMessages ? (
                  <div
                    className="space-y-3"
                    data-ocid="admin_messages.loading_state"
                  >
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-3/4 rounded-xl" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex justify-center py-10 text-sm text-muted-foreground">
                    No messages in this conversation yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg, idx) => {
                      const isSelf =
                        currentUserPrincipal !== null &&
                        msg.senderId.toString() ===
                          currentUserPrincipal.toString();
                      const senderInfo = getParticipantInfo(
                        msg.senderId.toString(),
                      );

                      return (
                        <div
                          key={msg.messageId}
                          className={cn(
                            "flex",
                            isSelf ? "justify-end" : "justify-start",
                          )}
                          data-ocid={`admin_messages.message.${idx + 1}`}
                        >
                          <div
                            className={cn(
                              "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                              isSelf
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground",
                            )}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-semibold opacity-80">
                                {senderInfo.name}
                              </span>
                              {getRoleBadge(senderInfo.role)}
                            </div>
                            <p className="break-words leading-relaxed">
                              {msg.messageText}
                            </p>
                            <p
                              className={cn(
                                "mt-1 text-[10px]",
                                isSelf
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground",
                              )}
                            >
                              {formatDate(msg.timestamp)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Read-only footer — NO input, NO send button */}
              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    <Shield className="inline h-3 w-3 mr-1" />
                    Read-only compliance view. {messages.length} message
                    {messages.length !== 1 ? "s" : ""} total.
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Thread ID: {selectedThread.threadId}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
