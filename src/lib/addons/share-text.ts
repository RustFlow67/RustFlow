export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function shareText(data: ShareData & { text: string }): Promise<"done" | "cancelled" | "manual"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return "done";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  return await copyText([data.text, data.url].filter(Boolean).join("\n")) ? "done" : "manual";
}
