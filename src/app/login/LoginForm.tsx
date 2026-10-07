"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

/** Email magic-link sign-in. Only the public URL and publishable key reach the browser. */
export function LoginForm({ url, publishableKey }: { url: string; publishableKey: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        const supabase = createBrowserClient(url, publishableKey);
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: true },
        });
        if (error) {
          setState("error");
          setMessage("Could not send a sign-in link. Check the address, or ask the project owner whether your account exists.");
        } else {
          setState("sent");
          setMessage("Check your email for a sign-in link.");
        }
      }}
    >
      <Field id="email" label="Email address">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" disabled={state === "sending"}>
        Send sign-in link
      </Button>
      <p role="status" className={state === "error" ? "text-danger" : "text-ok"}>
        {message}
      </p>
    </form>
  );
}
