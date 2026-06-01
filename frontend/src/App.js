import { useState, useEffect } from "react";
import "./App.css";

const API_URL = "http://localhost:5000";

function App() {
  const [dbStatus, setDbStatus] = useState("Checking...");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data) => setDbStatus(data.database))
      .catch(() => setDbStatus("Backend not reachable"));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Concordance System</h1>
        <p>Database: {dbStatus}</p>
      </header>
    </div>
  );
}

export default App;
