import React, { useState } from "react";
import Header from "./Header";
import NewStackButton from "./NewStackButton";
import StackCard from "./StackCard";
import Popup from "./Popup";
import Stacks from "./Stacks";
import { Outlet } from "react-router-dom";

const MainPage = () => {
   
console.log();
  return (
    <div >
      <Header />
<Outlet /> 
     </div>
  );
};

export default MainPage;
