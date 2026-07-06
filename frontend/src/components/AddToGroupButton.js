import { useState, useEffect, useRef } from "react";

const API_URL = "http://localhost:5000";

function AddToGroupButton({ word }) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    fetch(`${API_URL}/api/groups`)
      .then((r) => r.json())
      .then(setGroups)
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const addToGroup = async (gid) => {
    try {
      const res = await fetch(`${API_URL}/api/groups/${gid}/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word_text: word }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("ok");
      } else {
        setStatus(data.error || "Error");
      }
    } catch {
      setStatus("Connection error");
    }
    setTimeout(() => {
      setStatus(null);
      setOpen(false);
    }, 1500);
  };

  return (
    <span className="add-to-group-wrap" ref={ref}>
      <button
        className="btn-add-group"
        onClick={() => {
          setOpen(!open);
          setStatus(null);
        }}
        title="Add to word group"
      >
        +G
      </button>
      {open && (
        <div className="group-dropdown">
          {status === "ok" ? (
            <div className="group-dropdown-msg success">Added!</div>
          ) : status ? (
            <div className="group-dropdown-msg error">{status}</div>
          ) : groups.length === 0 ? (
            <div className="group-dropdown-msg">No groups yet</div>
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                className="group-dropdown-item"
                onClick={() => addToGroup(g.id)}
              >
                {g.group_name}
                <span className="text-muted"> ({g.word_count})</span>
              </button>
            ))
          )}
        </div>
      )}
    </span>
  );
}

export default AddToGroupButton;
