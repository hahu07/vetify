import { createActor } from "@/backend";
import type { DirectMessageThread, Message } from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { cn } from "@/lib/utils";
import { useActor } from "@caffeineai/core-infrastructure";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

function formatTs(ts: bigint): string {
  try {
    return formatDistanceToNow(new Date(Number(ts / 1_000_000n)), {
      addSuffix: true,
    });
  } catch {
    return "";
  }
}

function threadDisplayName(thread: DirectMessageThread): string {
  const parts = thread.threadId.split("_");
  return parts.length >= 2 ? (parts[1] ?? thread.threadId) : thread.threadId;
}

export default function MessagesPage() {
  const { actor, isFetching } = useActor(createActor);
  const { role } = useUserRole();
  const { principal: currentUserPrincipal } = useAuth();
  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [selectedThread, setSelectedThread] =
    useState<DirectMessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isFinancier = role === "financier";

  const loadThreads = useCallback(async () => {
    if (!actor || isFetching) return;
    try {
      const result = await actor.get_my_threads();
      setThreads(result);
    } catch (e) {
      console.error("Failed to load threads", e);
    } finally {
      setLoadingThreads(false);
    }
  }, [actor, isFetching]);

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
        // Mark as read
        await actor
          .mark_messages_read(applicantId, financierId)
          .catch(() => {});
        // Update unread counts in thread list
        setThreads((prev) =>
          prev.map((t) =>
            t.threadId === thread.threadId
              ? {
                  ...t,
                  messages: t.messages.map((m) => ({ ...m, isRead: true })),
                }
              : t,
          ),
        );
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

  const handleSend = async () => {
    if (!inputText.trim() || !selectedThread || !actor) return;
    setSending(true);
    try {
      const parts = selectedThread.threadId.split("_");
      const applicantId = parts[0] ?? "";
      const financierId = parts[1] ?? "";
      // Determine recipientId from participants — the one that is not the sender
      const recipient =
        selectedThread.participantIds[1] ?? selectedThread.participantIds[0];
      if (!recipient) {
        toast.error("Cannot determine recipient.");
        return;
      }
      const result = await actor.send_message(
        applicantId,
        financierId,
        recipient,
        inputText.trim(),
      );
      if ("err" in result) {
        toast.error(result.err);
      } else {
        setInputText("");
        await loadMessages(selectedThread);
      }
    } catch {
      toast.error("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!actor || isFetching) return;
    loadThreads();
  }, [actor, isFetching, loadThreads]);

  // Poll every 10 seconds
  useEffect(() => {
    if (!actor || isFetching) return;
    pollRef.current = setInterval(() => {
      loadThreads();
      if (selectedThread) loadMessages(selectedThread);
    }, 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [actor, isFetching, selectedThread, loadThreads, loadMessages]);

  // Scroll to bottom on new messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll triggered by messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const unreadCount = (thread: DirectMessageThread) =>
    thread.messages.filter((m) => !m.isRead).length;

  return (
    <div
      className="flex h-[calc(100vh-3.5rem)] flex-col md:flex-row"
      data-ocid="messages.page"
    >
      {/* Thread list */}
      <aside
        className={cn(
          "w-full border-b border-border bg-card md:w-72 md:shrink-0 md:border-b-0 md:border-r",
          selectedThread ? "hidden md:flex md:flex-col" : "flex flex-col",
        )}
      >
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-semibold text-foreground">
            Messages
          </h2>
        </div>
        <ScrollArea className="flex-1">
          {loadingThreads ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div
              className="flex flex-col items-center px-4 py-12 text-center"
              data-ocid="messages.empty_state"
            >
              <MessageCircle className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                {isFinancier ? "No conversations yet" : "No messages yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isFinancier
                  ? "Start a conversation from an applicant's profile."
                  : "Messages from financiers will appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 p-2">
              {threads.map((thread, idx) => {
                const unread = unreadCount(thread);
                const lastMsg = thread.messages[thread.messages.length - 1];
                const isActive = selectedThread?.threadId === thread.threadId;
                return (
                  <button
                    key={thread.threadId}
                    type="button"
                    onClick={() => selectThread(thread)}
                    className={cn(
                      "w-full rounded-lg px-3 py-3 text-left transition-colors",
                      isActive
                        ? "bg-primary/10 text-foreground"
                        : "hover:bg-muted/60 text-foreground",
                    )}
                    data-ocid={`messages.thread.${idx + 1}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {threadDisplayName(thread)}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {unread > 0 && (
                          <Badge
                            className="h-5 min-w-5 rounded-full px-1.5 text-[10px]"
                            data-ocid={`messages.unread_badge.${idx + 1}`}
                          >
                            {unread}
                          </Badge>
                        )}
                        {lastMsg && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatTs(lastMsg.timestamp)}
                          </span>
                        )}
                      </div>
                    </div>
                    {lastMsg && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {lastMsg.messageText}
                      </p>
                    )}
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
          "flex flex-1 flex-col",
          !selectedThread && "hidden md:flex",
        )}
      >
        {!selectedThread ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <MessageCircle className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Select a conversation to read messages
            </p>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground md:hidden"
                onClick={() => setSelectedThread(null)}
                aria-label="Back to threads"
                data-ocid="messages.back_button"
              >
                ←
              </button>
              <span className="font-medium text-foreground">
                {threadDisplayName(selectedThread)}
              </span>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-4">
              {loadingMessages ? (
                <div className="space-y-3" data-ocid="messages.loading_state">
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
                    return (
                      <div
                        key={`${msg.messageId}-${idx}`}
                        className={cn(
                          "flex",
                          isSelf ? "justify-end" : "justify-start",
                        )}
                        data-ocid={`messages.message.${idx + 1}`}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                            isSelf
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground",
                          )}
                        >
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
                            {formatTs(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="border-t border-border bg-card px-4 py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1"
                  disabled={sending}
                  data-ocid="messages.input"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={sending || !inputText.trim()}
                  data-ocid="messages.send_button"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
