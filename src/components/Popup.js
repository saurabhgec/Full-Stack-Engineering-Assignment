import React, { useState } from "react";
import "../App.css";

const Popup = ({ onClose, onCreate ,formdata}) => {

 const [name, setName] = useState('');
 const [description, setdescription] = useState(''); 
  return (
    <div className="popup-overlay">
      <div className="popup-container">
        {/* Header Row */}
        <div className="popup-header">
          <h3>Create New Stack</h3>
          <span className="popup-close" onClick={onClose}>×</span>
        </div>
        <hr />

        {/* Form Fields */}
        <div className="popup-body">
          <div className="form-group">
            <label>Name</label>
            <input type="text" 
            onInput={(e)=>
              formdata('name',e.target.value)
            }
            
            placeholder="Enter stack name" />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea placeholder="Enter stack description"
            onInput={(e)=>
                formdata('description',e.target.value)

            }
            ></textarea>
          </div>
        </div>

        <hr />

        {/* Footer Buttons */}
        <div className="popup-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="create-btn" onClick={onCreate}>Create</button>
        </div>
      </div>
    </div>
  );
};

export default Popup;
