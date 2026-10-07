import { Plain } from "@/components/shell/Plain";

export const metadata = { title: "No access" };

export default function ForbiddenPage() {
  return (
    <Plain title="This account has no access">
      <p>You are signed in, but your account is not a GM of this project. Ask the project owner to add you as a member.</p>
      <form action="/auth/signout" method="post">
        <button type="submit" className="rounded-md border border-border-strong px-3 py-2 text-text">
          Sign out
        </button>
      </form>
    </Plain>
  );
}
