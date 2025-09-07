// src/components/ChatModal.jsx
import React, { useState } from "react";
import useStore from "../store";
import axios from "axios";

export default function ChatModal() {
  const { chatOpen, setChatOpen, nodes, edges } = useStore();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]); // {role, text}

  if (!chatOpen) return null;

  const close = () => setChatOpen(false);

  const send = async () => {
    if (!query) return;
    const userMsg = { role: "user", text: query };
    setMessages((m) => m.concat(userMsg));
    setQuery("");
    // call backend
    try {
      const resp = await axios.post("/api/workflows/execute", { nodes, edges, query });
      if (resp.data.valid) {
        setMessages((m) => m.concat({ role: "assistant", text: resp.data.answer }));
      } else {
        setMessages((m) => m.concat({ role: "assistant", text: "Execution error: " + resp.data.message }));
      }
    } catch (err) {
      setMessages((m) => m.concat({ role: "assistant", text: "Server error" }));
      console.error(err);
    }
  };

  return (
    <div style={{
      position: "fixed", right: 20, bottom: 20, width: 420, height: 500, background: "#fff",
      border: "1px solid #E4E8EE", borderRadius: 12, display: "flex", flexDirection: "column", zIndex: 3000
    }}>
      <div style={{ padding: 10, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
        <strong>Chat with Stack</strong>
        <button onClick={close}>×</button>
      </div>

      <div style={{ flex: 1, padding: 10, overflowY: "auto" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, textAlign: m.role === "user" ? "right" : "left" }}>
            <div style={{
              display: "inline-block", padding: "8px 10px", borderRadius: 8,
              background: m.role === "user" ? "#E6FFE6" : "#f1f3f5"
            }}>{m.text}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: 10, borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1 }} placeholder="Ask a question..." />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
