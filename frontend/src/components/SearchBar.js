import { useState } from "react";

const API_URL = "http://localhost:5000";

function SearchBar({ onResults }) {
  const [searchMode, setSearchMode] = useState("word");
  const [word, setWord] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [newspaper, setNewspaper] = useState("");
  const [topic, setTopic] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleWordSearch = async (e) => {
    e.preventDefault();
    if (!word.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/search/word?word=${encodeURIComponent(word)}`
      );
      const data = await res.json();
      onResults(data, "word");
    } catch {
      onResults(null, "word");
    }
    setLoading(false);
  };

  const handleMetadataSearch = async (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (title) params.append("title", title);
    if (author) params.append("author", author);
    if (newspaper) params.append("newspaper", newspaper);
    if (topic) params.append("topic", topic);
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/search/metadata?${params}`);
      const data = await res.json();
      onResults(data, "metadata");
    } catch {
      onResults([], "metadata");
    }
    setLoading(false);
  };

  return (
    <div className="search-section">
      <div className="search-tabs">
        <button
          className={searchMode === "word" ? "active" : ""}
          onClick={() => setSearchMode("word")}
        >
          Word Search (KWIC)
        </button>
        <button
          className={searchMode === "metadata" ? "active" : ""}
          onClick={() => setSearchMode("metadata")}
        >
          Metadata Search
        </button>
      </div>

      {searchMode === "word" ? (
        <form className="search-form" onSubmit={handleWordSearch}>
          <input
            type="text"
            placeholder="Enter a word to search..."
            value={word}
            onChange={(e) => setWord(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn-search" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      ) : (
        <form className="search-form metadata-form" onSubmit={handleMetadataSearch}>
          <div className="form-grid">
            <div className="form-group">
              <label>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Author</label>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Newspaper</label>
              <input
                value={newspaper}
                onChange={(e) => setNewspaper(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Topic</label>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
            <div className="form-group">
              <label>From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="btn-search" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      )}
    </div>
  );
}

export default SearchBar;
