/**
 * Read-along for a narration: the words of a rendered text are wrapped in
 * spans, matched to the narration's timed words, and lit one by one as they
 * are spoken.
 *
 * The timings come from a transcript of the recording, which differs a
 * little from the page (names misheard, punctuation, the odd word changed),
 * so the two word lists are aligned (edit distance, as for a diff) and any
 * page word without a match takes its time from its neighbours.
 */

/** [start, end, word] in seconds, from the transcript. */
export type TimedWord = [number, number, string];

export interface ReadAlong {
  words: HTMLElement[];
  /** Start time of each page word, ascending. */
  starts: number[];
  ends: number[];
  /** Restore the text as it was. */
  undo: () => void;
}

const norm = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Wrap every word inside `root` in <span class="rw">. */
function wrapWords(root: HTMLElement): { words: HTMLElement[]; undo: () => void } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue && /\S/.test(n.nodeValue)) nodes.push(n as Text);
  const words: HTMLElement[] = [];
  const swaps: { frag: Node[]; text: Text }[] = [];
  for (const text of nodes) {
    const parts = text.nodeValue!.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    const made: Node[] = [];
    for (const p of parts) {
      if (!p) continue;
      // Spaces stay plain text; anything else (a dash too) is a word to light.
      if (/^\s+$/.test(p)) {
        const t = document.createTextNode(p);
        frag.appendChild(t);
        made.push(t);
      } else {
        const s = document.createElement("span");
        s.className = "rw";
        s.textContent = p;
        frag.appendChild(s);
        made.push(s);
        words.push(s);
      }
    }
    swaps.push({ frag: made, text });
    text.replaceWith(frag);
  }
  const undo = () => {
    for (const { frag, text } of swaps) {
      const first = frag[0];
      if (!first?.parentNode) continue;
      first.parentNode.insertBefore(text, first);
      for (const n of frag) n.parentNode?.removeChild(n);
    }
  };
  return { words, undo };
}

/** Pair page words with transcript words (Needleman–Wunsch, unit costs). */
function align(page: string[], heard: string[]): number[] {
  const n = page.length;
  const m = heard.length;
  const W = m + 1;
  const cost = new Uint32Array((n + 1) * W);
  for (let i = 0; i <= n; i++) cost[i * W] = i;
  for (let j = 0; j <= m; j++) cost[j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = page[i - 1] === heard[j - 1] ? 0 : 1;
      cost[i * W + j] = Math.min(cost[(i - 1) * W + j - 1]! + same, cost[(i - 1) * W + j]! + 1, cost[i * W + j - 1]! + 1);
    }
  }
  // Walk back: page word i -> transcript word j (or -1).
  const match = new Array<number>(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const here = cost[i * W + j]!;
    const same = page[i - 1] === heard[j - 1] ? 0 : 1;
    if (here === cost[(i - 1) * W + j - 1]! + same) {
      match[i - 1] = j - 1; // a match, or a substitution (a misheard word): still the same moment
      i--;
      j--;
    } else if (here === cost[(i - 1) * W + j]! + 1) i--;
    else j--;
  }
  return match;
}

/** Start and end times for each page word, from the transcript's timed words. */
export function timeWords(page: string[], timed: TimedWord[]): { starts: number[]; ends: number[] } {
  const match = align(
    page.map(norm),
    timed.map((t) => norm(t[2])),
  );
  const starts = new Array<number>(page.length).fill(NaN);
  const ends = new Array<number>(page.length).fill(NaN);
  match.forEach((j, i) => {
    if (j >= 0) {
      starts[i] = timed[j]![0];
      ends[i] = timed[j]![1];
    }
  });
  // Unmatched words: spread them evenly between their timed neighbours.
  const last = timed.at(-1)?.[1] ?? 0;
  for (let i = 0; i < page.length; i++) {
    if (!Number.isNaN(starts[i])) continue;
    let k = i;
    while (k < page.length && Number.isNaN(starts[k])) k++;
    const from = i > 0 ? ends[i - 1]! : 0;
    const to = k < page.length ? starts[k]! : last;
    const step = (to - from) / (k - i + 1);
    for (let x = i; x < k; x++) {
      starts[x] = from + step * (x - i + 0.5);
      ends[x] = starts[x]! + step * 0.8;
    }
    i = k - 1;
  }
  // Keep the starts ascending, so a binary search finds the word.
  for (let i = 1; i < starts.length; i++) if (starts[i]! < starts[i - 1]!) starts[i] = starts[i - 1]!;
  return { starts, ends };
}

export function readAlong(root: HTMLElement, timed: TimedWord[]): ReadAlong {
  const { words, undo } = wrapWords(root);
  const { starts, ends } = timeWords(
    words.map((w) => w.textContent ?? ""),
    timed,
  );
  return { words, starts, ends, undo };
}

/** The word being spoken at time t (the last one started), or -1. */
export function wordAt(r: { starts: number[] }, t: number): number {
  let lo = 0;
  let hi = r.starts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (r.starts[mid]! <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}
