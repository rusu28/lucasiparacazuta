import type { ChatSession } from "./types";

export function toJsonl(sessions: ChatSession[]): string {
  return sessions
    .flatMap((session) =>
      session.messages.map((message, index) =>
        JSON.stringify({
          session_id: session.id,
          session_title: session.title,
          turn_index: index,
          role: message.role,
          content: message.content,
          created_at: message.createdAt,
        }),
      ),
    )
    .join("\n");
}

export function toMarkdown(sessions: ChatSession[]): string {
  return sessions
    .map((session) => {
      const messages = session.messages
        .map((message) => `### ${message.role}\n\n${message.content}`)
        .join("\n\n");
      return `# ${session.title}\n\n${messages}`;
    })
    .join("\n\n---\n\n");
}

export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
