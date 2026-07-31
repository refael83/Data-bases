from flask import Blueprint, request, jsonify
from psycopg2.extras import execute_values
from db import get_db
from parser import parse_article, is_stop_word

documents_bp = Blueprint("documents", __name__)

KNOWN_NEWSPAPERS = {
    "The New York Times": {"country": "USA", "website": "https://www.nytimes.com"},
    "The Guardian": {"country": "UK", "website": "https://www.theguardian.com"},
    "The Washington Post": {"country": "USA", "website": "https://www.washingtonpost.com"},
    "BBC News": {"country": "UK", "website": "https://www.bbc.com/news"},
    "CNN": {"country": "USA", "website": "https://www.cnn.com"},
    "Reuters": {"country": "UK", "website": "https://www.reuters.com"},
    "Al Jazeera": {"country": "Qatar", "website": "https://www.aljazeera.com"},
    "Haaretz": {"country": "Israel", "website": "https://www.haaretz.com"},
    "Yedioth Ahronoth": {"country": "Israel", "website": "https://www.ynetnews.com"},
    "Le Monde": {"country": "France", "website": "https://www.lemonde.fr"},
    "Der Spiegel": {"country": "Germany", "website": "https://www.spiegel.de"},
    "The Times": {"country": "UK", "website": "https://www.thetimes.co.uk"},
    "USA Today": {"country": "USA", "website": "https://www.usatoday.com"},
    "The Wall Street Journal": {"country": "USA", "website": "https://www.wsj.com"},
    "Los Angeles Times": {"country": "USA", "website": "https://www.latimes.com"},
    "Tech Horizons": {"country": "USA", "website": None},
}


@documents_bp.route("/api/articles/upload", methods=["POST"])
def upload_article():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename.endswith(".txt"):
        return jsonify({"error": "Only .txt files are allowed"}), 400

    content = file.read().decode("utf-8")
    file_path = request.form.get("file_path", file.filename)

    try:
        metadata, sentences, occurrences, stats = parse_article(content)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    conn = get_db()
    cur = conn.cursor()

    try:
        # Insert or find newspaper
        newspaper_name = metadata.get("NEWSPAPER", "Unknown")
        known = KNOWN_NEWSPAPERS.get(newspaper_name, {})
        country = metadata.get("COUNTRY") or known.get("country")
        website = metadata.get("WEBSITE") or known.get("website")
        cur.execute("""
            INSERT INTO newspapers (name, country, website) VALUES (%s, %s, %s)
            ON CONFLICT (name) DO UPDATE SET
                country = COALESCE(EXCLUDED.country, newspapers.country),
                website = COALESCE(EXCLUDED.website, newspapers.website)
            RETURNING id
        """, (newspaper_name, country, website))
        newspaper_id = cur.fetchone()[0]

        # Insert or find topic
        topic_id = None
        topic_name = metadata.get("TOPIC")
        if topic_name:
            cur.execute("""
                INSERT INTO topics (name) VALUES (%s)
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            """, (topic_name,))
            topic_id = cur.fetchone()[0]

        # Insert or find author(s)
        author_ids = []
        author_name = metadata.get("AUTHOR", "")
        if author_name:
            for name in author_name.split(","):
                name = name.strip()
                if not name:
                    continue
                cur.execute("SELECT id FROM authors WHERE name = %s", (name,))
                row = cur.fetchone()
                if row:
                    author_ids.append(row[0])
                else:
                    cur.execute(
                        "INSERT INTO authors (name) VALUES (%s) RETURNING id",
                        (name,),
                    )
                    author_ids.append(cur.fetchone()[0])

        # Insert article
        page_num = metadata.get("PAGE")
        if page_num:
            page_num = int(page_num)

        cur.execute("""
            INSERT INTO articles
                (title, file_path, publication_date, page_number, language,
                 newspaper_id, topic_id,
                 char_count, word_count, sentence_count, paragraph_count, line_count)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            metadata.get("TITLE", file.filename),
            file_path,
            metadata.get("DATE"),
            page_num,
            metadata.get("LANGUAGE", "en"),
            newspaper_id,
            topic_id,
            stats["char_count"],
            stats["word_count"],
            stats["sentence_count"],
            stats["paragraph_count"],
            stats["line_count"],
        ))
        article_id = cur.fetchone()[0]

        # Link authors
        for aid in author_ids:
            cur.execute(
                "INSERT INTO article_authors (article_id, author_id) VALUES (%s, %s)",
                (article_id, aid),
            )

        # Batch insert sentences
        sent_values = [
            (article_id, s["paragraph_num"], s["sentence_num_in_paragraph"],
             s["word_count"], s["char_count"])
            for s in sentences
        ]
        sentence_ids = []
        if sent_values:
            results = execute_values(cur, """
                INSERT INTO sentences
                    (article_id, paragraph_num, sentence_num_in_paragraph,
                     word_count, char_count)
                VALUES %s RETURNING id
            """, sent_values, fetch=True)
            sentence_ids = [r[0] for r in results]

        # Collect unique words and insert/fetch them in batch
        unique_words = set(occ["word_normalized"] for occ in occurrences)
        word_cache = {}

        # Insert new words
        word_values = [(w, is_stop_word(w)) for w in unique_words]
        if word_values:
            execute_values(cur, """
                INSERT INTO words (word_text, is_stop_word) VALUES %s
                ON CONFLICT (word_text) DO NOTHING
            """, word_values)

        # Fetch all word IDs
        cur.execute(
            "SELECT id, word_text FROM words WHERE word_text = ANY(%s)",
            (list(unique_words),),
        )
        for row in cur.fetchall():
            word_cache[row[1]] = row[0]

        # Batch insert word occurrences
        occ_values = [
            (word_cache[occ["word_normalized"]], article_id,
             sentence_ids[occ["sentence_index"]], occ["original_form"],
             occ["paragraph_num"], occ["sentence_num"],
             occ["position_in_sentence"],
             occ["line_num"], occ["page_num"])
            for occ in occurrences
        ]
        if occ_values:
            execute_values(cur, """
                INSERT INTO word_occurrences
                    (word_id, article_id, sentence_id, original_form,
                     paragraph_num, sentence_num, position_in_sentence,
                     line_num, page_num)
                VALUES %s
            """, occ_values)

        # Batch update word_count_total
        word_ids = list(word_cache.values())
        if word_ids:
            cur.execute("""
                UPDATE words w SET word_count_total = sub.cnt
                FROM (
                    SELECT word_id, COUNT(*) AS cnt
                    FROM word_occurrences
                    WHERE word_id = ANY(%s)
                    GROUP BY word_id
                ) sub
                WHERE w.id = sub.word_id
            """, (word_ids,))

        conn.commit()
        return jsonify({
            "message": "Article loaded and indexed",
            "article_id": article_id,
            "stats": stats,
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@documents_bp.route("/api/articles", methods=["GET"])
def list_articles():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT a.id, a.title, a.file_path, a.publication_date, a.page_number,
               a.language, a.word_count, a.sentence_count, a.paragraph_count,
               a.loaded_at,
               n.name AS newspaper,
               n.country AS newspaper_country,
               n.website AS newspaper_website,
               t.name AS topic,
               STRING_AGG(au.name, ', ') AS authors
        FROM articles a
        JOIN newspapers n ON a.newspaper_id = n.id
        LEFT JOIN topics t ON a.topic_id = t.id
        LEFT JOIN article_authors aa ON a.id = aa.article_id
        LEFT JOIN authors au ON aa.author_id = au.id
        GROUP BY a.id, n.name, n.country, n.website, t.name
        ORDER BY a.loaded_at DESC
    """)
    rows = cur.fetchall()
    columns = [desc[0] for desc in cur.description]
    cur.close()
    conn.close()

    articles = []
    for row in rows:
        art = dict(zip(columns, row))
        art["publication_date"] = str(art["publication_date"]) if art["publication_date"] else None
        art["loaded_at"] = str(art["loaded_at"]) if art["loaded_at"] else None
        articles.append(art)

    return jsonify(articles)


