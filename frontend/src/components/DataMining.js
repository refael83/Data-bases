import { useState } from "react";

const API_URL = "http://localhost:5000";

function DataMining() {
  const [scope, setScope] = useState("sentence");
  const [minCount, setMinCount] = useState(2);
  const [minSupport, setMinSupport] = useState(0.05);
  const [minConfidence, setMinConfidence] = useState(0.1);
  const [cooccurrences, setCooccurrences] = useState([]);
  const [rules, setRules] = useState([]);
  const [sortBy, setSortBy] = useState("lift");
  const [message, setMessage] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [mining, setMining] = useState(false);

  const calculateCooccurrences = async () => {
    setCalculating(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/mining/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, min_count: minCount }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchCooccurrences();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    }
    setCalculating(false);
  };

  const fetchCooccurrences = async () => {
    try {
      const res = await fetch(`${API_URL}/api/mining/cooccurrences?scope=${scope}&limit=50`);
      const data = await res.json();
      setCooccurrences(data);
    } catch {}
  };

  const runApriori = async () => {
    setMining(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/mining/apriori`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, min_support: minSupport, min_confidence: minConfidence }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchRules();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    }
    setMining(false);
  };

  const fetchRules = async () => {
    try {
      const res = await fetch(`${API_URL}/api/mining/rules?scope=${scope}&sort=${sortBy}&limit=50`);
      const data = await res.json();
      setRules(data);
    } catch {}
  };

  return (
    <div className="mining-page">
      <h2 className="page-title">Data Mining</h2>

      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      <div className="section-card">
        <h3>Step 1: Calculate Co-occurrences</h3>
        <p className="text-muted">
          Find pairs of content words that appear together within the same unit (sentence, paragraph, or article).
        </p>
        <div className="controls-row">
          <div className="control-group">
            <label>Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="sentence">Sentence</option>
              <option value="paragraph">Paragraph</option>
              <option value="article">Article</option>
            </select>
          </div>
          <div className="control-group">
            <label>Min Count</label>
            <input
              type="number"
              min="1"
              value={minCount}
              onChange={(e) => setMinCount(Number(e.target.value))}
              style={{ width: 70 }}
            />
          </div>
          <button
            className="btn-primary"
            onClick={calculateCooccurrences}
            disabled={calculating}
          >
            {calculating ? "Calculating..." : "Calculate"}
          </button>
        </div>
      </div>

      {cooccurrences.length > 0 && (
        <div className="section-card">
          <h3>Top Co-occurring Pairs ({scope})</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Word 1</th>
                <th>Word 2</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {cooccurrences.map((c, i) => (
                <tr key={i}>
                  <td className="num-cell">{i + 1}</td>
                  <td><strong>{c.word1}</strong></td>
                  <td><strong>{c.word2}</strong></td>
                  <td className="num-cell">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-card">
        <h3>Step 2: Apriori Algorithm - Association Rules</h3>
        <p className="text-muted">
          Generate association rules from co-occurrence data. Rules show which words tend to appear together.
        </p>
        <div className="controls-row">
          <div className="control-group">
            <label>Min Support</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={minSupport}
              onChange={(e) => setMinSupport(Number(e.target.value))}
              style={{ width: 80 }}
            />
          </div>
          <div className="control-group">
            <label>Min Confidence</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              style={{ width: 80 }}
            />
          </div>
          <button
            className="btn-primary"
            onClick={runApriori}
            disabled={mining}
          >
            {mining ? "Mining..." : "Run Apriori"}
          </button>
        </div>
      </div>

      {rules.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <h3>Association Rules ({rules.length})</h3>
            <div className="filter-controls">
              <label>Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setTimeout(fetchRules, 0);
                }}
              >
                <option value="lift">Lift</option>
                <option value="confidence">Confidence</option>
                <option value="support">Support</option>
              </select>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Antecedent</th>
                <th></th>
                <th>Consequent</th>
                <th>Support</th>
                <th>Confidence</th>
                <th>Lift</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={i}>
                  <td className="num-cell">{i + 1}</td>
                  <td><strong>{r.antecedent}</strong></td>
                  <td className="arrow-cell">&rarr;</td>
                  <td><strong>{r.consequent}</strong></td>
                  <td className="num-cell">{Number(r.support).toFixed(4)}</td>
                  <td className="num-cell">{Number(r.confidence).toFixed(4)}</td>
                  <td className="num-cell">{Number(r.lift).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DataMining;
