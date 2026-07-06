import { useState, useEffect } from "react";

const API_URL = "http://localhost:5000";

function ArticleCompare() {
  const [articles, setArticles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [includeStop, setIncludeStop] = useState(false);
  const [limit, setLimit] = useState(0);

  useEffect(() => {
    fetch(`${API_URL}/api/articles`)
      .then((r) => r.json())
      .then((data) => setArticles(data))
      .catch(() => {});
  }, []);

  const toggleArticle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCompare = () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    fetch(`${API_URL}/api/statistics/compare-articles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        article_ids: selectedIds,
        include_stop: includeStop,
        limit: limit,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        setResults(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="compare-page">
      <h2>Compare Articles</h2>
      <p className="page-desc">
        Select articles to see word statistics across them.
      </p>

      <div className="compare-layout">
        <div className="compare-select-panel">
          <h3>Select Articles</h3>
          <div className="article-checklist">
            {articles.map((art) => (
              <label key={art.id} className="article-check-item">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(art.id)}
                  onChange={() => toggleArticle(art.id)}
                />
                <span className="check-title">{art.title}</span>
                <span className="check-meta">{art.newspaper}</span>
              </label>
            ))}
          </div>

          <div className="compare-controls">
            <div className="control-group">
              <label>Top words</label>
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                <option value={0}>All</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={includeStop}
                onChange={(e) => setIncludeStop(e.target.checked)}
              />
              Include stop words
            </label>
          </div>

          <button
            className="btn-primary"
            onClick={handleCompare}
            disabled={selectedIds.length === 0 || loading}
          >
            {loading
              ? "Loading..."
              : `Compare (${selectedIds.length} selected)`}
          </button>
        </div>

        <div className="compare-results-panel">
          {!results && (
            <div className="results-empty">
              Select articles and click Compare to see word statistics.
            </div>
          )}

          {results && results.words && (
            <>
              <h3>
                Word Statistics ({results.words.length} words across{" "}
                {results.articles.length} articles)
              </h3>
              <div className="compare-table-wrap">
                <table className="doc-table compare-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Word</th>
                      <th>Length</th>
                      <th>Total (all articles)</th>
                      <th>In selected</th>
                      {results.articles.map((a) => (
                        <th key={a.id} title={a.title}>
                          {a.title.length > 20
                            ? a.title.slice(0, 18) + "..."
                            : a.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.words.map((w, i) => (
                      <tr key={w.word}>
                        <td className="num-cell">{i + 1}</td>
                        <td>
                          <strong>{w.word}</strong>
                        </td>
                        <td className="num-cell">{w.length}</td>
                        <td className="num-cell">{w.global_count}</td>
                        <td className="num-cell">{w.total_count}</td>
                        {results.articles.map((a) => (
                          <td key={a.id} className="num-cell">
                            {w.per_article[String(a.id)] || 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArticleCompare;
