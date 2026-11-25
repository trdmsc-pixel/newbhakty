/**
 * Parse a WhatsApp "Export chat" .txt into compact lines for AI review.
 * Supports Android ("12/11/2026, 10:32 - Name: msg") and iOS ("[12/11/26, 10:32:15 AM] Name: msg").
 */
export interface WaMessage {
  date: string;
  author: string;
  text: string;
}

const ANDROID = /^(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap]\.?[Mm]\.?)?)\s+-\s+([^:]+?):\s([\s\S]*)$/;
const IOS = /^‎?\[(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap]\.?[Mm]\.?)?)\]\s+([^:]+?):\s([\s\S]*)$/;
const SKIP = /(<Media omitted>|image omitted|video omitted|sticker omitted|audio omitted|GIF omitted|This message was deleted|Messages and calls are end-to-end encrypted|document omitted)/i;

export function parseWhatsAppExport(raw: string): WaMessage[] {
  const out: WaMessage[] = [];
  for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
    const m = line.match(IOS) || line.match(ANDROID);
    if (m) {
      out.push({ date: m[1], author: m[3].trim(), text: m[4].trim() });
    } else if (out.length && line.trim()) {
      out[out.length - 1].text += `\n${line.trim()}`;
    }
  }
  return out.filter((m) => m.text && !SKIP.test(m.text));
}

/** Most recent messages, trimmed to a character budget. */
export function waToPrompt(messages: WaMessage[], maxChars = 20000): string {
  const lines: string[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const l = `[${messages[i].date}] ${messages[i].author}: ${messages[i].text}`;
    if (total + l.length > maxChars) break;
    lines.unshift(l);
    total += l.length + 1;
  }
  return lines.join("\n");
}
