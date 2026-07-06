import { useState, useEffect } from "react";

const API_URL = "http://localhost:5000";

function ArticleDetail({ articleId, onBack }) {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/articles/${articleId}`)
      .then((r) => r.json())
      .then((data) => {
        setArticle(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [articleId]);

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
        <div className="article-text">
          {Object.keys(grouped)
            .sort((a, b) => Number(a) - Number(b))
            .map((paraNum) => (
              <p key={paraNum} className="article-paragraph">
                <span className="para-num">P{paraNum}</span>
                {grouped[paraNum]
                  .sort((a, b) => a.sentence_num - b.sentence_num)
                  .map((s, i) => (
                    <span key={i}>{s.text} </span>
                  ))}
              </p>
            ))}
        </div>
      </div>
    </div>
  );
}

export default ArticleDetail;
