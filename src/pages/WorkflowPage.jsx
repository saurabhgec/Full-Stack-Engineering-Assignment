import React, { useEffect, useState } from "react";
import { getWorkflows, saveWorkflow } from "../api";

function WorkflowPage() {
  const [workflows, setWorkflows] = useState([]);

  // Page load hone par workflows fetch karo
  useEffect(() => {
    getWorkflows().then(setWorkflows).catch((err) => console.error(err));
  }, []);

  // Save button click par workflow save karna
  const handleSave = () => {
    const workflowData = {
      name: "My First Workflow",
      nodes: [{ id: 1, label: "Start" }, { id: 2, label: "End" }],
      edges: [{ source: 1, target: 2 }],
    };

    saveWorkflow(workflowData)
      .then((res) => {
        console.log("Saved:", res);
        setWorkflows([...workflows, res]); // naya workflow list me add karo
      })
      .catch((err) => console.error("Error saving workflow:", err));
  };

  return (
    <div>
      <h2>Workflows</h2>
      <ul>
        {workflows.map((wf) => (
          <li key={wf.id}>{wf.name}</li>
        ))}
      </ul>
      <button onClick={handleSave}>Save Workflow</button>
    </div>
  );
}

export default WorkflowPage;
