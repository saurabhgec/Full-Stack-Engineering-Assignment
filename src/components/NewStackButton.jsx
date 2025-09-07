import React from "react";
import "../App.css";

const NewStackButton = ({ onClick }) => {
  return (
    <button className="new-stack-btn" onClick={onClick}>
      <div className="icon">+</div>
      <span>New Stack</span>
    </button>
  );
};

export default NewStackButton;
