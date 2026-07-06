import { useState, useEffect } from "react";

const API_URL = "http://localhost:5000";

function DocumentList({ onOpenArticle }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/articles`)
      .then((res) => res.json())
      .then((data) => {
        setArticles(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading articles...</p>;

  return (
    <div className="documents-section">
      <h2>Articles ({articles.length})</h2>
      {articles.length === 0 ? (
        <p>No articles loaded yet.</p>
      ) : (
        <table className="doc-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Newspaper</th>
              <th>Country</th>
              <th>Website</th>
              <th>Topic</th>
              <th>Date</th>
              <th>Path</th>
              <th>Words</th>
              <th>Sentences</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((art) => (
              <tr key={art.id}>
                <td>
                  <button className="link-btn" onClick={() => onOpenArticle && onOpenArticle(art.id)}>
                    {art.title}
                  </button>
                </td>
                <td>{art.authors || "-"}</td>
                <td>{art.newspaper || "-"}</td>
                <td>{art.newspaper_country || "-"}</td>
                <td>
                  {art.newspaper_website ? (
                    <a href={art.newspaper_website} target="_blank" rel="noreferrer">
                      {art.newspaper_website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                    </a>
                  ) : "-"}
                </td>
                <td>
                  {art.topic ? (
                    <span className={`badge ${art.topic}`}>{art.topic}</span>
                  ) : (
                    "-"
                  )}
                </td>
                <td>{art.publication_date || "-"}</td>
                <td>{art.file_path || "-"}</td>
                <td>{art.word_count}</td>
                <td>{art.sentence_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default DocumentList;
