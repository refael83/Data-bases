import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
DATABASE_URL = os.getenv("DATABASE_URL")


def init_db():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute("""
        DROP TABLE IF EXISTS
            association_rules,
            word_cooccurrences,
            phrase_occurrences,
            phrase_words,
            phrases,
            word_group_members,
            word_groups,
            word_occurrences,
            sentences,
            words,
            article_authors,
            articles,
            authors,
            topics,
            newspapers,
            document
        CASCADE
    """)

    # === Layer 1: Document metadata ===

    cur.execute("""
        CREATE TABLE newspapers (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            website VARCHAR(200),
            country VARCHAR(50)
        )
    """)

    cur.execute("""
        CREATE TABLE topics (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE
        )
    """)

    cur.execute("""
        CREATE TABLE authors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            email VARCHAR(200)
        )
    """)

    cur.execute("""
        CREATE TABLE articles (
            id SERIAL PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            file_path VARCHAR(500) NOT NULL UNIQUE,
            publication_date DATE,
            page_number INTEGER,
            language VARCHAR(20) DEFAULT 'en',
            newspaper_id INTEGER NOT NULL REFERENCES newspapers(id),
            topic_id INTEGER REFERENCES topics(id),
            char_count INTEGER DEFAULT 0,
            word_count INTEGER DEFAULT 0,
            sentence_count INTEGER DEFAULT 0,
            paragraph_count INTEGER DEFAULT 0,
            line_count INTEGER DEFAULT 0,
            loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE article_authors (
            article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
            author_id INTEGER REFERENCES authors(id) ON DELETE CASCADE,
            PRIMARY KEY (article_id, author_id)
        )
    """)

    # === Layer 2: Text decomposition ===

    cur.execute("""
        CREATE TABLE words (
            id SERIAL PRIMARY KEY,
            word_text VARCHAR(100) NOT NULL UNIQUE,
            word_length INTEGER GENERATED ALWAYS AS (LENGTH(word_text)) STORED,
            word_count_total INTEGER DEFAULT 0,
            is_stop_word BOOLEAN DEFAULT FALSE
        )
    """)

    cur.execute("""
        CREATE TABLE sentences (
            id SERIAL PRIMARY KEY,
            article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            paragraph_num INTEGER NOT NULL,
            sentence_num_in_paragraph INTEGER NOT NULL,
            sentence_text TEXT NOT NULL,
            word_count INTEGER DEFAULT 0,
            char_count INTEGER DEFAULT 0
        )
    """)

    cur.execute("CREATE INDEX idx_sentences_article ON sentences(article_id)")

    cur.execute("""
        CREATE TABLE word_occurrences (
            id SERIAL PRIMARY KEY,
            word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
            article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            sentence_id INTEGER NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
            original_form VARCHAR(100) NOT NULL,
            paragraph_num INTEGER NOT NULL,
            sentence_num INTEGER NOT NULL,
            position_in_sentence INTEGER NOT NULL,
            line_num INTEGER NOT NULL,
            page_num INTEGER NOT NULL,
            char_offset INTEGER NOT NULL
        )
    """)

    cur.execute("CREATE INDEX idx_wo_word ON word_occurrences(word_id)")
    cur.execute("CREATE INDEX idx_wo_article ON word_occurrences(article_id)")
    cur.execute("CREATE INDEX idx_wo_sentence ON word_occurrences(sentence_id)")
    cur.execute("CREATE INDEX idx_wo_word_art ON word_occurrences(word_id, article_id)")

    # === Layer 3: Groups and phrases ===

    cur.execute("""
        CREATE TABLE word_groups (
            id SERIAL PRIMARY KEY,
            group_name VARCHAR(100) NOT NULL UNIQUE,
            description VARCHAR(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE word_group_members (
            group_id INTEGER REFERENCES word_groups(id) ON DELETE CASCADE,
            word_id INTEGER REFERENCES words(id) ON DELETE CASCADE,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, word_id)
        )
    """)

    cur.execute("""
        CREATE TABLE phrases (
            id SERIAL PRIMARY KEY,
            phrase_text VARCHAR(1000) NOT NULL,
            user_defined_name VARCHAR(200),
            word_count INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE phrase_words (
            phrase_id INTEGER REFERENCES phrases(id) ON DELETE CASCADE,
            word_id INTEGER REFERENCES words(id),
            position INTEGER NOT NULL,
            PRIMARY KEY (phrase_id, word_id, position)
        )
    """)

    cur.execute("""
        CREATE TABLE phrase_occurrences (
            phrase_id INTEGER REFERENCES phrases(id) ON DELETE CASCADE,
            article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
            start_sentence_id INTEGER REFERENCES sentences(id),
            start_position INTEGER NOT NULL,
            end_position INTEGER NOT NULL,
            PRIMARY KEY (phrase_id, article_id, start_sentence_id, start_position)
        )
    """)

    # === Layer 4: Data mining (Apriori) ===

    cur.execute("""
        CREATE TABLE word_cooccurrences (
            word1_id INTEGER REFERENCES words(id),
            word2_id INTEGER REFERENCES words(id),
            count INTEGER NOT NULL DEFAULT 0,
            scope VARCHAR(20) NOT NULL CHECK (scope IN ('sentence', 'paragraph', 'article')),
            PRIMARY KEY (word1_id, word2_id, scope),
            CONSTRAINT ordered_pair CHECK (word1_id < word2_id)
        )
    """)

    cur.execute("""
        CREATE TABLE association_rules (
            id SERIAL PRIMARY KEY,
            antecedent_word_id INTEGER NOT NULL REFERENCES words(id),
            consequent_word_id INTEGER NOT NULL REFERENCES words(id),
            support REAL NOT NULL,
            confidence REAL NOT NULL,
            lift REAL NOT NULL,
            scope VARCHAR(20) NOT NULL CHECK (scope IN ('sentence', 'paragraph', 'article'))
        )
    """)

    cur.execute("CREATE INDEX idx_rules_support ON association_rules(support DESC)")
    cur.execute("CREATE INDEX idx_rules_scope_lift ON association_rules(scope, lift DESC)")

    conn.commit()
    cur.close()
    conn.close()
    print("Database initialized successfully - 15 tables created.")


if __name__ == "__main__":
    init_db()
