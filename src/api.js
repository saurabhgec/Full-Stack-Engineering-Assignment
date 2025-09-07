import axios from "axios";

// Create an Axios instance
const API = axios.create({
  baseURL: "http://127.0.0.1:8000", // FastAPI backend URL
  timeout: 10000, // 10 seconds timeout
});

// Generic helper to handle errors
const handleError = (err) => {
  if (err.response) {
    // Server responded with a status code out of 2xx range
    return {
      success: false,
      status: err.response.status,
      message: err.response.data?.error || err.response.data?.detail || "Server error",
      data: err.response.data || null,
    };
  } else if (err.request) {
    // Request was made but no response received
    return {
      success: false,
      status: null,
      message: "No response from server. Check your backend.",
      data: null,
    };
  } else {
    // Something else happened
    return {
      success: false,
      status: null,
      message: err.message,
      data: null,
    };
  }
};

/* ----------------- API calls ----------------- */

// Workflow build/validate
export const buildWorkflow = async (data) => {debugger
  try {
    const resp = await API.post("/workflow/build", data);
    return { success: true, data: resp.data };
  } catch (err) {
    return handleError(err);
  }
};

// Workflow run (chat)
export const runWorkflow = async (payload) => {
  try {
    const resp = await API.post("/api/workflow/run", payload);

    // backend response check
    if (resp && resp.data) {
      return { success: true, data: resp.data };
    } else {
      return {
        success: false,
        message: "No response from server. Check your backend.",
        data: null,
        status: resp?.status || null,
      };
    }
  } catch (err) {
    console.error("Workflow run error:", err);
    return handleError(err);
  }
};

export const savestack = async (payload) => {
  try {
    const resp = await API.post("/api/setstack", payload);

    // backend response check
    if (resp && resp.data) {
      return { success: true, data: resp.data };
    } else {
      return {
        success: false,
        message: "No response from server. Check your backend.",
        data: null,
        status: resp?.status || null,
      };
    }
  } catch (err) {
    console.error("Workflow run error:", err);
    return handleError(err);
  }
};
export const fetchStack = async (payload) => {
  try {
    const resp = await API.get("/api/getstack", payload);

    // backend response check
    if (resp && resp.data) {
      return { success: true, data: resp.data };
    } else {
      return {
        success: false,
        message: "No response from server. Check your backend.",
        data: null,
        status: resp?.status || null,
      };
    }
  } catch (err) {
    console.error("Workflow run error:", err);
    return handleError(err);
  }
};