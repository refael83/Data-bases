import { useState, useEffect, useRef } from "react";

const API_URL = "http://localhost:5000";

function ArticleDetail({ articleId, onBack }) {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedText, setSelectedText] = useState("");
  const [popoverPos, setPopoverPos] = useState(null);
  const [phraseResult, setPhraseResult] = useState(null);
  const [phraseSearching, setPhraseSearching] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/api/articles/${articleId}`)
      .then((r) => r.json())
      .then((data) => {
        setArticle(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [articleId]);

  const handleTextMouseUp = () => {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    if (text.split(/\s+/).length >= 2) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = textRef.current.getBoundingClientRect();
      setSelectedText(text);
      const barHeight = 38;
      const gap = 8;
      setPopoverPos({
        top: rect.top - containerRect.top - barHeight - gap,
        left: Math.max(0, rect.left - containerRect.left + rect.width / 2),
      });
      setPhraseResult(null);
    } else {
      setSelectedText("");
      setPopoverPos(null);
    }
  };

  const searchPhrase = async () => {
    if (!selectedText) return;
    setPhraseSearching(true);
    try {
      const createRes = await fetch(`${API_URL}/api/phrases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase_text: selectedText }),
      });
      const createData = await createRes.json();
      const phraseId = createData.phrase_id || createData.id;
      const searchRes = await fetch(`${API_URL}/api/phrases/${phraseId}/search`);
      const searchData = await searchRes.json();
      setPhraseResult({ phrase: selectedText, ...searchData });
    } catch {
      setPhraseResult({ error: "Search failed" });
    }
    setPhraseSearching(false);
  };

  const dismissPopover = () => {
    setSelectedText("");
    setPopoverPos(null);
    setPhraseResult(null);
    window.getSelection()?.removeAllRanges();
  };

  if (loading) return <div className="page-loading">Loading article...</div>;
  if (!article) return <div className="page-loading">Article not found.</div>;

  const grouped = {};
  (article.sentences || []).forEach((s) => {
    if (!grouped[s.paragraph]) grouped[s.paragraph] = [];
    grouped[s.paragraph].push(s);
  });

  return (
    <div className="article-detail-page">
      <button className="btn-back" onClick={onBack}>&larr; Back</button>

      <div className="article-detail-header">
        <h2>{article.title}</h2>
        <div className="article-meta-row">
          {article.authors && (
            <span className="meta-item">
              <strong>Authors:</strong> {Array.isArray(article.authors) ? article.authors.join(", ") : article.authors}
            </span>
          )}
          {article.newspaper && (
            <span className="meta-item"><strong>Newspaper:</strong> {article.newspaper}</span>
          )}
          {article.topic && (
            <span className="meta-item">
              <span className={`badge ${article.topic}`}>{article.topic}</span>
            </span>
          )}
          {article.publication_date && (
            <span className="meta-item"><strong>Date:</strong> {article.publication_date}</span>
          )}
        </div>
        <div className="article-stats-row">
          <span className="stat-pill">{article.word_count} words</span>
          <span className="stat-pill">{article.sentence_count} sentences</span>
          <span className="stat-pill">{article.paragraph_count} paragraphs</span>
          {article.file_path && <span className="stat-pill">{article.file_path}</span>}
        </div>
      </div>

      <div className="section-card">
        <h3>Article Text</h3>
        <p style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
          💡 Select 2 or more words to search for that phrase across all articles.
        </p>
        <div
          className="article-text"
          ref={textRef}
          style={{ position: "relative", userSelect: "text" }}
          onMouseUp={handleTextMouseUp}
        >
          {Object.keys(grouped)
            .sort((a, b) => Number(a) - Number(b))
            .map((paraNum) => (
              <p key={paraNum} className="article-paragraph">
                <span className="para-num">P{paraNum}</span>
                {grouped[paraNum]
                  .sort((a, b) => a.sentence_num - b.sentence_num)
                  .map((s, i) => (
                    <span key={i}>
                      <HighlightPhrase text={s.text} phrase={phraseResult?.phrase} />{" "}
                    </span>
                  ))}
              </p>
            ))}

          {popoverPos && selectedText && (
            <div
              style={{
                position: "absolute",
                top: popoverPos.top,
                left: popoverPos.left,
                transform: "translateX(-50%)",
                background: "#1c1c1e",
                color: "#fff",
                borderRadius: 10,
                padding: "0",
                zIndex: 100,
                display: "flex",
                alignItems: "stretch",
                boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
                fontSize: 13,
                fontWeight: 500,
                overflow: "hidden",
                whiteSpace: "nowrap",
                userSelect: "none",
              }}
            >
              <button
                onClick={searchPhrase}
                disabled={phraseSearching}
                style={{
                  background: "none",
                  color: "#fff",
                  border: "none",
                  borderRight: "1px solid rgba(255,255,255,0.15)",
                  padding: "9px 16px",
                  cursor: phraseSearching ? "default" : "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  opacity: phraseSearching ? 0.6 : 1,
                }}
              >
                {phraseSearching ? "מחפש…" : "🔍 הופעות נוספות"}
              </button>
              <button
                onClick={dismissPopover}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.55)",
                  padding: "9px 12px",
                  cursor: "pointer",
                  fontSize: 13,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
              {/* iOS-style caret pointing down */}
              <div style={{
                position: "absolute",
                bottom: -6,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid #1c1c1e",
              }} />
            </div>
          )}
        </div>
      </div>

      {phraseResult && (
        <div className="section-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Occurrences of "{phraseResult.phrase}"</h3>
            <button onClick={dismissPopover} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#888" }}>✕</button>
          </div>
          {phraseResult.error ? (
            <p style={{ color: "#ef4444" }}>{phraseResult.error}</p>
          ) : phraseResult.article_count === 0 ? (
            <p style={{ color: "#888" }}>No occurrences found in any article.</p>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <span className="stat-pill">{phraseResult.article_count} article{phraseResult.article_count !== 1 ? "s" : ""}</span>
                <span className="stat-pill">{phraseResult.total_occurrences} occurrence{phraseResult.total_occurrences !== 1 ? "s" : ""}</span>
              </div>
              {phraseResult.articles.map((art) => (
                <div key={art.article_id} className="result-card" style={{ marginBottom: 12 }}>
                  <div className="result-header">
                    <strong>{art.title}</strong>
                    <span className="occurrence-badge">{art.occurrence_count}×</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{art.newspaper}</div>
                  {art.occurrences.map((occ, i) => (
                    <div key={i} style={{ fontSize: 13, padding: "6px 0", borderTop: "1px solid #f0f0f0" }}>
                      <span style={{ color: "#888", marginRight: 8 }}>P{occ.paragraph_num} · S{occ.sentence_num}</span>
                      <HighlightPhrase text={occ.sentence_text} phrase={phraseResult.phrase} />
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
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

export default ArticleDetail;
