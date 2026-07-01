import os
import time
import requests

API_URL = "http://localhost:5000"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "sample_texts")


def load_samples():
    files = sorted(f for f in os.listdir(DATA_DIR) if f.endswith(".txt"))

    for filename in files:
        filepath = os.path.join(DATA_DIR, filename)
        with open(filepath, "rb") as f:
            res = requests.post(
                f"{API_URL}/api/articles/upload",
                files={"file": (filename, f, "text/plain")},
                timeout=30,
            )

        if res.ok:
            data = res.json()
            stats = data["stats"]
            print(
                f"Loaded: {filename} -> Article ID {data['article_id']}, "
                f"{stats['word_count']} words, {stats['sentence_count']} sentences"
            )
        else:
            try:
                err = res.json()
                print(f"Error: {filename} -> {err}")
            except Exception:
                print(f"Error: {filename} -> HTTP {res.status_code}")

        time.sleep(1)


if __name__ == "__main__":
    load_samples()
