import { useState } from "react";

const API_URL = "http://localhost:5000";

function DocumentSearch({ onOpenArticle }) {
  const [word, setWord] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    const trimmed = word.trim();
    if (!trimmed) return;
    setLoading(true);
    fetch(`${API_URL}/api/search/word?word=${encodeURIComponent(trimmed)}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="doc-search-page">
      <h2>Document Search</h2>
      <p className="page-desc">Enter a word to find all documents containing it.</p>

      <form className="doc-search-form" onSubmit={handleSearch}>
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Enter a word..."
        />
        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {results && (
        <div className="doc-search-results">
          {results.articles && results.articles.length > 0 ? (
            <>
              <h3>
                Found in {results.articles.length} document{results.articles.length !== 1 ? "s" : ""}
                {results.total_occurrences != null && (
                  <span className="occ-count"> ({results.total_occurrences} total occurrences)</span>
                )}
              </h3>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Newspaper</th>
                    <th>Topic</th>
                    <th>Occurrences</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.articles.map((art) => (
                    <tr key={art.article_id}>
                      <td>
                        <button
                          className="link-btn"
                          onClick={() => onOpenArticle(art.article_id)}
                        >
                          {art.title}
                        </button>
                      </td>
                      <td>{art.newspaper || "-"}</td>
                      <td>
                        {art.topic ? (
                          <span className={`badge ${art.topic}`}>{art.topic}</span>
                        ) : "-"}
                      </td>
                      <td>{art.occurrence_count}</td>
                      <td>
                        <button
                          className="btn-view"
                          onClick={() => onOpenArticle(art.article_id)}
                        >
                          View Document
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="no-results">No documents found containing "{word.trim()}".</p>
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentSearch;
