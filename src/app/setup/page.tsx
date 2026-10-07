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
      <p>The dashboard refuses to show data until it is configured. It does not fall back to demo data.</p>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          Try it locally with seeded demo data: <code className="text-text">npm run demo</code>
        </li>
        <li>
          Connect Supabase: set <code className="text-text">TIDE_DATA_MODE=supabase</code> plus the variables in <code className="text-text">.env.example</code>, then follow <code className="text-text">docs/SUPABASE_SETUP.md</code>.
        </li>
      </ul>
    </Plain>
  );
}
