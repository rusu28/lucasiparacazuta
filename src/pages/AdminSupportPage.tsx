import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Send, ShieldCheck } from "lucide-react";
import { isHardcodedAdminEmail } from "../lib/adminAccess";
import { supabase } from "../lib/supabase";

type ThreadRow = {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_role: "user" | "admin";
  body: string;
  created_at: string;
};

type AuditLogRow = {
  id: string;
  actor_id: string | null;
  event: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function AdminSupportPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("Checking access...");
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || threads[0],
    [activeThreadId, threads],
  );

  function schemaMessage(error?: { message?: string } | null) {
    if (
      error?.message?.includes("schema cache") ||
      error?.message?.includes("support_threads") ||
      error?.message?.includes("support_messages") ||
      error?.message?.includes("profiles")
    ) {
      return "The support tables do not exist in Supabase. Run the SQL from supabase/schema.sql.";
    }

    return error?.message || "Could not load admin support.";
  }

  useEffect(() => {
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }
    const client = supabase;

    client.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id;
      setUserId(id ?? null);

      if (!id) {
        setStatus("You must be signed in.");
        return;
      }

      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role")
        .eq("id", id)
        .maybeSingle();

      if (profileError) {
        setStatus(schemaMessage(profileError));
        return;
      }

      const allowed = profile?.role === "admin" || isHardcodedAdminEmail(data.user?.email);
      setIsAdmin(allowed);
      setStatus(allowed ? "Admin inbox" : "You do not have admin access.");
      if (allowed) {
        await loadAdminInbox();
      }
    });
  }, []);

  async function loadAdminInbox() {
    if (!supabase) {
      return;
    }

    const { data: threadRows, error: threadError } = await supabase
      .from("support_threads")
      .select("id,user_id,subject,status,created_at,updated_at")
      .order("updated_at", { ascending: false });

    if (threadError) {
      setStatus(schemaMessage(threadError));
      return;
    }

    setThreads((threadRows || []) as ThreadRow[]);
    setActiveThreadId((current) => current || threadRows?.[0]?.id || "");

    if (threadRows?.length) {
      const { data: messageRows, error: messageError } = await supabase
        .from("support_messages")
        .select("id,thread_id,sender_role,body,created_at")
        .in(
          "thread_id",
          threadRows.map((thread) => thread.id),
        )
        .order("created_at", { ascending: true });
      if (messageError) {
        setStatus(schemaMessage(messageError));
        return;
      }
      setMessages((messageRows || []) as MessageRow[]);
    }

    const { data: logs } = await supabase
      .from("app_audit_logs")
      .select("id,actor_id,event,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setAuditLogs((logs || []) as AuditLogRow[]);
  }

  async function sendReply() {
    if (!supabase || !userId || !activeThread || !reply.trim()) {
      return;
    }

    const { error } = await supabase.from("support_messages").insert({
      thread_id: activeThread.id,
      sender_id: userId,
      sender_role: "admin",
      body: reply.trim(),
    });

    if (error) {
      setStatus(schemaMessage(error));
      return;
    }

    await supabase
      .from("support_threads")
      .update({ status: "answered", updated_at: new Date().toISOString() })
      .eq("id", activeThread.id);
    await supabase.from("app_audit_logs").insert({
      actor_id: userId,
      event: "support.reply",
      metadata: { thread_id: activeThread.id },
    });

    setReply("");
    await loadAdminInbox();
  }

  return (
    <main className="support-shell support-shell--admin">
      <a className="support-back" href="/">
        <ArrowLeft size={16} />
        PURCAR
      </a>
      <section className="support-panel">
        <div>
          <span>Admin</span>
          <h1>Support inbox</h1>
          <p>
            Admins reply under the ADMIN name. Users see the conversation in
            their support page.
          </p>
        </div>
        <div className="support-admin-state">
          <ShieldCheck size={22} />
          {status}
        </div>
      </section>

      {isAdmin && (
        <section className="admin-inbox">
          <aside>
            {threads.map((thread) => (
              <button
                className={thread.id === activeThread?.id ? "is-active" : undefined}
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                type="button"
              >
                <strong>{thread.subject}</strong>
                <span>{thread.status}</span>
              </button>
            ))}
          </aside>
          <div className="admin-thread">
            {activeThread ? (
              <>
                <h2>{activeThread.subject}</h2>
                <div className="admin-thread__messages">
                  {messages
                    .filter((message) => message.thread_id === activeThread.id)
                    .map((message) => (
                      <p
                        className={
                          message.sender_role === "admin" ? "is-admin" : undefined
                        }
                        key={message.id}
                      >
                        <b>{message.sender_role === "admin" ? "ADMIN" : "User"}</b>
                        {message.body}
                      </p>
                    ))}
                </div>
                <div className="admin-reply">
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Admin reply..."
                  />
                  <button onClick={sendReply} type="button">
                    <Send size={16} />
                    Reply
                  </button>
                </div>
              </>
            ) : (
              <p>No messages yet.</p>
            )}
          </div>
        </section>
      )}
      {isAdmin && (
        <section className="support-inbox">
          <h2>Audit logs</h2>
          {auditLogs.map((log) => (
            <article key={log.id}>
              <header>
                <strong>{log.event}</strong>
                <span>{new Date(log.created_at).toLocaleString()}</span>
              </header>
              <p>
                <b>Actor</b>
                {log.actor_id || "system"}
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
