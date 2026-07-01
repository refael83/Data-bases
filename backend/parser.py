import re
import bisect

LINES_PER_PAGE = 50

ENGLISH_STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "this", "that",
    "these", "those", "it", "its", "not", "no", "as", "if", "than",
    "so", "up", "out", "about", "into", "over", "after", "before",
    "he", "she", "they", "we", "you", "i", "me", "my", "your", "his",
    "her", "their", "our", "who", "which", "what", "when", "where", "how",
}


def parse_article(file_content):
    """Parse a .txt article file with FIELD:VALUE header and body separated by ---."""
    if "---" not in file_content:
        raise ValueError("File must contain '---' separator between metadata and body")

    header, body = file_content.split("---", 1)
    metadata = _parse_metadata(header)
    body = body.strip()
    sentences, occurrences, stats = _parse_body(body)
    return metadata, sentences, occurrences, stats


def _parse_metadata(header_text):
    metadata = {}
    for line in header_text.strip().split("\n"):
        line = line.strip()
        if ":" in line:
            key, val = line.split(":", 1)
            key = key.strip().upper()
            val = val.strip()
            if val:
                metadata[key] = val
    return metadata


def _parse_body(body_text):
    # Build line-start offset table for char_offset -> line_num conversion
    line_starts = [0]
    for i, ch in enumerate(body_text):
        if ch == "\n":
            line_starts.append(i + 1)

    def offset_to_line(offset):
        return bisect.bisect_right(line_starts, offset)

    # Split into paragraphs by blank lines, track char offsets
    lines = body_text.split("\n")
    line_offsets = []
    pos = 0
    for line in lines:
        line_offsets.append(pos)
        pos += len(line) + 1

    paragraphs = []
    current_lines = []
    current_start = None

    for idx, line in enumerate(lines):
        if line.strip():
            if current_start is None:
                current_start = line_offsets[idx]
            current_lines.append(line.rstrip())
        else:
            if current_lines:
                paragraphs.append((" ".join(current_lines), current_start))
                current_lines = []
                current_start = None

    if current_lines:
        paragraphs.append((" ".join(current_lines), current_start))

    all_sentences = []
    all_occurrences = []
    global_sentence_num = 0

    for para_num, (para_text, para_char_start) in enumerate(paragraphs, 1):
        sent_spans = _split_sentences(para_text)

        for sent_in_para, (sent_text, sent_offset) in enumerate(sent_spans, 1):
            global_sentence_num += 1
            sent_char_start = para_char_start + sent_offset

            words = _tokenize(sent_text)

            all_sentences.append({
                "paragraph_num": para_num,
                "sentence_num_in_paragraph": sent_in_para,
                "sentence_text": sent_text,
                "word_count": len(words),
                "char_count": len(sent_text),
            })

            for word_pos, (normalized, original, off_in_sent) in enumerate(words, 1):
                abs_off = sent_char_start + off_in_sent
                safe_off = min(abs_off, len(body_text) - 1) if body_text else 0
                line = offset_to_line(safe_off)
                page = ((line - 1) // LINES_PER_PAGE) + 1

                all_occurrences.append({
                    "word_normalized": normalized,
                    "original_form": original,
                    "paragraph_num": para_num,
                    "sentence_num": global_sentence_num,
                    "position_in_sentence": word_pos,
                    "line_num": line,
                    "page_num": page,
                    "char_offset": abs_off,
                    "sentence_index": len(all_sentences) - 1,
                })

    stats = {
        "char_count": len(body_text),
        "word_count": len(all_occurrences),
        "sentence_count": global_sentence_num,
        "paragraph_count": len(paragraphs),
        "line_count": len(lines),
    }

    return all_sentences, all_occurrences, stats


def _split_sentences(text):
    """Split text into sentences, returning (text, start_offset) pairs."""
    results = []
    last_end = 0

    for match in re.finditer(r"[^.!?]*[.!?]+", text):
        sent = match.group().strip()
        if sent:
            start = match.start()
            while start < len(text) and text[start] in " \t":
                start += 1
            results.append((sent, start))
        last_end = match.end()

    remaining = text[last_end:].strip()
    if remaining:
        start = last_end
        while start < len(text) and text[start] in " \t":
            start += 1
        results.append((remaining, start))

    if not results and text.strip():
        start = 0
        while start < len(text) and text[start] in " \t":
            start += 1
        results.append((text.strip(), start))

    return results


def _tokenize(sentence_text):
    """Returns list of (normalized, original_form, char_offset_in_sentence)."""
    words = []
    for match in re.finditer(r"[a-zA-Z֐-׿][\w']*", sentence_text):
        original = match.group()
        normalized = original.lower()
        words.append((normalized, original, match.start()))
    return words


def is_stop_word(word_text):
    return word_text.lower() in ENGLISH_STOP_WORDS
