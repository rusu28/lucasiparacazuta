import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function AuthCallback() {
  const [message, setMessage] = useState("Finalizing authentication...");

  useEffect(() => {
    async function completeAuth() {
      if (!supabase) {
        setMessage("Supabase is not configured.");
        return;
      }

      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(
            error.message.includes("captcha")
              ? "Captcha protection is still active in Supabase. Disable it from the dashboard."
              : error.message,
          );
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.user) {
        setMessage(error?.message || "No valid session found.");
        return;
      }

      await supabase.from("app_audit_logs").insert({
        actor_id: data.session.user.id,
        event: "auth.email_verified",
        metadata: { surface: "purcar.me" },
      });

      setMessage("Successfully verified on Purcar.me");
      window.setTimeout(() => {
        const next = currentUrl.searchParams.get("next");
        window.location.replace(next === "reset-password" ? "/?auth=reset-password" : "/");
      }, 900);
    }

    void completeAuth();
  }, []);

  return (
    <main className="auth-callback-shell">
      <section>
        <span>PURCAR.ME</span>
        <h1>{message}</h1>
        <p>Redirecting you to your account.</p>
      </section>
    </main>
  );
}
