import { v as createLucideIcon, Z as useActor, u as useAuth, r as reactExports, j as jsxRuntimeExports, w as Skeleton, B as Badge, z as cn, I as Input, b as Button, l as ue, aC as formatDistanceToNow, ad as createActor } from "./index-DiwSGmNR.js";
import { S as ScrollArea } from "./scroll-area-Ddb7X2Or.js";
import { u as useUserRole } from "./use-user-role-DlEe0uPV.js";
import { M as MessageCircle } from "./message-circle-C1jDekiM.js";
import "./index-IXOTxK3N.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  [
    "path",
    {
      d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",
      key: "1ffxy3"
    }
  ],
  ["path", { d: "m21.854 2.147-10.94 10.939", key: "12cjpa" }]
];
const Send = createLucideIcon("send", __iconNode);
function formatTs(ts) {
  try {
    return formatDistanceToNow(new Date(Number(ts / 1000000n)), {
      addSuffix: true
    });
  } catch {
    return "";
  }
}
function threadDisplayName(thread) {
  const parts = thread.threadId.split("_");
  return parts.length >= 2 ? parts[1] ?? thread.threadId : thread.threadId;
}
function MessagesPage() {
  const { actor, isFetching } = useActor(createActor);
  const { role } = useUserRole();
  const { principal: currentUserPrincipal } = useAuth();
  const [threads, setThreads] = reactExports.useState([]);
  const [selectedThread, setSelectedThread] = reactExports.useState(null);
  const [messages, setMessages] = reactExports.useState([]);
  const [inputText, setInputText] = reactExports.useState("");
  const [sending, setSending] = reactExports.useState(false);
  const [loadingThreads, setLoadingThreads] = reactExports.useState(true);
  const [loadingMessages, setLoadingMessages] = reactExports.useState(false);
  const messagesEndRef = reactExports.useRef(null);
  const pollRef = reactExports.useRef(null);
  const isFinancier = role === "financier";
  const loadThreads = reactExports.useCallback(async () => {
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
  const loadMessages = reactExports.useCallback(
    async (thread) => {
      if (!actor) return;
      setLoadingMessages(true);
      try {
        const parts = thread.threadId.split("_");
        const applicantId = parts[0] ?? "";
        const financierId = parts[1] ?? "";
        const msgs = await actor.get_thread_messages(applicantId, financierId);
        setMessages(msgs);
        await actor.mark_messages_read(applicantId, financierId).catch(() => {
        });
        setThreads(
          (prev) => prev.map(
            (t) => t.threadId === thread.threadId ? {
              ...t,
              messages: t.messages.map((m) => ({ ...m, isRead: true }))
            } : t
          )
        );
      } catch (e) {
        console.error("Failed to load messages", e);
      } finally {
        setLoadingMessages(false);
      }
    },
    [actor]
  );
  const selectThread = (thread) => {
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
      const recipient = selectedThread.participantIds[1] ?? selectedThread.participantIds[0];
      if (!recipient) {
        ue.error("Cannot determine recipient.");
        return;
      }
      const result = await actor.send_message(
        applicantId,
        financierId,
        recipient,
        inputText.trim()
      );
      if ("err" in result) {
        ue.error(result.err);
      } else {
        setInputText("");
        await loadMessages(selectedThread);
      }
    } catch {
      ue.error("Failed to send message.");
    } finally {
      setSending(false);
    }
  };
  reactExports.useEffect(() => {
    if (!actor || isFetching) return;
    loadThreads();
  }, [actor, isFetching, loadThreads]);
  reactExports.useEffect(() => {
    if (!actor || isFetching) return;
    pollRef.current = setInterval(() => {
      loadThreads();
      if (selectedThread) loadMessages(selectedThread);
    }, 1e4);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [actor, isFetching, selectedThread, loadThreads, loadMessages]);
  reactExports.useEffect(() => {
    var _a;
    (_a = messagesEndRef.current) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const unreadCount = (thread) => thread.messages.filter((m) => !m.isRead).length;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "flex h-[calc(100vh-3.5rem)] flex-col md:flex-row",
      "data-ocid": "messages.page",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "aside",
          {
            className: cn(
              "w-full border-b border-border bg-card md:w-72 md:shrink-0 md:border-b-0 md:border-r",
              selectedThread ? "hidden md:flex md:flex-col" : "flex flex-col"
            ),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "border-b border-border px-4 py-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-base font-semibold text-foreground", children: "Messages" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(ScrollArea, { className: "flex-1", children: loadingThreads ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-2 p-3", children: [1, 2, 3].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-16 w-full rounded-lg" }, i)) }) : threads.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "flex flex-col items-center px-4 py-12 text-center",
                  "data-ocid": "messages.empty_state",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(MessageCircle, { className: "mb-3 h-8 w-8 text-muted-foreground" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground", children: isFinancier ? "No conversations yet" : "No messages yet" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: isFinancier ? "Start a conversation from an applicant's profile." : "Messages from financiers will appear here." })
                  ]
                }
              ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-0.5 p-2", children: threads.map((thread, idx) => {
                const unread = unreadCount(thread);
                const lastMsg = thread.messages[thread.messages.length - 1];
                const isActive = (selectedThread == null ? void 0 : selectedThread.threadId) === thread.threadId;
                return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: () => selectThread(thread),
                    className: cn(
                      "w-full rounded-lg px-3 py-3 text-left transition-colors",
                      isActive ? "bg-primary/10 text-foreground" : "hover:bg-muted/60 text-foreground"
                    ),
                    "data-ocid": `messages.thread.${idx + 1}`,
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate text-sm font-medium", children: threadDisplayName(thread) }),
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 items-center gap-1.5", children: [
                          unread > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
                            Badge,
                            {
                              className: "h-5 min-w-5 rounded-full px-1.5 text-[10px]",
                              "data-ocid": `messages.unread_badge.${idx + 1}`,
                              children: unread
                            }
                          ),
                          lastMsg && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] text-muted-foreground", children: formatTs(lastMsg.timestamp) })
                        ] })
                      ] }),
                      lastMsg && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 truncate text-xs text-muted-foreground", children: lastMsg.messageText })
                    ]
                  },
                  thread.threadId
                );
              }) }) })
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            className: cn(
              "flex flex-1 flex-col",
              !selectedThread && "hidden md:flex"
            ),
            children: !selectedThread ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-1 flex-col items-center justify-center text-center", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(MessageCircle, { className: "mb-3 h-10 w-10 text-muted-foreground" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Select a conversation to read messages" })
            ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 border-b border-border bg-card px-4 py-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    type: "button",
                    className: "rounded-md p-1 text-muted-foreground hover:text-foreground md:hidden",
                    onClick: () => setSelectedThread(null),
                    "aria-label": "Back to threads",
                    "data-ocid": "messages.back_button",
                    children: "←"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: threadDisplayName(selectedThread) })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(ScrollArea, { className: "flex-1 px-4 py-4", children: loadingMessages ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", "data-ocid": "messages.loading_state", children: [1, 2, 3].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-12 w-3/4 rounded-xl" }, i)) }) : messages.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-center py-10 text-sm text-muted-foreground", children: "No messages in this conversation yet." }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
                messages.map((msg, idx) => {
                  const isSelf = currentUserPrincipal !== null && msg.senderId.toString() === currentUserPrincipal.toString();
                  return /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "div",
                    {
                      className: cn(
                        "flex",
                        isSelf ? "justify-end" : "justify-start"
                      ),
                      "data-ocid": `messages.message.${idx + 1}`,
                      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "div",
                        {
                          className: cn(
                            "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                            isSelf ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          ),
                          children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "break-words leading-relaxed", children: msg.messageText }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                              "p",
                              {
                                className: cn(
                                  "mt-1 text-[10px]",
                                  isSelf ? "text-primary-foreground/70" : "text-muted-foreground"
                                ),
                                children: formatTs(msg.timestamp)
                              }
                            )
                          ]
                        }
                      )
                    },
                    `${msg.messageId}-${idx}`
                  );
                }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: messagesEndRef })
              ] }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "border-t border-border bg-card px-4 py-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "form",
                {
                  onSubmit: (e) => {
                    e.preventDefault();
                    handleSend();
                  },
                  className: "flex items-center gap-2",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Input,
                      {
                        value: inputText,
                        onChange: (e) => setInputText(e.target.value),
                        placeholder: "Type a message…",
                        className: "flex-1",
                        disabled: sending,
                        "data-ocid": "messages.input"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Button,
                      {
                        type: "submit",
                        size: "icon",
                        disabled: sending || !inputText.trim(),
                        "data-ocid": "messages.send_button",
                        "aria-label": "Send message",
                        children: /* @__PURE__ */ jsxRuntimeExports.jsx(Send, { className: "h-4 w-4" })
                      }
                    )
                  ]
                }
              ) })
            ] })
          }
        )
      ]
    }
  );
}
export {
  MessagesPage as default
};
