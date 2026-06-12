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
      const next = currentUrl.searchParams.get("next");

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

      if (next === "verify-email") {
        const { error: verificationError } = await supabase.auth.updateUser({
          data: { purcar_email_verified: true },
        });
        if (verificationError) {
          setMessage(verificationError.message);
          return;
        }
      }

      await supabase.from("app_audit_logs").insert({
        actor_id: data.session.user.id,
        event: next === "verify-email" ? "auth.email_verified" : "auth.callback",
        metadata: { surface: "purcar.me" },
      });

      setMessage(
        next === "verify-email"
          ? "Email verified. Your weekly quota is now 150,000 tokens."
          : "Authentication complete.",
      );
      window.setTimeout(() => {
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
