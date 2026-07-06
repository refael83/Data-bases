from flask import Blueprint, request, jsonify
from db import get_db

search_bp = Blueprint("search", __name__)


@search_bp.route("/api/search/word", methods=["GET"])
def search_word():
    """Search for a word — returns all occurrences with KWIC context."""
    word = request.args.get("word", "").strip().lower()
    if not word:
        return jsonify({"error": "Parameter 'word' is required"}), 400

    conn = get_db()
    cur = conn.cursor()

    # Get word id
    cur.execute("SELECT id, word_count_total FROM words WHERE word_text = %s", (word,))
    word_row = cur.fetchone()
    if not word_row:
        cur.close()
        conn.close()
        return jsonify({"word": word, "total_occurrences": 0, "articles": []})

    word_id, total_count = word_row

    # Get all occurrences grouped by article
    cur.execute("""
        SELECT
            a.id AS article_id,
            a.title,
            n.name AS newspaper,
            t.name AS topic,
            a.publication_date,
            wo.paragraph_num,
            wo.sentence_num,
            wo.position_in_sentence,
            wo.line_num,
            wo.page_num,
            wo.original_form,
            s.sentence_text
        FROM word_occurrences wo
        JOIN articles a ON wo.article_id = a.id
        JOIN newspapers n ON a.newspaper_id = n.id
        LEFT JOIN topics t ON a.topic_id = t.id
        JOIN sentences s ON wo.sentence_id = s.id
        WHERE wo.word_id = %s
        ORDER BY a.publication_date DESC, wo.paragraph_num, wo.position_in_sentence
    """, (word_id,))

    rows = cur.fetchall()
    columns = [desc[0] for desc in cur.description]

    # Group by article
    articles_map = {}
    for row in rows:
        r = dict(zip(columns, row))
        aid = r["article_id"]
        if aid not in articles_map:
            articles_map[aid] = {
                "article_id": aid,
                "title": r["title"],
                "newspaper": r["newspaper"],
                "topic": r["topic"],
                "publication_date": str(r["publication_date"]) if r["publication_date"] else None,
                "occurrences": [],
            }
        articles_map[aid]["occurrences"].append({
            "paragraph_num": r["paragraph_num"],
            "sentence_num": r["sentence_num"],
            "position_in_sentence": r["position_in_sentence"],
            "line_num": r["line_num"],
            "page_num": r["page_num"],
            "original_form": r["original_form"],
            "sentence_text": r["sentence_text"],
        })

    cur.close()
    conn.close()

    articles = list(articles_map.values())
    for art in articles:
        art["occurrence_count"] = len(art["occurrences"])

    return jsonify({
        "word": word,
        "total_occurrences": total_count,
        "article_count": len(articles),
        "articles": articles,
    })


@search_bp.route("/api/search/metadata", methods=["GET"])
def search_metadata():
    """Search articles by metadata fields."""
    title = request.args.get("title", "")
    author = request.args.get("author", "")
    newspaper = request.args.get("newspaper", "")
    topic = request.args.get("topic", "")
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")

    conditions = []
    values = []

    if title:
        conditions.append("LOWER(a.title) LIKE %s")
        values.append(f"%{title.lower()}%")
    if author:
        conditions.append("LOWER(au.name) LIKE %s")
        values.append(f"%{author.lower()}%")
    if newspaper:
        conditions.append("LOWER(n.name) LIKE %s")
        values.append(f"%{newspaper.lower()}%")
    if topic:
        conditions.append("LOWER(t.name) LIKE %s")
        values.append(f"%{topic.lower()}%")
    if date_from:
        conditions.append("a.publication_date >= %s")
        values.append(date_from)
    if date_to:
        conditions.append("a.publication_date <= %s")
        values.append(date_to)

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    conn = get_db()
    cur = conn.cursor()
    cur.execute(f"""
        SELECT DISTINCT a.id, a.title, a.publication_date, a.word_count,
               a.sentence_count, a.paragraph_count,
               n.name AS newspaper,
               t.name AS topic,
               STRING_AGG(DISTINCT au.name, ', ') AS authors
        FROM articles a
        JOIN newspapers n ON a.newspaper_id = n.id
        LEFT JOIN topics t ON a.topic_id = t.id
        LEFT JOIN article_authors aa ON a.id = aa.article_id
        LEFT JOIN authors au ON aa.author_id = au.id
        {where_clause}
        GROUP BY a.id, n.name, t.name
        ORDER BY a.publication_date DESC
    """, values)

    rows = cur.fetchall()
    columns = [desc[0] for desc in cur.description]
    cur.close()
    conn.close()

    results = []
    for row in rows:
        art = dict(zip(columns, row))
        art["publication_date"] = str(art["publication_date"]) if art["publication_date"] else None
        results.append(art)

    return jsonify(results)


@search_bp.route("/api/search/position", methods=["GET"])
def search_by_position():
    newspaper = request.args.get("newspaper", "").strip()
    article_id = request.args.get("article_id", type=int)
    page_num = request.args.get("page", type=int)
    line_num = request.args.get("line", type=int)
    position = request.args.get("position", type=int)

    if not newspaper:
        return jsonify({"error": "Parameter 'newspaper' is required"}), 400
    if page_num is None or line_num is None or position is None:
        return jsonify({"error": "Parameters 'page', 'line', and 'position' are required"}), 400

    conn = get_db()
    cur = conn.cursor()

    article_filter = ""
    params = [newspaper, page_num, line_num, position]
    if article_id:
        article_filter = "AND a.id = %s"
        params.append(article_id)

    cur.execute(f"""
        SELECT wo.original_form, w.word_text,
               a.title, a.id AS article_id,
               wo.paragraph_num, wo.sentence_num, wo.position_in_sentence,
               wo.line_num, wo.page_num,
               s.sentence_text
        FROM word_occurrences wo
        JOIN words w ON wo.word_id = w.id
        JOIN articles a ON wo.article_id = a.id
        JOIN newspapers n ON a.newspaper_id = n.id
        JOIN sentences s ON wo.sentence_id = s.id
        WHERE LOWER(n.name) = LOWER(%s)
          AND wo.page_num = %s
          AND wo.line_num = %s
          AND wo.position_in_sentence = %s
          {article_filter}
    """, params)

    rows = cur.fetchall()
    columns = [desc[0] for desc in cur.description]
    cur.close()
    conn.close()

    if not rows:
        return jsonify({"found": False, "message": "No word found at this position"})

    results = []
    for row in rows:
        results.append(dict(zip(columns, row)))

    return jsonify({"found": True, "results": results})


@search_bp.route("/api/statistics/words", methods=["GET"])
def word_statistics():
    """Top N most frequent words (excluding stop words)."""
    limit = request.args.get("limit", 10, type=int)
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
    columns = [desc[0] for desc in cur.description]
    cur.close()
    conn.close()

    return jsonify([dict(zip(columns, row)) for row in rows])
