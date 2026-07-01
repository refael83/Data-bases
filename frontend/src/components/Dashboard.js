import { useState, useEffect } from "react";

const API_URL = "http://localhost:5000";

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [topWords, setTopWords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/statistics/overview`).then((r) => r.json()),
      fetch(`${API_URL}/api/statistics/words?limit=10`).then((r) => r.json()),
    ])
      .then(([overview, words]) => {
        setStats(overview);
        setTopWords(words);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">Loading dashboard...</div>;

  return (
    <div className="dashboard-page">
      <h2 className="page-title">Dashboard</h2>

      <div className="stats-cards">
        <div className="stats-card">
          <div className="stats-card-value">{stats?.total_articles || 0}</div>
          <div className="stats-card-label">Articles</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-value">{stats?.unique_words || 0}</div>
          <div className="stats-card-label">Unique Words</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-value">{stats?.total_occurrences || 0}</div>
          <div className="stats-card-label">Total Occurrences</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-value">{stats?.total_sentences || 0}</div>
          <div className="stats-card-label">Sentences</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-value">{stats?.total_paragraphs || 0}</div>
          <div className="stats-card-label">Paragraphs</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-value">{stats?.total_newspapers || 0}</div>
          <div className="stats-card-label">Newspapers</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-value">{stats?.total_authors || 0}</div>
          <div className="stats-card-label">Authors</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-value">{stats?.total_groups || 0}</div>
          <div className="stats-card-label">Word Groups</div>
        </div>
      </div>

      {topWords.length > 0 && (
        <div className="dashboard-section">
          <h3>Top 10 Content Words</h3>
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
                <tr key={w.word_text}>
                  <td className="num-cell">{i + 1}</td>
                  <td><strong>{w.word_text}</strong></td>
                  <td className="num-cell">{w.word_length}</td>
                  <td className="num-cell">{w.word_count_total}</td>
                  <td className="num-cell">{w.article_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
