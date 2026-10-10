"""Read-only access to the Yale SOM course catalog in data/yale_som.db.

The catalog is small (a few hundred sections), so it is loaded into memory once and
searched in Python.
"""

import re
import sqlite3
from functools import lru_cache
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / 'data' / 'yale_som.db'

SUMMARY_FIELDS = ('course_number', 'section', 'course_title', 'course_category', 'course_session', 'faculty', 'daytimes', 'room', 'units')


def display_name(raw: str | None) -> str:
    """'Zaman, Tauhid' -> 'Tauhid Zaman'."""
    if not raw:
        return ''
    if ',' in raw:
        last, first = (p.strip() for p in raw.split(',', 1))
        return f'{first} {last}'.strip()
    return raw.strip()


def slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


@lru_cache(maxsize=1)
def courses() -> list[dict]:
    conn = sqlite3.connect(f'file:{DB_PATH}?mode=ro', uri=True)
    conn.row_factory = sqlite3.Row
    try:
        rows = [dict(r) for r in conn.execute('SELECT * FROM courses ORDER BY course_number, section')]
    finally:
        conn.close()
    for r in rows:
        r['faculty'] = display_name(r.get('faculty_1'))
        r.pop('faculty_1_email', None)  # never expose emails, even if a future export has them
    return rows


def summary(c: dict, description_chars: int = 300) -> dict:
    out = {k: c.get(k) or '' for k in SUMMARY_FIELDS}
    if description_chars <= 0:
        return out
    desc = (c.get('course_description') or '').strip()
    out['description'] = desc if len(desc) <= description_chars else desc[:description_chars].rsplit(' ', 1)[0] + '...'
    return out


def search(query: str, category: str | None = None, limit: int = 12) -> list[dict]:
    """Rank courses by how many query words appear in their number, title, category, professor or description."""
    words = [w for w in re.findall(r'[a-z0-9]+', query.lower()) if len(w) > 1]
    scored = []
    for c in courses():
        if category and category.lower() not in (c.get('course_category') or '').lower():
            continue
        head = ' '.join(str(c.get(k) or '') for k in ('course_number', 'course_title', 'course_category', 'faculty')).lower()
        body = (c.get('course_description') or '').lower()
        score = sum(3 * (w in head) + (w in body) for w in words) if words else 1
        if score:
            scored.append((score, c))
    scored.sort(key=lambda sc: -sc[0])
    return grouped([c for _, c in scored])[:limit]


def grouped(rows: list[dict], description_chars: int = 300) -> list[dict]:
    """One entry per course (in first-seen order) with every section's professor, time and room."""
    out: dict[tuple, dict] = {}
    for c in rows:
        key = (c['course_number'], c['course_title'])
        if key not in out:
            g = summary(c, description_chars)
            for k in ('section', 'faculty', 'daytimes', 'room'):
                g.pop(k)
            g['sections'] = []
            out[key] = g
        out[key]['sections'].append({k: c.get(k) or '' for k in ('section', 'faculty', 'daytimes', 'room')})
    return list(out.values())


def by_number(course_number: str) -> list[dict]:
    want = re.sub(r'\s+', '', course_number).lower()
    return [c for c in courses() if re.sub(r'\s+', '', c.get('course_number') or '').lower() == want]


def by_professor(name: str) -> list[dict]:
    words = re.findall(r'[a-z]+', name.lower())
    return [c for c in courses() if words and all(w in c['faculty'].lower() for w in words)]


def in_room(room: str) -> list[dict]:
    digits = re.sub(r'\D', '', room)
    want = digits or room.lower()
    return [c for c in courses() if want and want in (c.get('room') or '').lower()]


def categories() -> list[str]:
    return sorted({c['course_category'] for c in courses() if c.get('course_category')})


def professors() -> dict[str, dict]:
    """Every instructor in the catalog, keyed by slug, with their bio and sections."""
    out: dict[str, dict] = {}
    for c in courses():
        name = c['faculty']
        if not name:
            continue
        p = out.setdefault(slugify(name), {'id': slugify(name), 'name': name, 'bio': '', 'sections': []})
        p['bio'] = p['bio'] or (c.get('faculty_bio') or '').strip()
        p['sections'].append(c)
    return out
