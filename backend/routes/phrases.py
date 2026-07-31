from flask import Blueprint, request, jsonify
from db import get_db

phrases_bp = Blueprint("phrases", __name__)


@phrases_bp.route("/api/phrases", methods=["POST"])
def create_phrase():
    data = request.get_json()
    phrase_text = data.get("phrase_text", "").strip()
    name = data.get("name", "")
    if not phrase_text:
        return jsonify({"error": "phrase_text is required"}), 400

    words = phrase_text.lower().split()
    if len(words) < 2:
        return jsonify({"error": "Phrase must contain at least 2 words"}), 400

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute(
            "INSERT INTO phrases (phrase_text, user_defined_name, word_count) VALUES (%s, %s, %s) RETURNING id",
            (phrase_text.lower(), name or None, len(words)),
        )
        phrase_id = cur.fetchone()[0]

        for pos, w in enumerate(words, 1):
            cur.execute("SELECT id FROM words WHERE word_text = %s", (w,))
            row = cur.fetchone()
            word_id = row[0] if row else None
            if word_id:
                cur.execute(
                    "INSERT INTO phrase_words (phrase_id, word_id, position) VALUES (%s, %s, %s)",
                    (phrase_id, word_id, pos),
                )

        conn.commit()
        return jsonify({"id": phrase_id, "phrase_text": phrase_text.lower(), "word_count": len(words)}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@phrases_bp.route("/api/phrases", methods=["GET"])
def list_phrases():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, phrase_text, user_defined_name, word_count, created_at
        FROM phrases ORDER BY created_at DESC
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


@phrases_bp.route("/api/phrases/<int:pid>", methods=["DELETE"])
def delete_phrase(pid):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM phrases WHERE id = %s", (pid,))
    if cur.rowcount == 0:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({"error": "Phrase not found"}), 404
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "Phrase deleted"})


@phrases_bp.route("/api/phrases/<int:pid>/search", methods=["GET"])
def search_phrase(pid):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT phrase_text, word_count FROM phrases WHERE id = %s", (pid,))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return jsonify({"error": "Phrase not found"}), 404

    phrase_text, word_count = row
    phrase_words = phrase_text.split()

    if len(phrase_words) < 2:
        cur.close()
        conn.close()
        return jsonify({"error": "Invalid phrase"}), 400

    # Build dynamic query: join word_occurrences N times
    # wo1.word = phrase_words[0], wo2.word = phrase_words[1], ...
    # wo2.sentence_id = wo1.sentence_id AND wo2.position = wo1.position + 1
    joins = []
    conditions = []
    for i, w in enumerate(phrase_words):
        alias = f"wo{i}"
        walias = f"w{i}"
        if i == 0:
            joins.append(f"word_occurrences {alias}")
            joins.append(f"JOIN words {walias} ON {alias}.word_id = {walias}.id")
        else:
            prev = f"wo{i-1}"
            joins.append(
                f"JOIN word_occurrences {alias} ON {alias}.sentence_id = {prev}.sentence_id "
                f"AND {alias}.position_in_sentence = {prev}.position_in_sentence + 1"
            )
            joins.append(f"JOIN words {walias} ON {alias}.word_id = {walias}.id")
        conditions.append(f"{walias}.word_text = %s")

    query = f"""
        SELECT DISTINCT wo0.article_id, a.title, n.name AS newspaper,
               (SELECT STRING_AGG(wo_r.original_form, ' ' ORDER BY wo_r.position_in_sentence)
                FROM word_occurrences wo_r WHERE wo_r.sentence_id = wo0.sentence_id) AS sentence_text,
               wo0.paragraph_num, wo0.sentence_num,
               wo0.position_in_sentence, wo0.line_num, wo0.page_num
        FROM {' '.join(joins)}
        JOIN articles a ON wo0.article_id = a.id
        JOIN newspapers n ON a.newspaper_id = n.id
        WHERE {' AND '.join(conditions)}
        ORDER BY wo0.article_id, wo0.paragraph_num, wo0.position_in_sentence
    """

    cur.execute(query, phrase_words)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    cur.close()
    conn.close()

    occurrences = [dict(zip(cols, r)) for r in rows]

    articles_map = {}
    for occ in occurrences:
        aid = occ["article_id"]
        if aid not in articles_map:
            articles_map[aid] = {
                "article_id": aid,
                "title": occ["title"],
                "newspaper": occ["newspaper"],
                "occurrences": [],
            }
        articles_map[aid]["occurrences"].append(occ)

    articles = list(articles_map.values())
    for art in articles:
        art["occurrence_count"] = len(art["occurrences"])

    return jsonify({
        "phrase": phrase_text,
        "total_occurrences": len(rows),
        "article_count": len(articles),
        "articles": articles,
    })
