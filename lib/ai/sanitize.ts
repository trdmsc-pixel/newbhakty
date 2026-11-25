/**
 * Text hygiene before anything is sent to an AI provider.
 * - strips quoted thread history and signatures
 * - redacts money amounts when the client/project is confidential
 */

const QUOTE_HEADER_PATTERNS: RegExp[] = [
  /^On .{3,200}wrote:\s*$/im, // Gmail / Apple Mail
  /^-{2,}\s*Original Message\s*-{2,}/im,
  /^-{2,}\s*Forwarded message\s*-{2,}/im,
  /^From:\s.+\n(?:Sent|Date):\s.+/im, // Outlook
  /^_{10,}\s*$/m,
  /^Le .{3,200}a écrit\s*:\s*$/im,
  /^El .{3,200}escribió:\s*$/im,
];

const SIGNATURE_PATTERNS: RegExp[] = [
  /^--\s*$/m,
  /^Sent from my (iPhone|iPad|Android|mobile|Samsung|Galaxy|phone).*$/im,
  /^Get Outlook for .*$/im,
  /^(Best|Kind|Warm)?\s*(regards|wishes)[,!.]*\s*$/im,
  /^(Thanks|Thank you|Cheers|Sincerely|Warmly|Hare Krishna)[,!.]*\s*$/im,
  /^Disclaimer:.*/im,
  /^This (e-?mail|message) (and any attachments )?(is|may be) confidential.*/im,
];

export function stripQuotedHistory(text: string): string {
  let out = text.replace(/\r\n/g, "\n");
  let cut = out.length;
  for (const re of QUOTE_HEADER_PATTERNS) {
    const m = re.exec(out);
    if (m && m.index < cut) cut = m.index;
  }
  out = out.slice(0, cut);
  // Drop "> quoted" lines
  out = out
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n");
  return out;
}

export function stripSignature(text: string): string {
  let cut = text.length;
  for (const re of SIGNATURE_PATTERNS) {
    const m = re.exec(text);
    // Only treat as a signature if it is in the bottom 60% of the message
    if (m && m.index > text.length * 0.25 && m.index < cut) cut = m.index;
  }
  return text.slice(0, cut);
}

export function cleanEmailBody(text: string, maxChars = 6000): string {
  const stripped = stripSignature(stripQuotedHistory(text || ""));
  return stripped
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars);
}

const MONEY_PATTERNS: RegExp[] = [
  /(?:₹|rs\.?|inr|usd|eur|us\$|\$|€|£)\s?\d[\d,]*(?:\.\d+)?\s?(?:k|lakh|lakhs|lac|cr|crore|crores|million|mn|m)?/gi,
  /\d[\d,]*(?:\.\d+)?\s?(?:k|lakh|lakhs|lac|cr|crore|crores|million)?\s?(?:₹|rs\.?|inr|usd|eur|dollars|rupees|euros)\b/gi,
  /\b\d+(?:\.\d+)?\s?(?:lakh|lakhs|lac|crore|crores|cr)\b/gi,
];

/** Remove fee-like amounts. Used for confidential clients/projects before any AI call. */
export function redactAmounts(text: string, extraNumbers: Array<number | null | undefined> = []): string {
  let out = text;
  for (const re of MONEY_PATTERNS) out = out.replace(re, "[amount redacted]");
  for (const n of extraNumbers) {
    if (!n || !Number.isFinite(n)) continue;
    const plain = String(Math.round(n));
    const withCommasIN = Math.round(n).toLocaleString("en-IN");
    const withCommasUS = Math.round(n).toLocaleString("en-US");
    for (const v of new Set([plain, withCommasIN, withCommasUS])) {
      if (v.length < 4) continue;
      out = out.split(v).join("[amount redacted]");
    }
  }
  return out;
}

export function wordLimit(text: string, maxWords: number): string {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? words.join(" ") : words.slice(0, maxWords).join(" ");
}
