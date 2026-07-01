import { useState } from "react";

const API_URL = "http://localhost:5000";

function UploadDocument({ onSuccess }) {
  const [file, setFile] = useState(null);
  const [filePath, setFilePath] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setMessage({ type: "error", text: "Please select a .txt file" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    if (filePath.trim()) {
      formData.append("file_path", filePath.trim());
    }

    setLoading(true);
    setStats(null);
    try {
      const res = await fetch(`${API_URL}/api/articles/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: `Article loaded and indexed! ID: ${data.article_id}`,
        });
        setStats(data.stats);
        setFile(null);
        setFilePath("");
        e.target.reset();
        onSuccess();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Could not connect to server" });
    }
    setLoading(false);
  };

  return (
    <div className="upload-section">
      <h2>Upload Article</h2>
      <p className="upload-hint">
        Upload a .txt file with metadata header (TITLE, AUTHOR, NEWSPAPER, DATE, PAGE, TOPIC)
        separated from the body by <code>---</code>
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group full-width">
            <label>Article File (.txt)</label>
            <input
              type="file"
              accept=".txt"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>
          <div className="form-group full-width">
            <label>File Path on Computer</label>
            <input
              type="text"
              placeholder="e.g. C:\Documents\articles\article1.txt"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-upload" type="submit" disabled={loading}>
          {loading ? "Loading & Indexing..." : "Upload & Index"}
        </button>
      </form>
      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}
      {stats && (
        <div className="stats-box">
          <h3>Indexing Results</h3>
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-value">{stats.word_count}</span>
              <span className="stat-label">Words</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.sentence_count}</span>
              <span className="stat-label">Sentences</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.paragraph_count}</span>
              <span className="stat-label">Paragraphs</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.line_count}</span>
              <span className="stat-label">Lines</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadDocument;
