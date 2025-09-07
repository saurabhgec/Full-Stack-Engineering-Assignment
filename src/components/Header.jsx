import React from "react";
import "../App.css";

const Header = () => {
  return (
    <header className="header">
      {/* Left Side */}
      <div className="header-left">
        <img src="https://via.placeholder.com/25" alt="logo" className="logo" />
        <h1 className="brand">GenAI Stack</h1>
      </div>

      {/* Right Side */}
      <div className="header-right">
        <span className="my-stacks-text">My Stacks</span>
        <div className="profile-circle">S</div>
      </div>
    </header>
  );
};

export default Header;
