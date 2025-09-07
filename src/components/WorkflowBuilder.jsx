// src/pages/WorkflowBuilder.jsx
import React, { useCallback, useMemo, useState } from "react";
import { buildWorkflow, runWorkflow } from "../api";

import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Handle,
  Position,
  MiniMap,
  Controls,
  Background,
} from "reactflow";
import "reactflow/dist/style.css";
import useStore from "../store";

/* ----------------- Node renderer ----------------- */
function CustomNode({ data }) {
  return (
    <div
      style={{
        padding: 10,
        border: "1px solid #333",
        borderRadius: 6,
        background: "#fff",
        minWidth: 120,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <strong style={{ display: "block", marginBottom: 6 }}>{data.label || "Node"}</strong>

      <div style={{ marginTop: 6 }}>
        {(data.fields || []).map((f, i) => (
          <div key={i} style={{ fontSize: 12, marginBottom: 6 }}>
            {f.type === "input" && (
              <input placeholder={f.placeholder} value={f.label} readOnly style={{ width: "100%" }} />
            )}
            {f.type === "dropdown" && (
              <select style={{ width: "100%" }}>
                {f.options?.map((opt, j) => (
                  <option key={j}>{opt}</option>
                ))}
              </select>
            )}
            {f.type === "fileUpload" && <input type="file" accept={f.accept} style={{ width: "100%" }} />}
            {f.type === "button" && <button style={{ width: "100%" }}>{f.label}</button>}
            {f.type === "header" && <h4 style={{ margin: 0 }}>{f.text}</h4>}
          </div>
        ))}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  userQuery: CustomNode,
  knowledgeBase: CustomNode,
  llmEngine: CustomNode,
  output: CustomNode,
};

/* ----------------- Factories ----------------- */
function makeField(type) {
  switch (type) {
    case "input":
      return { type: "input", label: "New Input", placeholder: "Enter value" };
    case "dropdown":
      return { type: "dropdown", label: "Dropdown", options: ["Option 1"] };
    case "fileUpload":
      return { type: "fileUpload", label: "Upload File", accept: ".pdf" };
    case "button":
      return { type: "button", label: "Click Me" };
    case "header":
      return { type: "header", text: "Header Text" };
    default:
      return { type: "text", text: "New Field" };
  }
}

function makeNode(type, position = { x: 250, y: 100 }) {
  return {
    id: `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type,
    position,
    data: { label: type, fields: [] },
  };
}

/* ----------------- Utility: client-side validation & compile ----------------- */
function clientValidateAndCompile(nodes, edges) {
  const res = { valid: true, errors: [], warnings: [], compiled: null };

  // quick maps
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const incoming = {};
  const outgoing = {};
  nodes.forEach((n) => {
    incoming[n.id] = [];
    outgoing[n.id] = [];
  });
  edges.forEach((e) => {
    if (incoming[e.target]) incoming[e.target].push(e.source);
    if (outgoing[e.source]) outgoing[e.source].push(e.target);
  });

  // presence checks
  const userQueryNodes = nodes.filter((n) => n.type === "userQuery");
  const outputNodes = nodes.filter((n) => n.type === "output");
  if (userQueryNodes.length === 0) {
    res.valid = false;
    res.errors.push("No UserQuery node found. Add one as the workflow entry point.");
  }
  if (outputNodes.length === 0) {
    res.valid = false;
    res.errors.push("No Output node found. Add one to receive results.");
  }

  // connectivity checks
  // nodes (except userQuery) should have incoming; nodes (except output) should have outgoing
  nodes.forEach((n) => {
    if (n.type !== "userQuery" && (!incoming[n.id] || incoming[n.id].length === 0)) {
      res.warnings.push(`Node ${n.id} (${n.type}) has no incoming edges.`);
    }
    if (n.type !== "output" && (!outgoing[n.id] || outgoing[n.id].length === 0)) {
      res.warnings.push(`Node ${n.id} (${n.type}) has no outgoing edges.`);
    }
  });

  // detect cycles using DFS
  const visited = {};
  const onStack = {};
  let hasCycle = false;
  function dfs(u) {
    visited[u] = true;
    onStack[u] = true;
    for (const v of (outgoing[u] || [])) {
      if (!visited[v]) {
        dfs(v);
        if (hasCycle) return;
      } else if (onStack[v]) {
        hasCycle = true;
        return;
      }
    }
    onStack[u] = false;
  }
  nodes.forEach((n) => {
    if (!visited[n.id]) dfs(n.id);
  });
  if (hasCycle) {
    res.valid = false;
    res.errors.push("Workflow contains a cycle. Cycles are not allowed in execution path.");
  }

  // reachability: at least one path from a userQuery to an output
  if (userQueryNodes.length > 0 && outputNodes.length > 0) {
    const outputIds = new Set(outputNodes.map((n) => n.id));
    let reachable = false;
    const q = [];
    const seen = new Set();
    userQueryNodes.forEach((n) => {
      q.push(n.id);
      seen.add(n.id);
    });
    while (q.length > 0) {
      const cur = q.shift();
      if (outputIds.has(cur)) {
        reachable = true;
        break;
      }
      for (const nxt of outgoing[cur] || []) {
        if (!seen.has(nxt)) {
          seen.add(nxt);
          q.push(nxt);
        }
      }
    }
    if (!reachable) {
      res.valid = false;
      res.errors.push("No path from UserQuery to Output exists.");
    }
  }

  // Build compiled workflow (a simple linearized steps list using BFS from userQuery nodes)
  if (res.valid) {
    const steps = [];
    const seen = new Set();
    const queue = [];
    userQueryNodes.forEach((n) => queue.push(n.id));
    while (queue.length > 0) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const node = nodeById[id];
      steps.push({
        id: node.id,
        type: node.type,
        data: node.data,
        // next: outgoing[node.id] || []
      });
      for (const nxt of (outgoing[id] || [])) {
        if (!seen.has(nxt)) queue.push(nxt);
      }
    }

    res.compiled = {
      id: `compiled_${Date.now()}`,
      created_at: new Date().toISOString(),
      steps,
      meta: { node_count: nodes.length, edge_count: edges.length },
    };
  }

  return res;
}

/* ----------------- Main Component ----------------- */
export default function WorkflowBuilder() {
  const { nodes, edges, setNodes, setEdges, setSelectedNode } = useStore();

  // local UI state
  const [buildResult, setBuildResult] = useState(null); // { valid, errors, warnings, compiled }
  const [isBuilt, setIsBuilt] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]); // {role: 'user'|'assistant', text}
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [lastRunTrace, setLastRunTrace] = useState(null);

  /* ReactFlow handlers */
  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge({ ...params, markerEnd: { type: "arrowclosed" }, style: { stroke: "#222", strokeWidth: 2 } }, eds)
      ),
    [setEdges]
  );
  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const reactFlowType = event.dataTransfer.getData("application/reactflow");
      if (!reactFlowType) return;
      const position = { x: event.clientX - 200, y: event.clientY - 100 };
      setNodes((nds) => nds.concat(makeNode(reactFlowType, position)));
    },
    [setNodes]
  );
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);
  const onNodeClick = useCallback((evt, node) => setSelectedNode(node), [setSelectedNode]);
  const deleteNode = useCallback(
    (nodeId) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    },
    [setNodes, setEdges, setSelectedNode]
  );

  /* Build Stack: validate + compile */
  const runBuildStack = useCallback( async () => {
    const result = clientValidateAndCompile(nodes, edges);
    setBuildResult(result);
    setIsBuilt(result.valid);
    if (result.valid && result.compiled) {
      const resp = await buildWorkflow(result.compiled); // 🚀 API call
      console.log("Backend build result:", resp.data);
    }
    // show UI feedback via buildResult state
  }, [nodes, edges]);

  /* Chat with Stack */
  const openChat = useCallback(() => {
    setChatMessages([]);
    setLastRunTrace(null);
    setChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setChatOpen(false);
  }, []);

  // const sendChat = useCallback(
  //   async (question) => {
  //     if (!question || question.trim() === "") return;
  //     const text = question.trim();
  //     setChatMessages((m) => [...m, { role: "user", text }]);
  //     setChatInput("");
  //     setIsChatting(true);

  //     // Prepare payload: prefer compiled workflow from buildResult, else send current graph
  //     const payload = {
  //       question: text,
  //       workflow: buildResult?.compiled ? buildResult.compiled : { nodes, edges },
  //       meta: { client_time: new Date().toISOString() },
  //     };

  //     try {
  //       // call backend orchestration endpoint
  //       const resp = await fetch("/api/workflow/run", {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify(payload),
  //       });

  //       if (!resp.ok) {
  //         // try to parse JSON error
  //         let errText = `Server error ${resp.status}`;
  //         try {
  //           const j = await resp.json();
  //           errText = j.error || j.message || errText;
  //         } catch {}
  //         setChatMessages((m) => [...m, { role: "assistant", text: `Error: ${errText}` }]);
  //         setLastRunTrace(null);
  //       } else {
  //         const j = await resp.json();
  //         // expected response shape: { answer: string, trace?: [], sources?: [] }
  //         const answer = j.answer || j.result || j.output || "No answer returned.";
  //         setChatMessages((m) => [...m, { role: "assistant", text: answer }]);
  //         setLastRunTrace(j.trace || null);
  //       }
  //     } catch (err) {
  //       setChatMessages((m) => [...m, { role: "assistant", text: `Request failed: ${err.message}` }]);
  //       setLastRunTrace(null);
  //     } finally {
  //       setIsChatting(false);
  //     }
  //   },
  //   [buildResult, nodes, edges]
  // );
const sendChat = useCallback(
  async (question) => {
    if (!question || question.trim() === "") return;
    const text = question.trim();
    setChatMessages((m) => [...m, { role: "user", text }]);
    setChatInput("");
    setIsChatting(true);

    const payload = {
      question: text,
      workflow: buildResult?.compiled ? buildResult.compiled : { nodes, edges },
      meta: { client_time: new Date().toISOString() },
    };

    try {
      const resp = await runWorkflow(payload); // 🚀 API call
      const j = resp.data;

      const answer = j.answer || j.result || j.output || "No answer returned.";
      setChatMessages((m) => [...m, { role: "assistant", text: answer }]);
      setLastRunTrace(j.trace || null);
    } catch (err) {
      setChatMessages((m) => [
        ...m,
        { role: "assistant", text: `Request failed: ${err.message}` },
      ]);
      setLastRunTrace(null);
    } finally {
      setIsChatting(false);
    }
  },
  [buildResult, nodes, edges]
);

  /* quick derived UI text */
  const buildStatus = useMemo(() => {
    if (!buildResult) return { text: "Not built", color: "#666" };
    if (buildResult.valid) return { text: "Built (valid)", color: "green" };
    return { text: "Build failed", color: "red" };
  }, [buildResult]);

  /* ----------------- UI ----------------- */
  return (
    <div style={{ display: "flex", height: "calc(100vh - 55px)" }}>
      {/* Left panel: palette + controls */}
      <div style={{ width: 220, borderRight: "1px solid #E4E8EE", padding: 12, boxSizing: "border-box" }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Component Library</div>

        {["userQuery", "knowledgeBase", "llmEngine", "output"].map((n) => (
          <div
            key={n}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("application/reactflow", n)}
            style={{
              padding: "8px 10px",
              border: "1px solid #ccc",
              marginBottom: 8,
              borderRadius: 6,
              cursor: "grab",
            }}
          >
            {n}
          </div>
        ))}

        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Actions</div>

          <button
            onClick={runBuildStack}
            style={{
              width: "100%",
              padding: "8px 10px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              marginBottom: 8,
            }}
          >
            Build Stack
          </button>

          <button
            onClick={() => { if (buildResult?.valid) openChat(); else { /* allow open but warn */ openChat(); } }}
            style={{
              width: "100%",
              padding: "8px 10px",
              background: isBuilt ? "#059669" : "#f59e0b",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Chat with Stack
          </button>

          <div style={{ marginTop: 10, fontSize: 13 }}>
            Status: <span style={{ color: buildStatus.color, fontWeight: 700 }}>{buildStatus.text}</span>
          </div>

          {buildResult?.errors?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ color: "red", fontWeight: 700 }}>Errors</div>
              <ul style={{ marginTop: 6 }}>
                {buildResult.errors.map((e, i) => (
                  <li key={i} style={{ fontSize: 13 }}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {buildResult?.warnings?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ color: "#b45309", fontWeight: 700 }}>Warnings</div>
              <ul style={{ marginTop: 6 }}>
                {buildResult.warnings.map((w, i) => (
                  <li key={i} style={{ fontSize: 13 }}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          connectionLineType="smoothstep"
          connectionLineStyle={{ stroke: "#222", strokeWidth: 2 }}
          fitView
          snapToGrid={true}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={(evt, node) => deleteNode(node.id)}
          style={{ width: "100%", height: "100%" }}
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>

      {/* Right panel: node config */}
      <div
        style={{
          width: 320,
          borderLeft: "1px solid #E4E8EE",
          padding: 12,
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <ConfigPanel />
      </div>

      {/* Chat modal (simple overlay) */}
      {chatOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            width: 420,
            maxHeight: "70vh",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            display: "flex",
            flexDirection: "column",
            zIndex: 9999,
          }}
        >
          <div style={{ padding: 10, borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700 }}>Chat with Stack</div>
            <div>
              <button onClick={() => { /* quick rebuild attempt */ runBuildStack(); }} style={{ marginRight: 8 }}>Validate</button>
              <button onClick={closeChat} style={{ background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
            </div>
          </div>

          <div style={{ padding: 10, overflowY: "auto", flex: 1 }}>
            {chatMessages.length === 0 && <div style={{ color: "#666" }}>Send a question to run the built workflow.</div>}
            {chatMessages.map((m, i) => (
              <div key={i} style={{ marginBottom: 10, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  background: m.role === "user" ? "#2563eb" : "#f3f4f6",
                  color: m.role === "user" ? "#fff" : "#111",
                  padding: "8px 10px",
                  borderRadius: 8,
                  maxWidth: "85%",
                }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: 10, borderTop: "1px solid #eee" }}>
            <div style={{ marginBottom: 6, fontSize: 12, color: "#666" }}>
              {isBuilt ? "Using built workflow." : "Workflow not built — will run using current graph."}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendChat(chatInput); }}
                placeholder="Ask a question..."
                style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
                disabled={isChatting}
              />
              <button
                onClick={() => sendChat(chatInput)}
                style={{
                  padding: "8px 12px",
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
                disabled={isChatting}
              >
                {isChatting ? "Running..." : "Send"}
              </button>
            </div>

            {lastRunTrace && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer" }}>Show last run trace</summary>
                <pre style={{ fontSize: 12, background: "#fafafa", padding: 8, borderRadius: 6 }}>{JSON.stringify(lastRunTrace, null, 2)}</pre>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------- Config Panel (unchanged logic but uses latest node from store) ----------------- */
function ConfigPanel() {
  const { selectedNode, nodes, setNodes } = useStore();

  if (!selectedNode) return <div style={{ color: "#777" }}>Select a node to configure</div>;

  const node = nodes.find((n) => n.id === selectedNode.id);
  if (!node) return null;

  const updateField = (idx, patch) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === node.id
          ? { ...n, data: { ...n.data, fields: n.data.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)) } }
          : n
      )
    );
  };

  const deleteField = (idx) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === node.id ? { ...n, data: { ...n.data, fields: n.data.fields.filter((_, i) => i !== idx) } } : n
      )
    );
  };

  const onFieldDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/field");
    if (!type || !node) return;
    const field = makeField(type);
    setNodes((nds) =>
      nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, fields: [...n.data.fields, field] } } : n))
    );
  };

  return (
    <div onDrop={onFieldDrop} onDragOver={(e) => e.preventDefault()} style={{ minHeight: "100%" }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Fields in {node.type}</div>

      {(node.data.fields || []).map((f, idx) => (
        <div key={idx} style={{ border: "1px solid #ddd", padding: 6, marginBottom: 6, background: "#fafafa" }}>
          {f.type === "input" && (
            <>
              <label>Label</label>
              <input value={f.label} onChange={(e) => updateField(idx, { label: e.target.value })} style={{ width: "100%" }} />
              <label>Placeholder</label>
              <input value={f.placeholder} onChange={(e) => updateField(idx, { placeholder: e.target.value })} style={{ width: "100%", marginTop: 4 }} />
            </>
          )}

          {f.type === "dropdown" && (
            <>
              <label>Label</label>
              <input value={f.label} onChange={(e) => updateField(idx, { label: e.target.value })} style={{ width: "100%" }} />
              <div style={{ marginTop: 6 }}>Options:</div>
              {f.options.map((opt, i) => (
                <input
                  key={i}
                  value={opt}
                  onChange={(e) => {
                    const opts = [...f.options];
                    opts[i] = e.target.value;
                    updateField(idx, { options: opts });
                  }}
                  style={{ width: "100%", marginTop: 4 }}
                />
              ))}
              <button style={{ marginTop: 6 }} onClick={() => updateField(idx, { options: [...f.options, "New Option"] })}>
                + Add Option
              </button>
            </>
          )}

          {f.type === "fileUpload" && (
            <>
              <label>Label</label>
              <input value={f.label} onChange={(e) => updateField(idx, { label: e.target.value })} style={{ width: "100%" }} />
              <label>Accept</label>
              <input value={f.accept} onChange={(e) => updateField(idx, { accept: e.target.value })} style={{ width: "100%", marginTop: 4 }} />
            </>
          )}

          {f.type === "button" && <input value={f.label} onChange={(e) => updateField(idx, { label: e.target.value })} style={{ width: "100%" }} />}

          {f.type === "header" && <input value={f.text} onChange={(e) => updateField(idx, { text: e.target.value })} style={{ width: "100%" }} />}

          <button style={{ color: "red", marginTop: 8 }} onClick={() => deleteField(idx)}>
            Delete Field
          </button>
        </div>
      ))}

      <div style={{ borderTop: "1px solid #ccc", marginTop: 12, paddingTop: 8 }}>
        <div style={{ fontWeight: 600 }}>Drag Fields</div>
        {["input", "dropdown", "fileUpload", "button", "header"].map((f) => (
          <div key={f} draggable onDragStart={(e) => e.dataTransfer.setData("application/field", f)} style={{ padding: 6, border: "1px solid #ddd", marginBottom: 6, borderRadius: 6, cursor: "grab" }}>
            {f === "input" ? "📥 Input" : f === "dropdown" ? "⬇️ Dropdown" : f === "fileUpload" ? "📂 File Upload" : f === "button" ? "🔘 Button" : "📝 Header"}
          </div>
        ))}
      </div>
    </div>
  );
}