@documents_bp.route("/api/articles/<int:article_id>", methods=["GET"])
def get_article(article_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT a.*, n.name AS newspaper, t.name AS topic
        FROM articles a
        JOIN newspapers n ON a.newspaper_id = n.id
        LEFT JOIN topics t ON a.topic_id = t.id
        WHERE a.id = %s
    """, (article_id,))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return jsonify({"error": "Article not found"}), 404

    columns = [desc[0] for desc in cur.description]
    art = dict(zip(columns, row))
    art["publication_date"] = str(art["publication_date"]) if art["publication_date"] else None
    art["loaded_at"] = str(art["loaded_at"]) if art["loaded_at"] else None

    # Get authors
    cur.execute("""
        SELECT au.name FROM authors au
        JOIN article_authors aa ON au.id = aa.author_id
        WHERE aa.article_id = %s
    """, (article_id,))
    art["authors"] = [r[0] for r in cur.fetchall()]

    # Get sentences (reconstructed from word occurrences)
    cur.execute("""
        SELECT s.paragraph_num, s.sentence_num_in_paragraph,
               (SELECT STRING_AGG(wo.original_form, ' ' ORDER BY wo.position_in_sentence)
                FROM word_occurrences wo WHERE wo.sentence_id = s.id) AS sentence_text
        FROM sentences s WHERE s.article_id = %s
        ORDER BY s.paragraph_num, s.sentence_num_in_paragraph
    """, (article_id,))
    art["sentences"] = [
        {"paragraph": r[0], "sentence_num": r[1], "text": r[2] or ""}
        for r in cur.fetchall()
    ]

    cur.close()
    conn.close()
    return jsonify(art)


@documents_bp.route("/api/articles/<int:article_id>", methods=["DELETE"])
def delete_article(article_id):
    conn = get_db()
    cur = conn.cursor()
    try:
        # Get affected word_ids before deleting
        cur.execute(
            "SELECT DISTINCT word_id FROM word_occurrences WHERE article_id = %s",
            (article_id,),
        )
        affected_word_ids = [r[0] for r in cur.fetchall()]

        cur.execute("DELETE FROM articles WHERE id = %s", (article_id,))
        if cur.rowcount == 0:
            conn.rollback()
            return jsonify({"error": "Article not found"}), 404

        # Update word_count_total for affected words
        for wid in affected_word_ids:
            cur.execute("""
                UPDATE words SET word_count_total = (
                    SELECT COUNT(*) FROM word_occurrences WHERE word_id = %s
                ) WHERE id = %s
            """, (wid, wid))

        conn.commit()
        return jsonify({"message": "Article deleted"})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()
