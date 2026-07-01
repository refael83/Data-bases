import { useState, useEffect } from "react";

const API_URL = "http://localhost:5000";

function Statistics() {
  const [topWords, setTopWords] = useState([]);
  const [lengthDist, setLengthDist] = useState([]);
  const [limit, setLimit] = useState(20);
  const [includeStop, setIncludeStop] = useState(false);
  const [wordDetail, setWordDetail] = useState(null);
  const [searchWord, setSearchWord] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/statistics/words?limit=${limit}&include_stop=${includeStop}`).then((r) => r.json()),
      fetch(`${API_URL}/api/statistics/length-distribution`).then((r) => r.json()),
    ])
      .then(([words, lengths]) => {
        setTopWords(words);
        setLengthDist(lengths);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, [limit, includeStop]);

  const lookupWord = async (e) => {
    e.preventDefault();
    if (!searchWord.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/statistics/word/${encodeURIComponent(searchWord)}`);
      if (res.ok) {
        const data = await res.json();
        setWordDetail(data);
      } else {
        setWordDetail({ error: "Word not found in corpus" });
      }
    } catch {
      setWordDetail({ error: "Connection error" });
    }
  };

  return (
    <div className="statistics-page">
      <h2 className="page-title">Statistics</h2>

      <div className="section-card">
        <h3>Word Lookup</h3>
        <form onSubmit={lookupWord} className="inline-form">
          <input
            placeholder="Enter a word..."
            value={searchWord}
            onChange={(e) => setSearchWord(e.target.value)}
          />
          <button type="submit" className="btn-primary">Lookup</button>
        </form>

        {wordDetail && !wordDetail.error && (
          <div className="word-detail-card">
            <div className="word-detail-header">
              <h4>{wordDetail.word_text}</h4>
              <div className="word-detail-meta">
                <span className="stat-pill">Length: {wordDetail.word_length}</span>
                <span className="stat-pill">Total: {wordDetail.word_count_total}</span>
                {wordDetail.is_stop_word && <span className="stat-pill warning">Stop Word</span>}
              </div>
            </div>

            {wordDetail.article_distribution?.length > 0 && (
              <div className="detail-section">
                <h5>Distribution by Article</h5>
                <table className="data-table compact">
                  <thead>
                    <tr><th>Article</th><th>Count</th></tr>
                  </thead>
                  <tbody>
                    {wordDetail.article_distribution.map((a) => (
                      <tr key={a.article_id}>
                        <td>{a.title}</td>
                        <td className="num-cell">{a.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {wordDetail.paragraph_distribution?.length > 0 && (
              <div className="detail-section">
                <h5>Distribution by Paragraph</h5>
                <div className="bar-chart">
                  {wordDetail.paragraph_distribution.map((p) => (
                    <div key={p.paragraph_num} className="bar-row">
                      <span className="bar-label">Para {p.paragraph_num}</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${(p.count / Math.max(...wordDetail.paragraph_distribution.map((x) => x.count))) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="bar-value">{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {wordDetail.groups?.length > 0 && (
              <div className="detail-section">
                <h5>Member of Groups</h5>
                <div className="word-chips">
                  {wordDetail.groups.map((g) => (
                    <span key={g.id} className="word-chip">{g.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {wordDetail?.error && (
          <div className="message error">{wordDetail.error}</div>
        )}
      </div>

      <div className="section-card">
        <div className="section-header">
          <h3>Top Words</h3>
          <div className="filter-controls">
            <label>
              <input
                type="checkbox"
                checked={includeStop}
                onChange={(e) => setIncludeStop(e.target.checked)}
              />
              Include stop words
            </label>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="page-loading">Loading...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Word</th>
                <th>Length</th>
                <th>Occurrences</th>
                <th>Articles</th>
              </tr>
            </thead>
            <tbody>
              {topWords.map((w, i) => (
                <tr
                  key={w.word_text}
                  className="clickable-row"
                  onClick={() => { setSearchWord(w.word_text); }}
                >
                  <td className="num-cell">{i + 1}</td>
                  <td><strong>{w.word_text}</strong></td>
                  <td className="num-cell">{w.word_length}</td>
                  <td className="num-cell">{w.word_count_total}</td>
                  <td className="num-cell">{w.article_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {lengthDist.length > 0 && (
        <div className="section-card">
          <h3>Word Length Distribution</h3>
          <div className="bar-chart">
            {lengthDist.map((d) => (
              <div key={d.word_length} className="bar-row">
                <span className="bar-label">{d.word_length} chars</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(d.total_occurrences / Math.max(...lengthDist.map((x) => x.total_occurrences))) * 100}%`,
                    }}
                  />
                </div>
                <span className="bar-value">
                  {d.unique_count} unique / {d.total_occurrences} total
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Statistics;
