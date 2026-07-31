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


@statistics_bp.route("/api/statistics/compare-articles", methods=["POST"])
def compare_articles():
    data = request.get_json()
    article_ids = data.get("article_ids", [])
    include_stop = data.get("include_stop", False)
    limit = data.get("limit", 50)

    if not article_ids or len(article_ids) < 1:
        return jsonify({"error": "At least one article ID is required"}), 400

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT id, title FROM articles WHERE id = ANY(%s) ORDER BY title",
        (article_ids,),
    )
    articles = [{"id": r[0], "title": r[1]} for r in cur.fetchall()]
    if not articles:
        cur.close()
        conn.close()
        return jsonify({"error": "No articles found"}), 404

    found_ids = [a["id"] for a in articles]

    stop_filter = "" if include_stop else "AND w.is_stop_word = FALSE"

    limit_clause = "" if limit <= 0 else "LIMIT %s"
    params = (found_ids,) if limit <= 0 else (found_ids, limit)

    cur.execute(f"""
        SELECT w.word_text, w.word_length,
               COUNT(*) AS total_count,
               COUNT(DISTINCT wo.article_id) AS article_count,
               w.word_count_total AS global_count
        FROM word_occurrences wo
        JOIN words w ON wo.word_id = w.id
        WHERE wo.article_id = ANY(%s) {stop_filter}
        GROUP BY w.id
        ORDER BY total_count DESC
        {limit_clause}
    """, params)
    top_words = cur.fetchall()

    word_texts = [r[0] for r in top_words]

    cur.execute("""
        SELECT w.word_text, wo.article_id, COUNT(*) AS cnt
        FROM word_occurrences wo
        JOIN words w ON wo.word_id = w.id
        WHERE wo.article_id = ANY(%s) AND w.word_text = ANY(%s)
        GROUP BY w.word_text, wo.article_id
    """, (found_ids, word_texts))

    per_article_map = {}
    for r in cur.fetchall():
        if r[0] not in per_article_map:
            per_article_map[r[0]] = {}
        per_article_map[r[0]][str(r[1])] = r[2]

    words = []
    for r in top_words:
        words.append({
            "word": r[0],
            "length": r[1],
            "total_count": r[2],
            "article_count": r[3],
            "global_count": r[4],
            "per_article": per_article_map.get(r[0], {}),
        })

    cur.close()
    conn.close()
    return jsonify({"articles": articles, "words": words})


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


