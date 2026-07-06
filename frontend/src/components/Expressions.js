import { useState, useEffect } from "react";

const API_URL = "http://localhost:5000";

function Expressions() {
  const [phrases, setPhrases] = useState([]);
  const [phraseText, setPhraseText] = useState("");
  const [phraseName, setPhraseName] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [selectedPhraseId, setSelectedPhraseId] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

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
      if (String(selectedPhraseId) === String(pid)) setSelectedPhraseId("");
    } catch {}
  };

  const searchPhrase = async (pid) => {
    setSearching(true);
    try {
      const res = await fetch(`${API_URL}/api/phrases/${pid}/search`);
      const data = await res.json();
      data.phrase_id = pid;
      setSearchResult(data);
    } catch {
      setMessage({ type: "error", text: "Search failed" });
    }
    setSearching(false);
  };

  const handlePhraseSelect = (e) => {
    const pid = e.target.value;
    setSelectedPhraseId(pid);
    if (pid) searchPhrase(pid);
    else setSearchResult(null);
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
        <h3>Search Phrase in Articles</h3>
        {phrases.length === 0 ? (
          <p className="text-muted">No phrases defined yet. Create one above.</p>
        ) : (
          <div className="phrase-search-form">
            <select value={selectedPhraseId} onChange={handlePhraseSelect}>
              <option value="">-- Select a phrase --</option>
              {phrases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.phrase_text}
                  {p.user_defined_name ? ` (${p.user_defined_name})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {searching && <div className="page-loading">Searching...</div>}

        {searchResult && !searching && (
          <div className="phrase-search-results">
            <div className="results-summary">
              <span className="stat-pill">{searchResult.article_count} articles</span>
              <span className="stat-pill">{searchResult.total_occurrences} total occurrences</span>
            </div>
            {searchResult.article_count === 0 ? (
              <p className="text-muted">No articles contain this phrase.</p>
            ) : (
              searchResult.articles.map((art) => (
                <div key={art.article_id} className="result-card">
                  <div className="result-header">
                    <h3>{art.title}</h3>
                    <span className="occurrence-badge">
                      {art.occurrence_count} occurrences
                    </span>
                  </div>
                  <div className="result-meta">
                    <span>{art.newspaper}</span>
                  </div>
                  <div className="kwic-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Para</th>
                          <th>Sent</th>
                          <th>Pos</th>
                          <th>Line</th>
                          <th>Page</th>
                          <th>Context</th>
                        </tr>
                      </thead>
                      <tbody>
                        {art.occurrences.map((occ, i) => (
                          <tr key={i}>
                            <td className="num-cell">{occ.paragraph_num}</td>
                            <td className="num-cell">{occ.sentence_num}</td>
                            <td className="num-cell">{occ.position_in_sentence}</td>
                            <td className="num-cell">{occ.line_num}</td>
                            <td className="num-cell">{occ.page_num}</td>
                            <td className="kwic-cell">
                              <HighlightPhrase
                                text={occ.sentence_text}
                                phrase={searchResult.phrase}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
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
    </div>
  );
}

function HighlightPhrase({ text, phrase }) {
  if (!text || !phrase) return <span>{text}</span>;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === phrase.toLowerCase() ? (
          <mark key={i}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export default Expressions;
