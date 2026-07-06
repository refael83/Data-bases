import { useState, useEffect } from "react";

const API_URL = "http://localhost:5000";

function DetailedStats() {
  const [articles, setArticles] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/articles`)
      .then((r) => r.json())
      .then(setArticles)
      .catch(() => {});
    loadStats("");
  }, []);

  const loadStats = (articleId) => {
    setLoading(true);
    const url = articleId
      ? `${API_URL}/api/statistics/detailed?article_id=${articleId}`
      : `${API_URL}/api/statistics/detailed`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleSelect = (e) => {
    const val = e.target.value;
    setSelectedId(val);
    loadStats(val);
  };

  const isGlobal = !selectedId;

  return (
    <div className="detailed-stats-page">
      <h2>Detailed Statistics</h2>
      <p className="page-desc">
        Character, word, sentence, and paragraph counts at every level.
      </p>

      <div className="detailed-stats-controls">
        <div className="control-group">
          <label>Scope</label>
          <select value={selectedId} onChange={handleSelect}>
            <option value="">All Articles (global)</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="page-loading">Loading...</div>}

      {stats && !loading && (
        <div className="detailed-stats-grid">
          {stats.totals && (
            <div className="stats-card">
              <h3>Article Totals</h3>
              <div className="totals-row">
                <div className="total-item">
                  <span className="total-value">{stats.totals.characters?.toLocaleString()}</span>
                  <span className="total-label">Characters</span>
                </div>
                <div className="total-item">
                  <span className="total-value">{stats.totals.words?.toLocaleString()}</span>
                  <span className="total-label">Words</span>
                </div>
                <div className="total-item">
                  <span className="total-value">{stats.totals.sentences?.toLocaleString()}</span>
                  <span className="total-label">Sentences</span>
                </div>
                <div className="total-item">
                  <span className="total-value">{stats.totals.paragraphs?.toLocaleString()}</span>
                  <span className="total-label">Paragraphs</span>
                </div>
              </div>
            </div>
          )}

          <div className="stats-card">
            <h3>Characters per Unit</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Average</th>
                </tr>
              </thead>
              <tbody>
                <StatRow label="Per Word" data={stats.chars_per_word} />
                <StatRow label="Per Sentence" data={stats.chars_per_sentence} />
                <StatRow label="Per Paragraph" data={stats.chars_per_paragraph} />
                <StatRow label="Per Article" data={stats.chars_per_article} />
              </tbody>
            </table>
          </div>

          <div className="stats-card">
            <h3>Words per Unit</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Average</th>
                </tr>
              </thead>
              <tbody>
                <StatRow label="Per Sentence" data={stats.words_per_sentence} />
                <StatRow label="Per Paragraph" data={stats.words_per_paragraph} />
                <StatRow label="Per Article" data={stats.words_per_article} />
              </tbody>
            </table>
          </div>

          <div className="stats-card">
            <h3>Sentences per Unit</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Average</th>
                </tr>
              </thead>
              <tbody>
                <StatRow label="Per Paragraph" data={stats.sentences_per_paragraph} />
                <StatRow label="Per Article" data={stats.sentences_per_article} />
              </tbody>
            </table>
          </div>

          <div className="stats-card">
            <h3>Paragraphs per Article</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Average</th>
                </tr>
              </thead>
              <tbody>
                <StatRow label="Per Article" data={stats.paragraphs_per_article} />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, data }) {
  if (!data) return null;
  return (
    <tr>
      <td><strong>{label}</strong></td>
      <td className="num-cell">{Number(data.min_val).toLocaleString()}</td>
      <td className="num-cell">{Number(data.max_val).toLocaleString()}</td>
      <td className="num-cell">{Number(data.avg_val).toLocaleString()}</td>
    </tr>
  );
}

export default DetailedStats;
