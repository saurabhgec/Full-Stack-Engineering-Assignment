// src/components/Library.jsx
import React from "react";

const types = [
  { type: "userQuery", label: "User Query" },
  { type: "knowledgeBase", label: "KnowledgeBase" },
  { type: "llmEngine", label: "LLM Engine" },
  { type: "output", label: "Output" },
];

export default function Sidebar() {
  const onDragStart = (ev, nodeType) => {
    ev.dataTransfer.setData("application/reactflow", nodeType);
    ev.dataTransfer.effectAllowed = "move";
  };

  return (
    <div style={{ padding: 12 }}>
      <h4>Components</h4>
      {types.map((t) => (
        <div key={t.type}
             draggable
             onDragStart={(e) => onDragStart(e, t.type)}
             style={{
               padding: "8px 10px", margin: "8px 0", borderRadius: 8,
               border: "1px solid #e6e6e6", cursor: "grab", background: "#fff"
             }}>
          {t.label}
        </div>
      ))}
    </div>
  );
}
