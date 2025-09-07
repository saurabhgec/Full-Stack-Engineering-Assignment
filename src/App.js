import React from "react";
import { Routes, Route } from "react-router-dom"; 

import "./App.css";
// Screens
import HomePage from "./components/homepage";
import StackLayout from "./components/StackLayout";
import MainPage from "./components/mainpage";
function App() {
  return (
    <div className="App"> 
      <Routes>
        <Route path="/" element={<MainPage />} >
        <Route index element={<HomePage />} />
        <Route path="/stacks" element={<StackLayout />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
