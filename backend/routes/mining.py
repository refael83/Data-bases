from flask import Blueprint, request, jsonify
from db import get_db

mining_bp = Blueprint("mining", __name__)


@mining_bp.route("/api/mining/calculate", methods=["POST"])
def calculate_cooccurrences():
    data = request.get_json() or {}
    scope = data.get("scope", "sentence")
    min_count = data.get("min_count", 2)

    if scope not in ("sentence", "paragraph", "article"):
        return jsonify({"error": "scope must be sentence, paragraph, or article"}), 400

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("DELETE FROM word_cooccurrences WHERE scope = %s", (scope,))

        if scope == "sentence":
            cur.execute("""
                INSERT INTO word_cooccurrences (word1_id, word2_id, count, scope)
                SELECT a.word_id, b.word_id, COUNT(DISTINCT a.sentence_id), 'sentence'
                FROM word_occurrences a
                JOIN word_occurrences b ON a.sentence_id = b.sentence_id AND a.word_id < b.word_id
                JOIN words wa ON a.word_id = wa.id AND wa.is_stop_word = FALSE
                JOIN words wb ON b.word_id = wb.id AND wb.is_stop_word = FALSE
                GROUP BY a.word_id, b.word_id
                HAVING COUNT(DISTINCT a.sentence_id) >= %s
            """, (min_count,))
        elif scope == "paragraph":
            cur.execute("""
                INSERT INTO word_cooccurrences (word1_id, word2_id, count, scope)
                SELECT a.word_id, b.word_id,
                       COUNT(DISTINCT ROW(a.article_id, a.paragraph_num)),
                       'paragraph'
                FROM word_occurrences a
                JOIN word_occurrences b ON a.article_id = b.article_id
                    AND a.paragraph_num = b.paragraph_num
                    AND a.word_id < b.word_id
                JOIN words wa ON a.word_id = wa.id AND wa.is_stop_word = FALSE
                JOIN words wb ON b.word_id = wb.id AND wb.is_stop_word = FALSE
                GROUP BY a.word_id, b.word_id
                HAVING COUNT(DISTINCT ROW(a.article_id, a.paragraph_num)) >= %s
            """, (min_count,))
        else:
            cur.execute("""
                INSERT INTO word_cooccurrences (word1_id, word2_id, count, scope)
                SELECT a.word_id, b.word_id, COUNT(DISTINCT a.article_id), 'article'
                FROM word_occurrences a
                JOIN word_occurrences b ON a.article_id = b.article_id AND a.word_id < b.word_id
                JOIN words wa ON a.word_id = wa.id AND wa.is_stop_word = FALSE
                JOIN words wb ON b.word_id = wb.id AND wb.is_stop_word = FALSE
                GROUP BY a.word_id, b.word_id
                HAVING COUNT(DISTINCT a.article_id) >= %s
            """, (min_count,))

        cur.execute(
            "SELECT COUNT(*) FROM word_cooccurrences WHERE scope = %s", (scope,)
        )
        pair_count = cur.fetchone()[0]

        conn.commit()
        return jsonify({
            "message": f"Calculated {pair_count} co-occurrence pairs",
            "scope": scope,
            "pair_count": pair_count,
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@mining_bp.route("/api/mining/cooccurrences", methods=["GET"])
def get_cooccurrences():
    scope = request.args.get("scope", "sentence")
    limit = request.args.get("limit", 30, type=int)

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT w1.word_text AS word1, w2.word_text AS word2, c.count
        FROM word_cooccurrences c
        JOIN words w1 ON c.word1_id = w1.id
        JOIN words w2 ON c.word2_id = w2.id
        WHERE c.scope = %s
        ORDER BY c.count DESC
        LIMIT %s
    """, (scope, limit))

    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    cur.close()
    conn.close()
    return jsonify([dict(zip(cols, r)) for r in rows])


@mining_bp.route("/api/mining/apriori", methods=["POST"])
def run_apriori():
    data = request.get_json() or {}
    scope = data.get("scope", "sentence")
    min_support = data.get("min_support", 0.05)
    min_confidence = data.get("min_confidence", 0.1)

    if scope not in ("sentence", "paragraph", "article"):
        return jsonify({"error": "Invalid scope"}), 400

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get total units count for support calculation
        if scope == "sentence":
            cur.execute("SELECT COUNT(*) FROM sentences")
        elif scope == "paragraph":
            cur.execute("SELECT COUNT(DISTINCT (article_id, paragraph_num)) FROM word_occurrences")
        else:
            cur.execute("SELECT COUNT(*) FROM articles")

        total_units = cur.fetchone()[0]
        if total_units == 0:
            return jsonify({"error": "No data"}), 400

        # Get individual word frequencies in the given scope
        if scope == "sentence":
            word_freq_query = """
                SELECT word_id, COUNT(DISTINCT sentence_id) AS freq
                FROM word_occurrences wo
                JOIN words w ON wo.word_id = w.id AND w.is_stop_word = FALSE
                GROUP BY word_id
            """
        elif scope == "paragraph":
            word_freq_query = """
                SELECT word_id, COUNT(DISTINCT ROW(article_id, paragraph_num)) AS freq
                FROM word_occurrences wo
                JOIN words w ON wo.word_id = w.id AND w.is_stop_word = FALSE
                GROUP BY word_id
            """
        else:
            word_freq_query = """
                SELECT word_id, COUNT(DISTINCT article_id) AS freq
                FROM word_occurrences wo
                JOIN words w ON wo.word_id = w.id AND w.is_stop_word = FALSE
                GROUP BY word_id
            """

        cur.execute(word_freq_query)
        word_freq = {r[0]: r[1] for r in cur.fetchall()}

        # Clear old rules for this scope
        cur.execute("DELETE FROM association_rules WHERE scope = %s", (scope,))

        # Generate rules from co-occurrences
        cur.execute(
            "SELECT word1_id, word2_id, count FROM word_cooccurrences WHERE scope = %s",
            (scope,),
        )
        cooccs = cur.fetchall()

        rules = []
        for w1_id, w2_id, pair_count in cooccs:
            support = pair_count / total_units

            if support < min_support:
                continue

            freq_w1 = word_freq.get(w1_id, 0)
            freq_w2 = word_freq.get(w2_id, 0)

            if freq_w1 > 0:
                conf_1to2 = pair_count / freq_w1
                lift_1to2 = conf_1to2 / (freq_w2 / total_units) if freq_w2 > 0 else 0
                if conf_1to2 >= min_confidence:
                    rules.append((w1_id, w2_id, support, conf_1to2, lift_1to2, scope))

            if freq_w2 > 0:
                conf_2to1 = pair_count / freq_w2
                lift_2to1 = conf_2to1 / (freq_w1 / total_units) if freq_w1 > 0 else 0
                if conf_2to1 >= min_confidence:
                    rules.append((w2_id, w1_id, support, conf_2to1, lift_2to1, scope))

        for r in rules:
            cur.execute("""
                INSERT INTO association_rules
                    (antecedent_word_id, consequent_word_id, support, confidence, lift, scope)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, r)

        conn.commit()
        return jsonify({
            "message": f"Generated {len(rules)} association rules",
            "scope": scope,
            "total_units": total_units,
            "rule_count": len(rules),
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@mining_bp.route("/api/mining/rules", methods=["GET"])
def get_rules():
    scope = request.args.get("scope", "sentence")
    sort_by = request.args.get("sort", "lift")
    limit = request.args.get("limit", 30, type=int)

    if sort_by not in ("support", "confidence", "lift"):
        sort_by = "lift"

    conn = get_db()
    cur = conn.cursor()
    cur.execute(f"""
        SELECT w1.word_text AS antecedent, w2.word_text AS consequent,
               r.support, r.confidence, r.lift
        FROM association_rules r
        JOIN words w1 ON r.antecedent_word_id = w1.id
        JOIN words w2 ON r.consequent_word_id = w2.id
        WHERE r.scope = %s
        ORDER BY r.{sort_by} DESC
        LIMIT %s
    """, (scope, limit))

    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    cur.close()
    conn.close()
    return jsonify([dict(zip(cols, r)) for r in rows])
