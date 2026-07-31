import { useState } from "react";

const API_URL = "http://localhost:5000";

async function uploadSingle(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/api/articles/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}

function UploadDocument({ onSuccess }) {
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
    setResults([]);
    setMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setMessage({ type: "error", text: "Please select at least one .txt file" });
      return;
    }

    setLoading(true);
    setResults([]);
    setMessage(null);

    const newResults = [];
    let hasError = false;

    for (const file of files) {
      try {
        const data = await uploadSingle(file);
        newResults.push({ name: file.name, ok: true, data });
      } catch (err) {
        newResults.push({ name: file.name, ok: false, error: err.message });
        hasError = true;
      }
      setResults([...newResults]);
    }

    setLoading(false);

    if (!hasError) {
      setMessage({ type: "success", text: `${files.length} file(s) uploaded and indexed successfully!` });
      setFiles([]);
      e.target.reset();
      onSuccess();
    } else {
      setMessage({ type: "error", text: "One or more files failed to upload." });
    }
  };

  return (
    <div className="upload-section">
      <h2>Upload Articles</h2>
      <p className="upload-hint">
        Upload one or more .txt files. Each file must have a metadata header (TITLE, AUTHOR, NEWSPAPER, DATE, PAGE, TOPIC)
        separated from the body by <code>---</code>
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group full-width" style={{ marginBottom: 16 }}>
          <label>Article Files (.txt)</label>
          <input
            type="file"
            accept=".txt"
            multiple
            onChange={handleFileChange}
          />
          {files.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 13, color: "#555" }}>
              {files.length} file{files.length > 1 ? "s" : ""} selected:
              <ul style={{ margin: "4px 0 0 0", paddingLeft: 18 }}>
                {files.map((f, i) => (
                  <li key={i}>{f.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button className="btn-upload" type="submit" disabled={loading || files.length === 0}>
          {loading
            ? `Uploading… (${results.length}/${files.length})`
            : `Upload & Index${files.length > 1 ? ` (${files.length} files)` : ""}`}
        </button>
      </form>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {results.map((r, i) => (
        <div key={i} className="stats-box" style={{ borderLeft: r.ok ? "4px solid #22c55e" : "4px solid #ef4444" }}>
          <h3>{r.name} — {r.ok ? "✓ Indexed" : "✗ Failed"}</h3>
          {r.ok && r.data.stats && (
            <div className="stats-grid">
              <div className="stat">
                <span className="stat-value">{r.data.stats.word_count}</span>
                <span className="stat-label">Words</span>
              </div>
              <div className="stat">
                <span className="stat-value">{r.data.stats.sentence_count}</span>
                <span className="stat-label">Sentences</span>
              </div>
              <div className="stat">
                <span className="stat-value">{r.data.stats.paragraph_count}</span>
                <span className="stat-label">Paragraphs</span>
              </div>
              <div className="stat">
                <span className="stat-value">{r.data.stats.line_count}</span>
                <span className="stat-label">Lines</span>
              </div>
            </div>
          )}
          {!r.ok && <p style={{ color: "#ef4444" }}>{r.error}</p>}
        </div>
      ))}
    </div>
  );
}

export default UploadDocument;
