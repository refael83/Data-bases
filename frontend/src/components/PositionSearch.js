import { useState, useEffect } from "react";
import AddToGroupButton from "./AddToGroupButton";

const API_URL = "http://localhost:5000";

function PositionSearch() {
  const [allArticles, setAllArticles] = useState([]);
  const [newspapers, setNewspapers] = useState([]);
  const [newspaper, setNewspaper] = useState("");
  const [articleId, setArticleId] = useState("");
  const [page, setPage] = useState("");
  const [line, setLine] = useState("");
  const [position, setPosition] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/articles`)
      .then((r) => r.json())
      .then((data) => {
        setAllArticles(data);
        const names = [...new Set(data.map((a) => a.newspaper).filter(Boolean))];
        names.sort();
        setNewspapers(names);
      })
      .catch(() => {});
  }, []);

  const filteredArticles = allArticles.filter(
    (a) => a.newspaper === newspaper
  );

  const handleSearch = (e) => {
    e.preventDefault();
    if (!newspaper || !page || !line || !position) return;
    setLoading(true);
    const params = new URLSearchParams({
      newspaper,
      page,
      line,
      position,
    });
    if (articleId) params.set("article_id", articleId);
    fetch(`${API_URL}/api/search/position?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="position-search-page">
      <h2>Position Search</h2>
      <p className="page-desc">
        Find a word by its physical position: newspaper, page, line, and
        position in line.
      </p>

      <form className="position-form" onSubmit={handleSearch}>
        <div className="position-fields">
          <div className="control-group">
            <label>Newspaper</label>
            <select
              value={newspaper}
              onChange={(e) => {
                setNewspaper(e.target.value);
                setArticleId("");
              }}
            >
              <option value="">-- Select --</option>
              {newspapers.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>Article (optional)</label>
            <select
              value={articleId}
              onChange={(e) => setArticleId(e.target.value)}
              disabled={!newspaper}
            >
              <option value="">-- All articles --</option>
              {filteredArticles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>Page</label>
            <input
              type="number"
              min="1"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
          <div className="control-group">
            <label>Line</label>
            <input
              type="number"
              min="1"
              value={line}
              onChange={(e) => setLine(e.target.value)}
              placeholder="e.g. 3"
            />
          </div>
          <div className="control-group">
            <label>Position in line</label>
            <input
              type="number"
              min="1"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. 5"
            />
          </div>
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={!newspaper || !page || !line || !position || loading}
        >
          {loading ? "Searching..." : "Find Word"}
        </button>
      </form>

      {result && (
        <div className="position-result">
          {!result.found ? (
            <div className="no-results">No word found at this position.</div>
          ) : (
            result.results.map((r, i) => (
              <div key={i} className="position-result-card">
                <div className="found-word">
                  {r.original_form} <AddToGroupButton word={r.word_text} />
                </div>
                <div className="found-details">
                  <span className="detail-item">
                    <strong>Normalized:</strong> {r.word_text}
                  </span>
                  <span className="detail-item">
                    <strong>Article:</strong> {r.title}
                  </span>
                  <span className="detail-item">
                    <strong>Paragraph:</strong> {r.paragraph_num}
                  </span>
                  <span className="detail-item">
                    <strong>Sentence:</strong> {r.sentence_num}
                  </span>
                  <span className="detail-item">
                    <strong>Page:</strong> {r.page_num}
                  </span>
                  <span className="detail-item">
                    <strong>Line:</strong> {r.line_num}
                  </span>
                  <span className="detail-item">
                    <strong>Position:</strong> {r.position_in_sentence}
                  </span>
                </div>
                <div className="found-context">
                  <strong>Sentence:</strong>{" "}
                  <HighlightWord
                    text={r.sentence_text}
                    word={r.original_form}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function HighlightWord({ text, word }) {
  if (!text || !word) return <span>{text}</span>;
  const regex = new RegExp(
    `(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === word.toLowerCase() ? (
          <mark key={i}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export default PositionSearch;
