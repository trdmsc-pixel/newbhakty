import React, { useEffect, useState } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ExternalLink, FilePen, Mail, MailCheck } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";
import { EmailThread, gmailDraftUrl, gmailThreadUrl } from "../InboxContext";

export const ProjectEmailsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { supabaseSyncStatus } = useStudioOS();
  const [threads, setThreads] = useState<EmailThread[] | null>(null);

  useEffect(() => {
    let active = true;
    if (supabaseSyncStatus !== "synced" || !supabase) {
      setThreads([]);
      return;
    }
    supabase
      .from("studio_email_threads")
      .select("id, gmail_account, thread_id, subject, client_id, project_id, last_from, last_message_at, last_sender_email, last_sender_name, needs_reply, draft_id, draft_message_id, summary, reply_owed_task_id, message_count")
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("last_message_at", { ascending: false })
      .limit(50)
      .then(({ data }) => active && setThreads((data || []) as EmailThread[]));
    return () => {
      active = false;
    };
  }, [projectId, supabaseSyncStatus]);

  if (threads === null) {
    return <div className="sos-card p-6 text-[13px]" style={{ color: "var(--sos-text-3)" }}>Loading emails…</div>;
  }

  if (!threads.length) {
    return (
      <div className="sos-card p-8 text-center space-y-2">
        <Mail className="w-5 h-5 mx-auto" style={{ color: "var(--sos-text-3)" }} />
        <p className="text-[14px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
          No linked email threads yet
        </p>
        <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
          Connect Gmail in Settings — threads are matched by the client’s email domain and the project code or title.
        </p>
      </div>
    );
  }

  return (
    <div className="sos-card p-2 md:p-3 space-y-1">
      {threads.map((t) => {
        const owed = t.needs_reply && t.last_from === "client";
        return (
          <div key={t.id} className="flex items-start gap-3 px-3 py-3 rounded-[16px] hover:bg-[var(--sos-surface-2)] transition-colors">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: "var(--sos-surface-2)", color: owed ? "#9A4A00" : "var(--sos-text-3)" }}
            >
              {owed ? <Mail className="w-4 h-4" strokeWidth={1.75} /> : <MailCheck className="w-4 h-4" strokeWidth={1.75} />}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>
                  {t.subject || "(no subject)"}
                </p>
                {owed && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#FFF3E0", color: "#9A4A00" }}>
                    Reply owed
                  </span>
                )}
              </div>
              <p className="text-[12px] truncate" style={{ color: "var(--sos-text-2)" }}>
                {t.summary || "—"}
              </p>
              <p className="text-[11px] truncate" style={{ color: "var(--sos-text-3)" }}>
                Last: {t.last_from === "studio" ? "Studio" : t.last_sender_name || t.last_sender_email || "Client"}
                {t.last_message_at ? ` · ${formatDistanceToNowStrict(parseISO(t.last_message_at), { addSuffix: true })}` : ""} · {t.gmail_account}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {t.draft_message_id && (
                <a
                  href={gmailDraftUrl(t.gmail_account, t.draft_message_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="sos-pill-btn h-8 px-3 text-[12px] font-semibold inline-flex items-center gap-1"
                  style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}
                >
                  <FilePen className="w-3.5 h-3.5" /> Open draft
                </a>
              )}
              <a
                href={gmailThreadUrl(t.gmail_account, t.thread_id)}
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center border"
                style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
                aria-label="Open in Gmail"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};
