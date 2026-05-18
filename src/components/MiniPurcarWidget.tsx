import { useState } from "react";
import { Send } from "lucide-react";
import { createPurcarReply } from "../lib/purcarBrain";

export function MiniPurcarWidget() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi. I'm PURCAR. I can explain ReformOne or answer questions about AI.",
    },
  ]);
  const [input, setInput] = useState("");

  function submit() {
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    setMessages((current) => [
      ...current,
      { role: "user", content: trimmed },
      { role: "assistant", content: createPurcarReply(trimmed) },
    ]);
    setInput("");
  }

  return (
    <div className="mini-chat">
      <div className="mini-chat__messages">
        {messages.map((message, index) => (
          <div className={`mini-chat__bubble mini-chat__bubble--${message.role}`} key={index}>
            {message.content}
          </div>
        ))}
      </div>
      <div className="mini-chat__composer">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submit();
            }
          }}
          placeholder="Ask PURCAR"
        />
        <button className="icon-button icon-button--dark" onClick={submit} title="Send">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
