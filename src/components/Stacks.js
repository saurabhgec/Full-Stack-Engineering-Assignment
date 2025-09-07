import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchStack } from "../api";

export default function Stacks() {
  const navigate = useNavigate();
  const [stackData, setstackData] = useState([]);
  const [loading, setLoading] = useState(true); // loading state
  const [error, setError] = useState(null); // error state

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resp = await fetchStack();
        setstackData(resp.data); // only the array
      } catch (err) {
        console.error("Error fetching stacks:", err);
        setError("Failed to load stacks.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <p>Loading stacks...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="stack-page"> 
      <div className="stack-grid">
        {stackData.map((stack) => (
          <div className="stack-card-created" key={stack.id}>
            <h2>{stack.name}</h2>
            <p>{stack.description}</p>
              <button className="edit-btn"onClick={() => navigate("/stacks")}  >Edit Stack ✏️</button>
       
          </div>
        ))}
      </div>
    </div>
  );
}
