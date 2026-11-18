export const MAX_QUESTION = 400;
export const MAX_ANSWER = 8000;
export const CONTEXT_TURNS = 4;
export const CONTEXT_ANSWER = 2200;

export const truncateQuestion = (text: string) => Array.from(text).slice(0, MAX_QUESTION).join("");
export const isAdminCommand = (text: string) => /^\s*\/(?:admin|logout)(?=\s|$)/i.test(text);

export type AssistantEvent =
  | { type: "context"; entryId: string | null }
  | { type: "delta"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

/** Decode UTF-8 incrementally. A character or a line may cross transport chunks. */
export async function* streamLines(body: ReadableStream<Uint8Array>, limit = 65536): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let at: number;
      while ((at = buffer.indexOf("\n")) >= 0) {
        if (at > limit) throw new Error("Stream line too long");
        yield buffer.slice(0, at).replace(/\r$/, "");
        buffer = buffer.slice(at + 1);
      }
      if (buffer.length > limit) throw new Error("Stream line too long");
      if (done) {
        if (buffer) yield buffer.replace(/\r$/, "");
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
