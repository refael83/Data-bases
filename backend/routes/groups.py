from flask import Blueprint, request, jsonify
from db import get_db

groups_bp = Blueprint("groups", __name__)


@groups_bp.route("/api/groups", methods=["POST"])
def create_group():
    data = request.get_json()
    name = data.get("group_name", "").strip()
    description = data.get("description", "")
    if not name:
        return jsonify({"error": "group_name is required"}), 400

    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO word_groups (group_name, description) VALUES (%s, %s) RETURNING id",
            (name, description),
        )
        gid = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": gid, "group_name": name}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@groups_bp.route("/api/groups", methods=["GET"])
def list_groups():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT g.id, g.group_name, g.description, g.created_at,
               COUNT(gm.word_id) AS word_count
        FROM word_groups g
        LEFT JOIN word_group_members gm ON g.id = gm.group_id
        GROUP BY g.id
        ORDER BY g.group_name
    """)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    cur.close()
    conn.close()
    result = []
    for r in rows:
        d = dict(zip(cols, r))
        d["created_at"] = str(d["created_at"]) if d["created_at"] else None
        result.append(d)
    return jsonify(result)


@groups_bp.route("/api/groups/<int:gid>", methods=["GET"])
def get_group(gid):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, group_name, description FROM word_groups WHERE id = %s", (gid,))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return jsonify({"error": "Group not found"}), 404

    group = {"id": row[0], "group_name": row[1], "description": row[2]}

    cur.execute("""
        SELECT w.id, w.word_text, w.word_count_total
        FROM words w
        JOIN word_group_members gm ON w.id = gm.word_id
        WHERE gm.group_id = %s
        ORDER BY w.word_text
    """, (gid,))
    group["words"] = [{"id": r[0], "word_text": r[1], "count": r[2]} for r in cur.fetchall()]

    cur.close()
    conn.close()
    return jsonify(group)


@groups_bp.route("/api/groups/<int:gid>", methods=["DELETE"])
def delete_group(gid):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM word_groups WHERE id = %s", (gid,))
    if cur.rowcount == 0:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({"error": "Group not found"}), 404
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "Group deleted"})


@groups_bp.route("/api/groups/<int:gid>/words", methods=["POST"])
def add_word_to_group(gid):
    data = request.get_json()
    word_text = data.get("word_text", "").strip().lower()
    if not word_text:
        return jsonify({"error": "word_text is required"}), 400

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id FROM words WHERE word_text = %s", (word_text,))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return jsonify({"error": f"Word '{word_text}' not found in corpus"}), 404

    word_id = row[0]
    try:
        cur.execute(
            "INSERT INTO word_group_members (group_id, word_id) VALUES (%s, %s)",
            (gid, word_id),
        )
        conn.commit()
        return jsonify({"message": f"'{word_text}' added to group"}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@groups_bp.route("/api/groups/<int:gid>/words/<int:word_id>", methods=["DELETE"])
def remove_word_from_group(gid, word_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM word_group_members WHERE group_id = %s AND word_id = %s",
        (gid, word_id),
    )
    if cur.rowcount == 0:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({"error": "Word not in group"}), 404
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "Word removed from group"})


@groups_bp.route("/api/groups/<int:gid>/occurrences", methods=["GET"])
def group_occurrences(gid):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT group_name FROM word_groups WHERE id = %s", (gid,))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return jsonify({"error": "Group not found"}), 404

    group_name = row[0]

    cur.execute("""
        SELECT w.word_text, a.title, n.name AS newspaper, s.sentence_text,
               wo.paragraph_num, wo.sentence_num, wo.position_in_sentence,
               wo.line_num, wo.page_num, wo.original_form
        FROM word_occurrences wo
        JOIN word_group_members gm ON wo.word_id = gm.word_id AND gm.group_id = %s
        JOIN words w ON wo.word_id = w.id
        JOIN articles a ON wo.article_id = a.id
        JOIN newspapers n ON a.newspaper_id = n.id
        JOIN sentences s ON wo.sentence_id = s.id
        ORDER BY w.word_text, a.title, wo.paragraph_num, wo.position_in_sentence
    """, (gid,))

    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    cur.close()
    conn.close()

    return jsonify({
        "group_name": group_name,
        "total_occurrences": len(rows),
        "occurrences": [dict(zip(cols, r)) for r in rows],
    })
