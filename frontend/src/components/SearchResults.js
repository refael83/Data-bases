import AddToGroupButton from "./AddToGroupButton";

function SearchResults({ results, type, onOpenArticle }) {
  if (!results) {
    return (
      <div className="results-section">
        <div className="results-empty">Use the search bar above to find words or articles.</div>
      </div>
    );
  }

  if (type === "word") {
    return <WordResults data={results} onOpenArticle={onOpenArticle} />;
  }

  return <MetadataResults data={results} onOpenArticle={onOpenArticle} />;
}

function WordResults({ data, onOpenArticle }) {
  if (!data.articles || data.articles.length === 0) {
    return (
      <div className="results-section">
        <div className="results-empty">
          No occurrences found for "{data.word}".
        </div>
      </div>
    );
  }

  return (
    <div className="results-section">
      <div className="results-summary">
        <h2>
          Concordance: "{data.word}" <AddToGroupButton word={data.word} />
        </h2>
        <div className="summary-stats">
          <span className="stat-pill">{data.total_occurrences} total occurrences</span>
          <span className="stat-pill">{data.article_count} articles</span>
        </div>
      </div>

      {data.articles.map((art) => (
        <div className="result-card" key={art.article_id}>
          <div className="result-header">
            <h3>
              <button className="link-btn" onClick={() => onOpenArticle && onOpenArticle(art.article_id)}>
                {art.title}
              </button>
            </h3>
            <span className="occurrence-badge">
              {art.occurrence_count} occurrences
            </span>
          </div>
          <div className="result-meta">
            <span>{art.newspaper}</span>
            {art.topic && (
              <>
                <span className="dot">&middot;</span>
                <span className={`badge ${art.topic}`}>{art.topic}</span>
              </>
            )}
            <span className="dot">&middot;</span>
            <span>{art.publication_date}</span>
          </div>

          <div className="kwic-table">
            <table>
              <thead>
                <tr>
                  <th>Para</th>
                  <th>Sent</th>
                  <th>Pos</th>
                  <th>Line</th>
                  <th>Page</th>
                  <th>Context (KWIC)</th>
                </tr>
              </thead>
              <tbody>
                {art.occurrences.map((occ, i) => (
                  <tr key={i}>
                    <td className="num-cell">{occ.paragraph_num}</td>
                    <td className="num-cell">{occ.sentence_num}</td>
                    <td className="num-cell">{occ.position_in_sentence}</td>
                    <td className="num-cell">{occ.line_num}</td>
                    <td className="num-cell">{occ.page_num}</td>
                    <td className="kwic-cell">
                      <HighlightedSentence
                        text={occ.sentence_text}
                        word={occ.original_form}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function HighlightedSentence({ text, word }) {
  if (!text || !word) return <span>{text}</span>;

  const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
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

function MetadataResults({ data, onOpenArticle }) {
  if (!data || data.length === 0) {
    return (
      <div className="results-section">
        <div className="results-empty">No articles found.</div>
      </div>
    );
  }

  return (
    <div className="results-section">
      <h2>Search Results ({data.length} articles)</h2>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Author</th>
            <th>Newspaper</th>
            <th>Topic</th>
            <th>Date</th>
            <th>Words</th>
          </tr>
        </thead>
        <tbody>
          {data.map((art) => (
            <tr key={art.id}>
              <td>
                <button className="link-btn" onClick={() => onOpenArticle && onOpenArticle(art.id)}>
                  {art.title}
                </button>
              </td>
              <td>{art.authors || "-"}</td>
              <td>{art.newspaper || "-"}</td>
              <td>
                {art.topic ? (
                  <span className={`badge ${art.topic}`}>{art.topic}</span>
                ) : (
                  "-"
                )}
              </td>
              <td>{art.publication_date || "-"}</td>
              <td>{art.word_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SearchResults;
