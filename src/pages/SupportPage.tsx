import { useEffect, useState } from "react";
import { ArrowLeft, LogIn, Send } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type SupportThread = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type SupportMessage = {
  id: string;
  thread_id: string;
  sender_role: "user" | "admin";
  body: string;
  created_at: string;
};

export function SupportPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [status, setStatus] = useState("");
  const [schemaMissing, setSchemaMissing] = useState(false);

  function schemaMessage(error?: { message?: string } | null) {
    if (
      error?.message?.includes("schema cache") ||
      error?.message?.includes("support_threads") ||
      error?.message?.includes("support_messages")
    ) {
      setSchemaMissing(true);
      return "The support tables do not exist in Supabase. Run the SQL from supabase/schema.sql, then reload the page.";
    }

    return error?.message || "Could not load support.";
  }

  useEffect(() => {
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      if (data.user?.id) {
        void loadInbox(data.user.id);
      } else {
        setStatus("Sign in to send and view support messages.");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id ?? null;
      setUserId(id);
      if (id) {
        void loadInbox(id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadInbox(ownerId: string) {
    if (!supabase) {
      return;
    }

    const { data: threadRows, error: threadError } = await supabase
      .from("support_threads")
      .select("id,subject,status,created_at,updated_at")
      .eq("user_id", ownerId)
      .order("updated_at", { ascending: false });

    if (threadError) {
      setStatus(schemaMessage(threadError));
      return;
    }

    setSchemaMissing(false);
    setThreads((threadRows || []) as SupportThread[]);

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
      setMessages((messageRows || []) as SupportMessage[]);
    }
  }

  async function sendSupportMessage() {
    if (!supabase || !userId) {
      setStatus("You must be signed in to send a message.");
      return;
    }

    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject || !trimmedBody) {
      setStatus("Add both a subject and a message.");
      return;
    }

    const { data: thread, error: threadError } = await supabase
      .from("support_threads")
      .insert({ user_id: userId, subject: trimmedSubject })
      .select("id")
      .single();

    if (threadError || !thread) {
      setStatus(schemaMessage(threadError));
      return;
    }

    const { error: messageError } = await supabase.from("support_messages").insert({
      thread_id: thread.id,
      sender_id: userId,
      sender_role: "user",
      body: trimmedBody,
    });

    if (messageError) {
      setStatus(schemaMessage(messageError));
      return;
    }

    await supabase.from("app_audit_logs").insert({
      actor_id: userId,
      event: "support.create",
      metadata: { thread_id: thread.id },
    });

    setSubject("");
    setBody("");
    setStatus("Message sent to support.");
    await loadInbox(userId);
  }

  return (
    <main className="support-shell">
      <a className="support-back" href="/">
        <ArrowLeft size={16} />
        PURCAR
      </a>
      <section className="support-panel">
        <div>
          <span>Support</span>
          <h1>Contact ReformOne</h1>
          <p>
            Send a message to the team. Admin replies appear here in your
            account inbox.
          </p>
        </div>
        <div className="support-form">
          {!isSupabaseConfigured && (
            <p className="support-status support-status--warning">
              Supabase is not configured in `.env.local`.
            </p>
          )}
          {!userId && (
            <p className="support-status">
              Support requires an account. Go back to PURCAR and use Sign in.
            </p>
          )}
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject"
            disabled={!userId}
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write your message..."
            disabled={!userId}
          />
          <button disabled={!userId || schemaMissing} onClick={sendSupportMessage} type="button">
            <Send size={16} />
            Send
          </button>
          {!userId && (
            <a className="support-login-link" href="/">
              <LogIn size={15} />
              Sign in
            </a>
          )}
          {status && (
            <p className={schemaMissing ? "support-status support-status--warning" : "support-status"}>
              {status}
            </p>
          )}
          {schemaMissing && (
            <div className="support-schema-help">
              <strong>Fix rapid in Supabase SQL Editor:</strong>
              <code>run the full supabase/schema.sql file</code>
              <small>
                Then reload the page. For admin access, set `role = 'admin'`
                in the `profiles` table.
              </small>
            </div>
          )}
        </div>
      </section>
      <section className="support-inbox">
        <h2>Your messages</h2>
        {!threads.length && (
          <article className="support-empty">
            <p>No messages yet.</p>
          </article>
        )}
        {threads.map((thread) => (
          <article key={thread.id}>
            <header>
              <strong>{thread.subject}</strong>
              <span>{thread.status}</span>
            </header>
            <div>
              {messages
                .filter((message) => message.thread_id === thread.id)
                .map((message) => (
                  <p
                    className={
                      message.sender_role === "admin" ? "is-admin" : undefined
                    }
                    key={message.id}
                  >
                    <b>{message.sender_role === "admin" ? "ADMIN" : "You"}</b>
                    {message.body}
                  </p>
                ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
