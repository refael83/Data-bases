from flask import Flask, jsonify
from flask_cors import CORS
from db import get_db
from routes.documents import documents_bp
from routes.search import search_bp
from routes.groups import groups_bp
from routes.phrases import phrases_bp
from routes.statistics import statistics_bp
from routes.mining import mining_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(documents_bp)
app.register_blueprint(search_bp)
app.register_blueprint(groups_bp)
app.register_blueprint(phrases_bp)
app.register_blueprint(statistics_bp)
app.register_blueprint(mining_bp)


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
