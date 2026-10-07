import { redirect } from "next/navigation";
import { Plain } from "@/components/shell/Plain";
import { resolveMode } from "@/lib/server/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup required" };

export default function SetupPage() {
  const info = resolveMode();
  if (info.mode !== "setup-required") redirect("/");
  return (
    <Plain title="Setup required">
      <p className="text-text">{info.reason}</p>
      {info.missing.length ? (
        <div>
          <p>Missing or invalid settings (names only):</p>
          <ul className="mt-1 list-disc pl-6 font-mono text-sm text-text">
            {info.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p>The dashboard stays closed until it can reach its database. It never falls back to demo data.</p>
      <ol className="list-decimal space-y-1 pl-6">
        <li>
          In Vercel, open this project → Settings → Environment Variables and check that the Supabase variables exist for the environment you are viewing (Production or Preview). The Vercel ↔ Supabase integration adds them for you.
        </li>
        <li>Redeploy. Variables are only picked up by a new deployment.</li>
        <li>
          Run the database setup once (GitHub Action “Supabase migrations”, or <code className="text-text">docs/SUPABASE_SETUP.md</code>).
        </li>
      </ol>
    </Plain>
  );
}