@statistics_bp.route("/api/statistics/detailed", methods=["GET"])
def detailed_stats():
    article_id = request.args.get("article_id", type=int)

    conn = get_db()
    cur = conn.cursor()

    if article_id:
        cur.execute("SELECT id, title FROM articles WHERE id = %s", (article_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return jsonify({"error": "Article not found"}), 404

        # Characters per word
        cur.execute("""
            SELECT MIN(LENGTH(wo.original_form)) AS min_val,
                   MAX(LENGTH(wo.original_form)) AS max_val,
                   ROUND(AVG(LENGTH(wo.original_form)), 2) AS avg_val,
                   COUNT(*) AS total
            FROM word_occurrences wo WHERE wo.article_id = %s
        """, (article_id,))
        chars_per_word = dict(zip([d[0] for d in cur.description], cur.fetchone()))

        # Characters per sentence
        cur.execute("""
            SELECT MIN(s.char_count) AS min_val,
                   MAX(s.char_count) AS max_val,
                   ROUND(AVG(s.char_count), 2) AS avg_val,
                   COUNT(*) AS total
            FROM sentences s WHERE s.article_id = %s
        """, (article_id,))
        chars_per_sentence = dict(zip([d[0] for d in cur.description], cur.fetchone()))

        # Characters per paragraph
        cur.execute("""
            SELECT paragraph_num, SUM(char_count) AS chars
            FROM sentences WHERE article_id = %s
            GROUP BY paragraph_num
        """, (article_id,))
        para_chars = [r[1] for r in cur.fetchall()]
        chars_per_paragraph = {
            "min_val": min(para_chars) if para_chars else 0,
            "max_val": max(para_chars) if para_chars else 0,
            "avg_val": round(sum(para_chars) / len(para_chars), 2) if para_chars else 0,
            "total": sum(para_chars) if para_chars else 0,
        }

        # Words per sentence
        cur.execute("""
            SELECT wo.sentence_id, COUNT(*) AS cnt
            FROM word_occurrences wo WHERE wo.article_id = %s
            GROUP BY wo.sentence_id
        """, (article_id,))
        wps = [r[1] for r in cur.fetchall()]
        words_per_sentence = {
            "min_val": min(wps) if wps else 0,
            "max_val": max(wps) if wps else 0,
            "avg_val": round(sum(wps) / len(wps), 2) if wps else 0,
        }

        # Words per paragraph
        cur.execute("""
            SELECT wo.paragraph_num, COUNT(*) AS cnt
            FROM word_occurrences wo WHERE wo.article_id = %s
            GROUP BY wo.paragraph_num
        """, (article_id,))
        wpp = [r[1] for r in cur.fetchall()]
        words_per_paragraph = {
            "min_val": min(wpp) if wpp else 0,
            "max_val": max(wpp) if wpp else 0,
            "avg_val": round(sum(wpp) / len(wpp), 2) if wpp else 0,
        }

        # Sentences per paragraph
        cur.execute("""
            SELECT paragraph_num, COUNT(*) AS cnt
            FROM sentences WHERE article_id = %s
            GROUP BY paragraph_num
        """, (article_id,))
        spp = [r[1] for r in cur.fetchall()]
        sentences_per_paragraph = {
            "min_val": min(spp) if spp else 0,
            "max_val": max(spp) if spp else 0,
            "avg_val": round(sum(spp) / len(spp), 2) if spp else 0,
        }

        # Totals
        cur.execute("SELECT word_count, sentence_count, paragraph_count FROM articles WHERE id = %s", (article_id,))
        totals = cur.fetchone()

        cur.close()
        conn.close()

        total_chars = chars_per_paragraph["total"]
        total_words = totals[0]
        total_sentences = totals[1]
        total_paragraphs = totals[2]

        return jsonify({
            "article_id": article_id,
            "title": row[1],
            "totals": {
                "words": total_words,
                "sentences": total_sentences,
                "paragraphs": total_paragraphs,
                "characters": total_chars,
            },
            "chars_per_word": chars_per_word,
            "chars_per_sentence": chars_per_sentence,
            "chars_per_paragraph": chars_per_paragraph,
            "chars_per_article": {"min_val": total_chars, "max_val": total_chars, "avg_val": total_chars},
            "words_per_sentence": words_per_sentence,
            "words_per_paragraph": words_per_paragraph,
            "words_per_article": {"min_val": total_words, "max_val": total_words, "avg_val": total_words},
            "sentences_per_paragraph": sentences_per_paragraph,
            "sentences_per_article": {"min_val": total_sentences, "max_val": total_sentences, "avg_val": total_sentences},
            "paragraphs_per_article": {"min_val": total_paragraphs, "max_val": total_paragraphs, "avg_val": total_paragraphs},
        })

    else:
        # Global stats across all articles
        cur.execute("""
            SELECT MIN(LENGTH(wo.original_form)), MAX(LENGTH(wo.original_form)),
                   ROUND(AVG(LENGTH(wo.original_form)), 2), COUNT(*)
            FROM word_occurrences wo
        """)
        r = cur.fetchone()
        chars_per_word = {"min_val": r[0], "max_val": r[1], "avg_val": r[2], "total": r[3]}

        cur.execute("""
            SELECT MIN(s.char_count), MAX(s.char_count),
                   ROUND(AVG(s.char_count), 2), COUNT(*)
            FROM sentences s
        """)
        r = cur.fetchone()
        chars_per_sentence = {"min_val": r[0], "max_val": r[1], "avg_val": r[2], "total": r[3]}

        cur.execute("""
            SELECT MIN(pc), MAX(pc), ROUND(AVG(pc), 2), SUM(pc)
            FROM (SELECT SUM(char_count) AS pc
                  FROM sentences GROUP BY article_id, paragraph_num) sub
        """)
        r = cur.fetchone()
        chars_per_paragraph = {"min_val": r[0], "max_val": r[1], "avg_val": r[2], "total": r[3]}

        cur.execute("""
            SELECT MIN(wc), MAX(wc), ROUND(AVG(wc), 2)
            FROM (SELECT COUNT(*) AS wc FROM word_occurrences
                  GROUP BY article_id, sentence_id) sub
        """)
        r = cur.fetchone()
        words_per_sentence = {"min_val": r[0], "max_val": r[1], "avg_val": r[2]}

        cur.execute("""
            SELECT MIN(wc), MAX(wc), ROUND(AVG(wc), 2)
            FROM (SELECT COUNT(*) AS wc FROM word_occurrences
                  GROUP BY article_id, paragraph_num) sub
        """)
        r = cur.fetchone()
        words_per_paragraph = {"min_val": r[0], "max_val": r[1], "avg_val": r[2]}

        cur.execute("""
            SELECT MIN(sc), MAX(sc), ROUND(AVG(sc), 2)
            FROM (SELECT COUNT(*) AS sc FROM sentences
                  GROUP BY article_id, paragraph_num) sub
        """)
        r = cur.fetchone()
        sentences_per_paragraph = {"min_val": r[0], "max_val": r[1], "avg_val": r[2]}

        cur.execute("""
            SELECT MIN(pc), MAX(pc), ROUND(AVG(pc), 2)
            FROM (SELECT paragraph_count AS pc FROM articles) sub
        """)
        r = cur.fetchone()
        paragraphs_per_article = {"min_val": r[0], "max_val": r[1], "avg_val": r[2]}

        cur.execute("""
            SELECT MIN(wc), MAX(wc), ROUND(AVG(wc), 2)
            FROM (SELECT word_count AS wc FROM articles) sub
        """)
        r = cur.fetchone()
        words_per_article = {"min_val": r[0], "max_val": r[1], "avg_val": r[2]}

        cur.execute("""
            SELECT MIN(sc), MAX(sc), ROUND(AVG(sc), 2)
            FROM (SELECT sentence_count AS sc FROM articles) sub
        """)
        r = cur.fetchone()
        sentences_per_article = {"min_val": r[0], "max_val": r[1], "avg_val": r[2]}

        cur.execute("""
            SELECT MIN(ac), MAX(ac), ROUND(AVG(ac), 2)
            FROM (SELECT SUM(char_count) AS ac
                  FROM sentences GROUP BY article_id) sub
        """)
        r = cur.fetchone()
        chars_per_article = {"min_val": r[0], "max_val": r[1], "avg_val": r[2]}

        cur.execute("SELECT COUNT(*) FROM articles")
        article_count = cur.fetchone()[0]

        cur.close()
        conn.close()

        return jsonify({
            "article_id": None,
            "title": "All Articles",
            "article_count": article_count,
            "chars_per_word": chars_per_word,
            "chars_per_sentence": chars_per_sentence,
            "chars_per_paragraph": chars_per_paragraph,
            "chars_per_article": chars_per_article,
            "words_per_sentence": words_per_sentence,
            "words_per_paragraph": words_per_paragraph,
            "sentences_per_paragraph": sentences_per_paragraph,
            "paragraphs_per_article": paragraphs_per_article,
            "words_per_article": words_per_article,
            "sentences_per_article": sentences_per_article,
        })
