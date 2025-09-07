// src/flow/nodeTypes.jsx
import React from "react";
import { Handle, Position } from "reactflow";

const BaseNode = ({ title, children }) => (
  <div style={{
    background: "#fff", border: "1px solid #E4E8EE", borderRadius: 10, minWidth: 220, boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
  }}>
    <div style={{ padding: 8, fontWeight: 600 }}>{title}</div>
    <div style={{ padding: 8, color: "#444", fontSize: 13 }}>{children}</div>
    <Handle type="target" position={Position.Left} style={{ background: "#999" }} />
    <Handle type="source" position={Position.Right} style={{ background: "#999" }} />
  </div>
);

export const UserQueryNode = ({ data }) => (
  <BaseNode title="User Query">
    Entry point
  </BaseNode>
);

export const KnowledgeBaseNode = ({ data }) => (
  <BaseNode title="KnowledgeBase">
    {data?.kbName || "No KB selected"}
  </BaseNode>
);

export const LLMEngineNode = ({ data }) => (
  <BaseNode title="LLM Engine">
    {data?.provider || "openai"} · {data?.model || "default"}
  </BaseNode>
);

export const OutputNode = ({ data }) => (
  <BaseNode title="Output">
    Chat UI
  </BaseNode>
);

export const nodeTypes = {
  userQuery: UserQueryNode,
  knowledgeBase: KnowledgeBaseNode,
  llmEngine: LLMEngineNode,
  output: OutputNode,
};
