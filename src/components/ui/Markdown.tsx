/**
 * Renders untrusted Markdown safely:
 *  - raw HTML is never rendered (react-markdown default; no rehype-raw)
 *  - rehype-sanitize applies GitHub's allowlist as defense in depth
 *  - links are limited to http(s)/mailto/relative and open externally with noopener
 *  - remote images are NOT auto-loaded (privacy); they render as links
 *  - the world's old working names (Primus, Primal) are shown as Ilyr / Ilyrian
 */
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { safeHref } from "@/lib/contract/safety";
import { renameWorld } from "@/lib/domain/world-name";

export function Markdown({ children }: { children: string | null | undefined }) {
  if (!children?.trim()) return null;
  return (
    <div className="prose-tide">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        urlTransform={(url) => safeHref(url) ?? ""}
        components={{
          a: ({ href, children: c }) => {
            const safe = safeHref(href);
            if (!safe) return <span>{c}</span>;
            const external = /^https?:/i.test(safe);
            return (
              <a href={safe} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>
                {c}
                {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
              </a>
            );
          },
          img: ({ src, alt }) => {
            const safe = typeof src === "string" ? safeHref(src) : null;
            return safe ? (
              <a href={safe} target="_blank" rel="noopener noreferrer nofollow">
                Image: {alt || "untitled"} (external, not loaded automatically)
              </a>
            ) : (
              <span>[image: {alt || "untitled"}]</span>
            );
          },
        }}
      >
        {renameWorld(children)}
      </ReactMarkdown>
    </div>
  );
}
