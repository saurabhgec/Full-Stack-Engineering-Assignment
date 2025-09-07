import React, { useState } from "react";
import Header from "./Header";
import NewStackButton from "./NewStackButton";
import StackCard from "./StackCard";
import Popup from "./Popup";
import Stacks from "./Stacks";
import { savestack } from "../api";

const Homepage = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showStacks, setShowStacks] = useState(false); // 👈 yeh naya state
  const [data, setData] = useState({});
  const handleCreateStack = async () => {

const resp = await savestack(data); // 🚀 API call
      const j = resp.data;
       console.log(data);
    //console.log('createRectAdjustmentFn..................');
    setIsPopupOpen(false);
    setShowStacks(true); // 👈 Create click hote hi stacks dikhenge
  };
const handleFormData = (field, value) => {
  setData((prev) => ({
    ...prev,
    [field]: value,
  }));
};
  return (
    <div >
      <Header />

      {/* Top Right NewStack Button */}
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "5% 1%" }}>
        <NewStackButton onClick={() => setIsPopupOpen(true)} />
      </div>

      {/* Center Content */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "30px" }}>
        {!showStacks ? (
          <StackCard onNewClick={() => setIsPopupOpen(true)} />
        ) : (
          <Stacks/>
        )}
      </div>

      {/* Popup Modal */}
      {isPopupOpen && <Popup onClose={() => setIsPopupOpen(false)}  formdata={handleFormData} onCreate={handleCreateStack} />}
    </div>
  );
};

export default Homepage;
