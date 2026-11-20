import React, { useRef, useEffect } from "react";
import { PageHeader } from "../shell/PageHeader";
import { InversePanel } from "../ui/InversePanel";
import { ListRow } from "../ui/ListRow";
import { SubTile } from "../ui/SubTile";
import { Chip } from "../ui/Chip";
import { Button } from "../ui/Button";
import {
  Send,
  MessageSquare,
  User,
  Bot,
  CheckCircle2,
  Phone,
  Mail,
  DollarSign,
  Briefcase,
  Sliders,
} from "lucide-react";

export interface ChatSession {
  id: string;
  created_at: string;
  last_message_at: string;
  last_message_text?: string;
  unread_count: number;
  is_human_takeover: boolean;
  production_type?: string;
  production_grade?: string;
  budget?: string;
  email?: string;
  requirements_brief?: string;
  chat_users?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: "user" | "bot" | "admin";
  message_text: string;
  created_at: string;
}

export interface LiveChatsTabProps {
  sessions: ChatSession[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  messages: ChatMessage[];
  replyText: string;
  onReplyTextChange: (text: string) => void;
  onSendReply: (e: React.FormEvent) => void;
  onToggleTakeover: (sessionId: string, currentVal: boolean) => void;
  isLoading: boolean;
}

export const LiveChatsTab: React.FC<LiveChatsTabProps> = ({
  sessions,
  selectedSessionId,
  onSelectSession,
  messages,
  replyText,
  onReplyTextChange,
  onSendReply,
  onToggleTakeover,
  isLoading,
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const activeSession = sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null;
  const user = activeSession?.chat_users;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="REALTIME CONCIERGE & TAKEOVER"
        title="Live Support Chats"
        statusChip={
          <Chip
            status="live"
            dot
            label={`${sessions.filter((s) => s.unread_count > 0).length} unread`}
          />
        }
      />

      {/* 3 Columns Layout at ≥1440 (Sessions · Thread · Visitor Info) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: InversePanel for Sessions List (4 cols) */}
        <div className="lg:col-span-4">
          <InversePanel
            eyebrow="CONVERSATION INBOX"
            title={`Sessions (${sessions.length})`}
            headerBorder={true}
          >
            <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
              {isLoading ? (
                <div className="py-16 text-center text-[#07080C]/50 font-mono text-xs">
                  Loading active chats...
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-16 text-center text-[#07080C]/50">
                  No active chat sessions.
                </div>
              ) : (
                sessions.map((session) => {
                  const isSelected = (activeSession?.id || "") === session.id;
                  const name = session.chat_users?.name || "Visitor Lead";
                  const initials = name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <ListRow
                      key={session.id}
                      id={session.id}
                      primary={name}
                      secondary={session.last_message_text || "No preview"}
                      isSelected={isSelected}
                      onClick={() => onSelectSession(session.id)}
                      avatar={
                        <span className="font-mono font-bold text-xs">
                          {initials}
                        </span>
                      }
                      badge={
                        session.unread_count > 0
                          ? { status: "new", label: `${session.unread_count} new` }
                          : undefined
                      }
                      value={new Date(session.last_message_at).toLocaleTimeString(
                        [],
                        { hour: "2-digit", minute: "2-digit" }
                      )}
                    />
                  );
                })
              )}
            </div>
          </InversePanel>
        </div>

        {/* Center Column: Chat Message Thread (5 cols at 2xl, 8 cols on lg) */}
        <div className="lg:col-span-8 2xl:col-span-5 rounded-[1.75rem] bg-[#11131A] border border-white/[0.08] flex flex-col justify-between h-[750px] overflow-hidden shadow-sm">
          {activeSession ? (
            <>
              {/* Thread Header */}
              <div className="p-5 border-b border-white/[0.08] flex items-center justify-between gap-4 bg-[#181B24]/40">
                <div className="min-w-0">
                  <h3 className="text-admin-h3 text-[#F4EFE6] font-semibold truncate">
                    {user?.name || "Visitor Lead"}
                  </h3>
                  <p className="text-admin-meta font-mono text-xs text-[#F4EFE6]/50 truncate mt-0.5">
                    Session: {activeSession.id.slice(0, 16)}...
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onToggleTakeover(
                        activeSession.id,
                        activeSession.is_human_takeover
                      )
                    }
                    className={`px-3.5 py-1.5 rounded-full text-admin-meta font-semibold cursor-pointer transition-colors ${
                      activeSession.is_human_takeover
                        ? "bg-[#FF6A1F] text-white"
                        : "bg-white/10 text-[#F4EFE6]/70 hover:text-white"
                    }`}
                  >
                    {activeSession.is_human_takeover
                      ? "Human Takeover ON"
                      : "Bot Automated"}
                  </button>
                </div>
              </div>

              {/* Message Bubbles Viewport */}
              <div className="flex-1 p-5 overflow-y-auto space-y-3.5">
                {messages.length === 0 ? (
                  <div className="py-20 text-center text-[#F4EFE6]/40 text-admin-meta">
                    No messages recorded in this session.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isProducer =
                      msg.sender_type === "admin" || msg.sender_type === "bot";

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isProducer ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-[1.25rem] px-5 py-3 text-admin-body shadow-sm leading-relaxed ${
                            isProducer
                              ? "bg-[#F4EFE6] text-[#07080C] font-medium rounded-tr-sm"
                              : "bg-[#181B24] text-[#F4EFE6] border border-white/[0.08] rounded-tl-sm"
                          }`}
                        >
                          <p>{msg.message_text}</p>
                        </div>
                        <span className="text-[10px] font-mono text-[#F4EFE6]/40 mt-1 px-1">
                          {msg.sender_type.toUpperCase()} ·{" "}
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Message Composer */}
              <form
                onSubmit={onSendReply}
                className="p-4 border-t border-white/[0.08] bg-[#181B24]/40 flex items-center gap-3"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => onReplyTextChange(e.target.value)}
                  placeholder="Reply as Studio Producer..."
                  className="flex-1 h-[3.25rem] rounded-full bg-[#181B24] border border-white/[0.08] px-5 text-admin-body text-[#F4EFE6] placeholder:text-[#F4EFE6]/40 focus:outline-none focus:border-[#FF6A1F]"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  aria-label="Send reply"
                  className="w-[3.25rem] h-[3.25rem] rounded-full bg-gradient-to-r from-[#FF6A1F] to-[#E8332A] text-white flex items-center justify-center shrink-0 shadow-md hover:brightness-110 disabled:opacity-40 cursor-pointer transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </>
          ) : (
            <div className="py-24 text-center text-[#F4EFE6]/40">
              No chat selected.
            </div>
          )}
        </div>

        {/* Right Column: Visitor Lead Info (3 cols at 2xl, stacks on smaller) */}
        <div className="hidden 2xl:block 2xl:col-span-3 space-y-4">
          {activeSession ? (
            <div className="rounded-[1.75rem] bg-[#11131A] border border-white/[0.08] p-6 space-y-5">
              <div>
                <p className="text-admin-eyebrow text-[#FF6A1F] font-mono mb-1">
                  LEAD TELEMETRY
                </p>
                <h3 className="text-admin-h3 text-[#F4EFE6] font-semibold">
                  Visitor Profile
                </h3>
              </div>

              <div className="space-y-3">
                <SubTile
                  label="Contact Name"
                  value={user?.name || "Anonymous Lead"}
                />
                <SubTile
                  label="Email"
                  value={
                    <span className="text-xs font-mono">
                      {user?.email || activeSession.email || "Not shared"}
                    </span>
                  }
                />
                <SubTile
                  label="Phone"
                  value={user?.phone || "Not shared"}
                />
                <SubTile
                  label="Production Tier"
                  value={activeSession.production_grade || "Commercial"}
                />
                <SubTile
                  label="Budget"
                  value={activeSession.budget || "Unspecified"}
                />
              </div>

              {activeSession.requirements_brief && (
                <div className="rounded-xl bg-[#181B24] border border-white/[0.08] p-4 space-y-1.5">
                  <p className="text-admin-meta text-[#FF6A1F] font-mono uppercase text-[11px]">
                    Session Intake Brief
                  </p>
                  <p className="text-admin-body text-xs text-[#F4EFE6]/80 italic">
                    "{activeSession.requirements_brief}"
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
