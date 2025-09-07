// StackLayout.js
import React from "react";
import Sidebar from "./Sidebar";
import WorkflowBuilder from "./WorkflowBuilder";

const StackLayout = () => {
  return (
    <div style={{ display: "flex" }}>
      {/* Sidebar */}
      {/* <Sidebar /> */}

      {/* Main Content Area */}
      <div style={{ marginLeft: "", padding: "20px", width: "100%" }}>
      <WorkflowBuilder />
      </div>
    </div>
  );
};

export default StackLayout;
