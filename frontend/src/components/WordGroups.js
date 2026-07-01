import { useState, useEffect } from "react";

const API_URL = "http://localhost:5000";

function WordGroups() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [wordText, setWordText] = useState("");
  const [occurrences, setOccurrences] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchGroups = () => {
    fetch(`${API_URL}/api/groups`)
      .then((r) => r.json())
      .then((data) => {
        setGroups(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const createGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_name: groupName, description: groupDesc }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Group "${groupName}" created` });
        setGroupName("");
        setGroupDesc("");
        fetchGroups();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    }
  };

  const deleteGroup = async (gid) => {
    try {
      await fetch(`${API_URL}/api/groups/${gid}`, { method: "DELETE" });
      if (selectedGroup?.id === gid) {
        setSelectedGroup(null);
        setOccurrences(null);
      }
      fetchGroups();
    } catch {}
  };

  const selectGroup = async (gid) => {
    try {
      const res = await fetch(`${API_URL}/api/groups/${gid}`);
      const data = await res.json();
      setSelectedGroup(data);
      setOccurrences(null);
    } catch {}
  };

  const addWord = async (e) => {
    e.preventDefault();
    if (!wordText.trim() || !selectedGroup) return;
    try {
      const res = await fetch(`${API_URL}/api/groups/${selectedGroup.id}/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word_text: wordText }),
      });
      const data = await res.json();
      if (res.ok) {
        setWordText("");
        selectGroup(selectedGroup.id);
        fetchGroups();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    }
  };

  const removeWord = async (wordId) => {
    if (!selectedGroup) return;
    try {
      await fetch(`${API_URL}/api/groups/${selectedGroup.id}/words/${wordId}`, {
        method: "DELETE",
      });
      selectGroup(selectedGroup.id);
      fetchGroups();
    } catch {}
  };

  const searchOccurrences = async () => {
    if (!selectedGroup) return;
    try {
      const res = await fetch(`${API_URL}/api/groups/${selectedGroup.id}/occurrences`);
      const data = await res.json();
      setOccurrences(data);
    } catch {}
  };

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="groups-page">
      <h2 className="page-title">Word Groups</h2>

      <div className="two-panel">
        <div className="panel">
          <h3>Create Group</h3>
          <form onSubmit={createGroup} className="inline-form">
            <input
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <input
              placeholder="Description (optional)"
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
            />
            <button type="submit" className="btn-primary">Create</button>
          </form>

          {message && (
            <div className={`message ${message.type}`}>{message.text}</div>
          )}

          <h3>Groups ({groups.length})</h3>
          {groups.length === 0 ? (
            <p className="text-muted">No groups created yet.</p>
          ) : (
            <div className="group-list">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className={`group-item ${selectedGroup?.id === g.id ? "active" : ""}`}
                  onClick={() => selectGroup(g.id)}
                >
                  <div className="group-item-info">
                    <strong>{g.group_name}</strong>
                    <span className="text-muted">{g.word_count} words</span>
                  </div>
                  <button
                    className="btn-danger-sm"
                    onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          {selectedGroup ? (
            <>
              <h3>{selectedGroup.group_name}</h3>
              {selectedGroup.description && (
                <p className="text-muted">{selectedGroup.description}</p>
              )}

              <form onSubmit={addWord} className="inline-form">
                <input
                  placeholder="Add word to group..."
                  value={wordText}
                  onChange={(e) => setWordText(e.target.value)}
                />
                <button type="submit" className="btn-primary">Add</button>
              </form>

              {selectedGroup.words.length > 0 && (
                <div className="word-chips">
                  {selectedGroup.words.map((w) => (
                    <span key={w.id} className="word-chip">
                      {w.word_text}
                      <span className="chip-count">({w.count})</span>
                      <button onClick={() => removeWord(w.id)}>&times;</button>
                    </span>
                  ))}
                </div>
              )}

              {selectedGroup.words.length > 0 && (
                <button className="btn-secondary" onClick={searchOccurrences}>
                  Search All Occurrences
                </button>
              )}

              {occurrences && (
                <div className="occurrences-result">
                  <h4>
                    {occurrences.group_name} - {occurrences.total_occurrences} occurrences
                  </h4>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Word</th>
                        <th>Article</th>
                        <th>Para</th>
                        <th>Sent</th>
                        <th>Pos</th>
                        <th>Context</th>
                      </tr>
                    </thead>
                    <tbody>
                      {occurrences.occurrences.slice(0, 100).map((occ, i) => (
                        <tr key={i}>
                          <td><strong>{occ.word_text}</strong></td>
                          <td>{occ.title}</td>
                          <td className="num-cell">{occ.paragraph_num}</td>
                          <td className="num-cell">{occ.sentence_num}</td>
                          <td className="num-cell">{occ.position_in_sentence}</td>
                          <td className="kwic-cell">{occ.sentence_text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {occurrences.occurrences.length > 100 && (
                    <p className="text-muted">
                      Showing 100 of {occurrences.total_occurrences} occurrences.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="empty-panel">
              Select a group to view its words and search occurrences.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WordGroups;
