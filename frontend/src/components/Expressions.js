import { useState, useEffect } from "react";

const API_URL = "http://localhost:5000";

function Expressions() {
  const [phrases, setPhrases] = useState([]);
  const [phraseText, setPhraseText] = useState("");
  const [phraseName, setPhraseName] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPhrases = () => {
    fetch(`${API_URL}/api/phrases`)
      .then((r) => r.json())
      .then((data) => {
        setPhrases(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchPhrases();
  }, []);

  const createPhrase = async (e) => {
    e.preventDefault();
    if (!phraseText.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/phrases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase_text: phraseText, name: phraseName }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Phrase "${phraseText}" created (${data.word_count} words)` });
        setPhraseText("");
        setPhraseName("");
        fetchPhrases();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    }
  };

  const deletePhrase = async (pid) => {
    try {
      await fetch(`${API_URL}/api/phrases/${pid}`, { method: "DELETE" });
      fetchPhrases();
      if (searchResult?.phrase_id === pid) setSearchResult(null);
    } catch {}
  };

  const searchPhrase = async (pid) => {
    try {
      const res = await fetch(`${API_URL}/api/phrases/${pid}/search`);
      const data = await res.json();
      data.phrase_id = pid;
      setSearchResult(data);
    } catch {
      setMessage({ type: "error", text: "Search failed" });
    }
  };

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="expressions-page">
      <h2 className="page-title">Expressions & Phrases</h2>

      <div className="section-card">
        <h3>Define New Phrase</h3>
        <form onSubmit={createPhrase} className="inline-form">
          <input
            placeholder="Phrase (e.g. artificial intelligence)"
            value={phraseText}
            onChange={(e) => setPhraseText(e.target.value)}
            style={{ flex: 2 }}
          />
          <input
            placeholder="Name (optional)"
            value={phraseName}
            onChange={(e) => setPhraseName(e.target.value)}
          />
          <button type="submit" className="btn-primary">Create</button>
        </form>
        {message && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}
      </div>

      <div className="section-card">
        <h3>Saved Phrases ({phrases.length})</h3>
        {phrases.length === 0 ? (
          <p className="text-muted">No phrases defined yet. Create one above.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Phrase</th>
                <th>Name</th>
                <th>Words</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {phrases.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.phrase_text}</strong></td>
                  <td>{p.user_defined_name || "-"}</td>
                  <td className="num-cell">{p.word_count}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-sm" onClick={() => searchPhrase(p.id)}>
                        Search
                      </button>
                      <button className="btn-danger-sm" onClick={() => deletePhrase(p.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {searchResult && (
        <div className="section-card">
          <h3>
            Results for "{searchResult.phrase}" - {searchResult.total_occurrences} occurrences
          </h3>
          {searchResult.total_occurrences === 0 ? (
            <p className="text-muted">No occurrences found in the corpus.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Newspaper</th>
                  <th>Para</th>
                  <th>Sent</th>
                  <th>Pos</th>
                  <th>Line</th>
                  <th>Context</th>
                </tr>
              </thead>
              <tbody>
                {searchResult.occurrences.map((occ, i) => (
                  <tr key={i}>
                    <td>{occ.title}</td>
                    <td>{occ.newspaper}</td>
                    <td className="num-cell">{occ.paragraph_num}</td>
                    <td className="num-cell">{occ.sentence_num}</td>
                    <td className="num-cell">{occ.position_in_sentence}</td>
                    <td className="num-cell">{occ.line_num}</td>
                    <td className="kwic-cell">{occ.sentence_text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default Expressions;
