import { v as createLucideIcon, Z as useActor, u as useAuth, r as reactExports, j as jsxRuntimeExports, G as AdminLayout, b as Button, af as RefreshCw, z as cn, an as Search, I as Input, U as Users, w as Skeleton, q as Shield, ac as ChevronLeft, B as Badge, aC as formatDistanceToNow, ad as createActor } from "./index-DiwSGmNR.js";
import { S as ScrollArea } from "./scroll-area-Ddb7X2Or.js";
import { M as MessageCircle } from "./message-circle-C1jDekiM.js";
import "./index-IXOTxK3N.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["path", { d: "M8 2v4", key: "1cmpym" }],
  ["path", { d: "M16 2v4", key: "4m81vk" }],
  ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" }],
  ["path", { d: "M3 10h18", key: "8toen8" }],
  ["path", { d: "M8 14h.01", key: "6423bh" }],
  ["path", { d: "M12 14h.01", key: "1etili" }],
  ["path", { d: "M16 14h.01", key: "1gbofw" }],
  ["path", { d: "M8 18h.01", key: "lrp35t" }],
  ["path", { d: "M12 18h.01", key: "mhygvu" }],
  ["path", { d: "M16 18h.01", key: "kzsmim" }]
];
const CalendarDays = createLucideIcon("calendar-days", __iconNode);
function formatTs(ts) {
  try {
    return formatDistanceToNow(new Date(Number(ts / 1000000n)), {
      addSuffix: true
    });
  } catch {
    return "";
  }
}
function formatDate(ts) {
  try {
    return new Date(Number(ts / 1000000n)).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}
function AdminMessagesPage() {
  const { actor, isFetching } = useActor(createActor);
  const { principal: currentUserPrincipal } = useAuth();
  const [threads, setThreads] = reactExports.useState([]);
  const [selectedThread, setSelectedThread] = reactExports.useState(null);
  const [messages, setMessages] = reactExports.useState([]);
  const [loadingThreads, setLoadingThreads] = reactExports.useState(true);
  const [loadingMessages, setLoadingMessages] = reactExports.useState(false);
  const [loadingDirectory, setLoadingDirectory] = reactExports.useState(true);
  const [searchQuery, setSearchQuery] = reactExports.useState("");
  const [dateFrom, setDateFrom] = reactExports.useState("");
  const [dateTo, setDateTo] = reactExports.useState("");
  const [userDirectory, setUserDirectory] = reactExports.useState([]);
  const [directoryOpen, setDirectoryOpen] = reactExports.useState(false);
  const messagesEndRef = reactExports.useRef(null);
  const loadThreads = reactExports.useCallback(async () => {
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
  const loadDirectory = reactExports.useCallback(async () => {
    if (!actor || isFetching) return;
    setLoadingDirectory(true);
    try {
      const entries = [];
      const bizPage = await actor.adminListBusinesses(0n, 1000n);
      if (bizPage == null ? void 0 : bizPage.items) {
        for (const b of bizPage.items) {
          entries.push({
            principal: b.userId.toString(),
            name: b.businessName || b.contactPerson || "Unnamed Business",
            role: "business",
            status: b.registrationStatus
          });
        }
      }
      const finPage = await actor.adminListFinanciers(0n, 1000n);
      if (finPage == null ? void 0 : finPage.items) {
        for (const f of finPage.items) {
          entries.push({
            principal: f.userId.toString(),
            name: f.institutionName || f.contactPerson || "Unnamed Financier",
            role: "financier",
            status: f.registrationStatus
          });
        }
      }
      const indResult = await actor.adminListIndividuals(0n, 1000n);
      if (indResult && "ok" in indResult && indResult.ok && indResult.ok.items) {
        for (const i of indResult.ok.items) {
          entries.push({
            principal: i.id.toString(),
            name: i.fullName || "Unnamed Individual",
            role: "individual",
            status: i.registrationStatus
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
  reactExports.useEffect(() => {
    if (!actor || isFetching) return;
    loadThreads();
    loadDirectory();
  }, [actor, isFetching, loadThreads, loadDirectory]);
  reactExports.useEffect(() => {
    var _a;
    (_a = messagesEndRef.current) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const filteredThreads = reactExports.useMemo(() => {
    let result = [...threads];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => {
        const nameMatch = t.participantIds.some((pid) => {
          const entry = userDirectory.find(
            (u) => u.principal === pid.toString()
          );
          return entry == null ? void 0 : entry.name.toLowerCase().includes(q);
        });
        const idMatch = t.threadId.toLowerCase().includes(q);
        return nameMatch || idMatch;
      });
    }
    if (dateFrom) {
      const fromTs = new Date(dateFrom).getTime() * 1e6;
      result = result.filter((t) => Number(t.lastMessageAt) >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo).getTime() * 1e6;
      result = result.filter((t) => Number(t.lastMessageAt) <= toTs);
    }
    return result.sort(
      (a, b) => Number(b.lastMessageAt) - Number(a.lastMessageAt)
    );
  }, [threads, searchQuery, dateFrom, dateTo, userDirectory]);
  const getParticipantInfo = (principalStr) => {
    return userDirectory.find((u) => u.principal === principalStr) || {
      name: `${principalStr.slice(0, 12)}…`,
      role: "unknown"
    };
  };
  const getRoleBadge = (role) => {
    switch (role) {
      case "business":
        return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "outline", className: "text-[10px]", children: "Business" });
      case "financier":
        return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "outline", className: "text-[10px]", children: "Financier" });
      case "individual":
        return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "outline", className: "text-[10px]", children: "Individual" });
      default:
        return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "outline", className: "text-[10px]", children: "Unknown" });
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AdminLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "flex h-[calc(100vh-3.5rem)] flex-col md:flex-row",
      "data-ocid": "admin_messages.page",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "aside",
          {
            className: cn(
              "w-full border-b border-border bg-card md:w-80 md:shrink-0 md:border-b-0 md:border-r",
              selectedThread ? "hidden md:flex md:flex-col" : "flex flex-col"
            ),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "border-b border-border px-4 py-3 space-y-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-base font-semibold text-foreground", children: "Message Compliance" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-muted-foreground", children: "Read-only view of all financier-applicant conversations" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Button,
                    {
                      type: "button",
                      variant: "ghost",
                      size: "icon",
                      onClick: () => {
                        loadThreads();
                        loadDirectory();
                      },
                      disabled: loadingThreads,
                      "data-ocid": "admin_messages.refresh_button",
                      "aria-label": "Refresh threads",
                      children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                        RefreshCw,
                        {
                          className: cn("h-4 w-4", loadingThreads && "animate-spin")
                        }
                      )
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Search, { className: "absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      placeholder: "Search by name or thread ID…",
                      value: searchQuery,
                      onChange: (e) => setSearchQuery(e.target.value),
                      className: "pl-8 text-sm",
                      "data-ocid": "admin_messages.search_input"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "label",
                      {
                        htmlFor: "date-from",
                        className: "text-[10px] font-medium text-muted-foreground uppercase tracking-wide",
                        children: "From"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Input,
                      {
                        id: "date-from",
                        type: "date",
                        value: dateFrom,
                        onChange: (e) => setDateFrom(e.target.value),
                        className: "mt-0.5 text-xs h-8",
                        "data-ocid": "admin_messages.date_from_input"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "label",
                      {
                        htmlFor: "date-to",
                        className: "text-[10px] font-medium text-muted-foreground uppercase tracking-wide",
                        children: "To"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Input,
                      {
                        id: "date-to",
                        type: "date",
                        value: dateTo,
                        onChange: (e) => setDateTo(e.target.value),
                        className: "mt-0.5 text-xs h-8",
                        "data-ocid": "admin_messages.date_to_input"
                      }
                    )
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  Button,
                  {
                    type: "button",
                    variant: "outline",
                    size: "sm",
                    className: "w-full text-xs",
                    onClick: () => setDirectoryOpen((o) => !o),
                    "data-ocid": "admin_messages.directory_toggle",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(Users, { className: "mr-1.5 h-3.5 w-3.5" }),
                      directoryOpen ? "Hide" : "Show",
                      " Participant Directory (",
                      userDirectory.length,
                      ")"
                    ]
                  }
                ),
                directoryOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "div",
                  {
                    className: "max-h-40 overflow-y-auto rounded-md border border-border bg-muted/30 p-2 space-y-1",
                    "data-ocid": "admin_messages.directory_panel",
                    children: loadingDirectory ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-1", children: [1, 2, 3].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-6 w-full" }, i)) }) : userDirectory.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground text-center py-2", children: "No users found." }) : userDirectory.map((u) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "div",
                      {
                        className: "flex items-center justify-between text-xs py-0.5",
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate font-medium", children: u.name }),
                          getRoleBadge(u.role)
                        ]
                      },
                      u.principal
                    ))
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(ScrollArea, { className: "flex-1", children: loadingThreads ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-2 p-3", children: [1, 2, 3, 4].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-20 w-full rounded-lg" }, i)) }) : filteredThreads.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "flex flex-col items-center px-4 py-12 text-center",
                  "data-ocid": "admin_messages.empty_state",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(MessageCircle, { className: "mb-3 h-8 w-8 text-muted-foreground" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground", children: "No conversations found" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-xs text-muted-foreground max-w-[16rem]", children: threads.length === 0 ? "Thread monitoring shows conversations where you are a participant. Full cross-user thread access requires a dedicated admin messaging API." : "Try adjusting your search or date filters." })
                  ]
                }
              ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "compliance-thread-list space-y-0.5 p-2", children: filteredThreads.map((thread, idx) => {
                const lastMsg = thread.messages[thread.messages.length - 1];
                const isActive = (selectedThread == null ? void 0 : selectedThread.threadId) === thread.threadId;
                const participants = thread.participantIds.map(
                  (pid) => getParticipantInfo(pid.toString())
                );
                return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: () => selectThread(thread),
                    className: cn(
                      "compliance-thread-item w-full rounded-lg px-3 py-3 text-left transition-colors",
                      isActive ? "bg-primary/10 text-foreground" : "hover:bg-muted/60 text-foreground"
                    ),
                    "data-ocid": `admin_messages.thread.item.${idx + 1}`,
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] font-mono text-muted-foreground truncate", children: thread.threadId }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] text-muted-foreground shrink-0", children: formatTs(thread.lastMessageAt) })
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 flex flex-wrap items-center gap-1", children: participants.map((p, pIdx) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "span",
                        {
                          className: "flex items-center gap-1",
                          children: [
                            getRoleBadge(p.role),
                            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-medium truncate max-w-[6rem]", children: p.name }),
                            pIdx < participants.length - 1 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: "↔" })
                          ]
                        },
                        `${thread.threadId}-${p.name}`
                      )) }),
                      lastMsg && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 truncate text-xs text-muted-foreground", children: lastMsg.messageText }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(MessageCircle, { className: "h-3 w-3" }),
                        thread.messages.length,
                        " message",
                        thread.messages.length !== 1 ? "s" : ""
                      ] })
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
              "flex flex-1 flex-col bg-background",
              !selectedThread && "hidden md:flex"
            ),
            children: !selectedThread ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-1 flex-col items-center justify-center text-center px-4", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "mb-3 h-10 w-10 text-muted-foreground" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground", children: "Select a conversation to review" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-xs text-muted-foreground max-w-xs", children: "This is a read-only compliance view. You cannot send messages from here." })
            ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 border-b border-border bg-card px-4 py-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    type: "button",
                    className: "rounded-md p-1 text-muted-foreground hover:text-foreground md:hidden",
                    onClick: () => setSelectedThread(null),
                    "aria-label": "Back to threads",
                    "data-ocid": "admin_messages.back_button",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronLeft, { className: "h-4 w-4" })
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[10px] font-mono text-muted-foreground truncate", children: selectedThread.threadId }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap items-center gap-1.5 mt-0.5", children: selectedThread.participantIds.map((pid, pIdx) => {
                    const info = getParticipantInfo(pid.toString());
                    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "span",
                      {
                        className: "flex items-center gap-1",
                        children: [
                          getRoleBadge(info.role),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-medium truncate max-w-[8rem]", children: info.name }),
                          pIdx < selectedThread.participantIds.length - 1 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground text-xs", children: "↔" })
                        ]
                      },
                      `${selectedThread.threadId}-${info.name}`
                    );
                  }) })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ml-auto flex items-center gap-2 text-[10px] text-muted-foreground", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(CalendarDays, { className: "h-3 w-3" }),
                  formatDate(selectedThread.lastMessageAt)
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(ScrollArea, { className: "flex-1 px-4 py-4", children: loadingMessages ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  className: "space-y-3",
                  "data-ocid": "admin_messages.loading_state",
                  children: [1, 2, 3].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-12 w-3/4 rounded-xl" }, i))
                }
              ) : messages.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-center py-10 text-sm text-muted-foreground", children: "No messages in this conversation yet." }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
                messages.map((msg, idx) => {
                  const isSelf = currentUserPrincipal !== null && msg.senderId.toString() === currentUserPrincipal.toString();
                  const senderInfo = getParticipantInfo(
                    msg.senderId.toString()
                  );
                  return /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "div",
                    {
                      className: cn(
                        "flex",
                        isSelf ? "justify-end" : "justify-start"
                      ),
                      "data-ocid": `admin_messages.message.${idx + 1}`,
                      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "div",
                        {
                          className: cn(
                            "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                            isSelf ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          ),
                          children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 mb-1", children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] font-semibold opacity-80", children: senderInfo.name }),
                              getRoleBadge(senderInfo.role)
                            ] }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "break-words leading-relaxed", children: msg.messageText }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                              "p",
                              {
                                className: cn(
                                  "mt-1 text-[10px]",
                                  isSelf ? "text-primary-foreground/70" : "text-muted-foreground"
                                ),
                                children: formatDate(msg.timestamp)
                              }
                            )
                          ]
                        }
                      )
                    },
                    msg.messageId
                  );
                }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: messagesEndRef })
              ] }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "border-t border-border bg-muted/30 px-4 py-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "inline h-3 w-3 mr-1" }),
                  "Read-only compliance view. ",
                  messages.length,
                  " message",
                  messages.length !== 1 ? "s" : "",
                  " total."
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[10px] text-muted-foreground", children: [
                  "Thread ID: ",
                  selectedThread.threadId
                ] })
              ] }) })
            ] })
          }
        )
      ]
    }
  ) });
}
export {
  AdminMessagesPage as default
};
