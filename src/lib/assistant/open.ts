export const OPEN_ASSISTANT = "rustflow:assistant-open";
export function openAssistant(opener: HTMLElement) {
  window.dispatchEvent(new CustomEvent(OPEN_ASSISTANT, { detail: opener }));
}
