import React from "react";
import "../App.css";
import NewStackButton from "./NewStackButton";

const StackCard = ({ onNewClick }) => {
  return (
    <div className="stack-card">
      <h2>Create New Stack</h2>
      <p>
        Start building your generative AI apps with our essential tools and
        frameworks.
      </p>
      <NewStackButton onClick={onNewClick} />
    </div>
  );
};

export default StackCard;
