from flask import Blueprint, request, jsonify
from db import get_db

statistics_bp = Blueprint("statistics", __name__)


@statistics_bp.route("/api/statistics/overview", methods=["GET"])
def overview():
    conn = get_db()
    cur = conn.cursor()

    stats = {}
    cur.execute("SELECT COUNT(*) FROM articles")
    stats["total_articles"] = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM words")
    stats["unique_words"] = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM word_occurrences")
    stats["total_occurrences"] = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM sentences")
    stats["total_sentences"] = cur.fetchone()[0]

    cur.execute("SELECT COALESCE(SUM(paragraph_count), 0) FROM articles")
    stats["total_paragraphs"] = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM newspapers")
    stats["total_newspapers"] = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM authors")
    stats["total_authors"] = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM word_groups")
    stats["total_groups"] = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM phrases")
    stats["total_phrases"] = cur.fetchone()[0]

    cur.close()
    conn.close()
    return jsonify(stats)


@statistics_bp.route("/api/statistics/words", methods=["GET"])
def top_words():
    limit = request.args.get("limit", 20, type=int)
    include_stop = request.args.get("include_stop", "false") == "true"

    conn = get_db()
    cur = conn.cursor()

    stop_filter = "" if include_stop else "WHERE w.is_stop_word = FALSE"
    cur.execute(f"""
        SELECT w.word_text, w.word_length, w.word_count_total,
               COUNT(DISTINCT wo.article_id) AS article_count
        FROM words w
        JOIN word_occurrences wo ON w.id = wo.word_id
        {stop_filter}
        GROUP BY w.id
        ORDER BY w.word_count_total DESC
        LIMIT %s
    """, (limit,))

    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    cur.close()
    conn.close()
    return jsonify([dict(zip(cols, r)) for r in rows])


@statistics_bp.route("/api/statistics/word/<word>", methods=["GET"])
def word_detail(word):
    word = word.lower()
    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT id, word_text, word_length, word_count_total, is_stop_word FROM words WHERE word_text = %s",
        (word,),
    )
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return jsonify({"error": "Word not found"}), 404

    word_id = row[0]
    info = {
        "word_text": row[1],
        "word_length": row[2],
        "word_count_total": row[3],
        "is_stop_word": row[4],
    }

    # Distribution across articles
    cur.execute("""
        SELECT a.id, a.title, COUNT(*) AS count
        FROM word_occurrences wo
        JOIN articles a ON wo.article_id = a.id
        WHERE wo.word_id = %s
        GROUP BY a.id, a.title
        ORDER BY count DESC
    """, (word_id,))
    info["article_distribution"] = [
        {"article_id": r[0], "title": r[1], "count": r[2]}
        for r in cur.fetchall()
    ]

    # Distribution by paragraph position
    cur.execute("""
        SELECT paragraph_num, COUNT(*) AS count
        FROM word_occurrences WHERE word_id = %s
        GROUP BY paragraph_num ORDER BY paragraph_num
    """, (word_id,))
    info["paragraph_distribution"] = [
        {"paragraph_num": r[0], "count": r[1]} for r in cur.fetchall()
    ]

    # Groups containing this word
    cur.execute("""
        SELECT g.id, g.group_name FROM word_groups g
        JOIN word_group_members gm ON g.id = gm.group_id
        WHERE gm.word_id = %s
    """, (word_id,))
    info["groups"] = [{"id": r[0], "name": r[1]} for r in cur.fetchall()]

    cur.close()
    conn.close()
    return jsonify(info)


@statistics_bp.route("/api/statistics/length-distribution", methods=["GET"])
def length_distribution():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT word_length, COUNT(*) AS unique_count,
               SUM(word_count_total) AS total_occurrences
        FROM words
        WHERE word_count_total > 0
        GROUP BY word_length
        ORDER BY word_length
    """)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    cur.close()
    conn.close()
    return jsonify([dict(zip(cols, r)) for r in rows])


@statistics_bp.route("/api/statistics/article/<int:article_id>", methods=["GET"])
def article_stats(article_id):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id, title FROM articles WHERE id = %s", (article_id,))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return jsonify({"error": "Article not found"}), 404

    info = {"article_id": row[0], "title": row[1]}

    cur.execute("""
        SELECT w.word_text, COUNT(*) AS count
        FROM word_occurrences wo
        JOIN words w ON wo.word_id = w.id
        WHERE wo.article_id = %s AND w.is_stop_word = FALSE
        GROUP BY w.word_text
        ORDER BY count DESC
        LIMIT 20
    """, (article_id,))
    info["top_words"] = [{"word": r[0], "count": r[1]} for r in cur.fetchall()]

    cur.execute("""
        SELECT COUNT(DISTINCT wo.word_id) FROM word_occurrences wo
        JOIN words w ON wo.word_id = w.id
        WHERE wo.article_id = %s AND w.is_stop_word = FALSE
    """, (article_id,))
    info["unique_content_words"] = cur.fetchone()[0]

    cur.close()
    conn.close()
    return jsonify(info)
