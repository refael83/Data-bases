import os
import psycopg2
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.getenv("DATABASE_URL")


def get_db():
    return psycopg2.connect(DATABASE_URL)


@app.route("/")
def index():
    return jsonify({"status": "ok", "message": "Concordance API is running"})


@app.route("/health")
def health():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        return jsonify({"database": "connected"})
    except Exception as e:
        return jsonify({"database": "error", "detail": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
