/**
 * Renders untrusted Markdown safely:
 *  - raw HTML is never rendered (react-markdown default; no rehype-raw)
 *  - rehype-sanitize applies GitHub's allowlist as defense in depth
 *  - links are limited to http(s)/mailto/relative and open externally with noopener
 *  - remote images are NOT auto-loaded (privacy); they render as links
 *  - the world's name is withheld (lib/domain/redaction), drawn as a glyph cipher
 */
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { WorldName } from "@/components/tide/WorldName";
import { safeHref } from "@/lib/contract/safety";
import { redactPlain, splitRedacted, worldNameRevealed } from "@/lib/domain/redaction";

type MdNode = { type: string; value?: string; children?: MdNode[]; data?: Record<string, unknown> };

/** Splits text nodes around withheld terms, marking each as <span class="tide-redacted">. */
function remarkRedact() {
  const walk = (node: MdNode) => {
    if (!node.children) return;
    node.children = node.children.flatMap((child) => {
      if (child.type === "text" && child.value) {
        const pieces = splitRedacted(child.value);
        if (pieces.length === 1 && typeof pieces[0] === "string") return [child];
        return pieces.map((p): MdNode =>
          typeof p === "string"
            ? { type: "text", value: p }
            : { type: "redacted", children: [], data: { hName: "span", hProperties: { className: ["tide-redacted"] } } },
        );
      }
      // Code can't hold the cipher; there the name becomes "[redacted]".
      if ((child.type === "code" || child.type === "inlineCode") && child.value) return [{ ...child, value: redactPlain(child.value) }];
      walk(child);
      return [child];
    });
  };
  return (tree: MdNode) => walk(tree);
}

const SCHEMA = { ...defaultSchema, attributes: { ...defaultSchema.attributes, span: [...(defaultSchema.attributes?.span ?? []), ["className", "tide-redacted"]] } };

export function Markdown({ children }: { children: string | null | undefined }) {
  if (!children?.trim()) return null;
  return (
    <div className="prose-tide">
      <ReactMarkdown
        remarkPlugins={worldNameRevealed() ? [remarkGfm] : [remarkGfm, remarkRedact]}
        rehypePlugins={[[rehypeSanitize, SCHEMA]]}
        urlTransform={(url) => safeHref(url) ?? ""}
        components={{
          span: ({ className, children: c }) => (className?.split(" ").includes("tide-redacted") ? <WorldName /> : <span className={className}>{c}</span>),
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
        {children}
      </ReactMarkdown>
    </div>
  );
}
