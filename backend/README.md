# Professor chat backend

FastAPI + Pydantic AI. Every instructor in `../data/yale_som.db` is an AI agent whose instructions come
from the catalog (bio, courses, schedule, rooms) plus a speaking style in `professors.py` (`STYLES`).
All agents share catalog tools (search courses, course details, courses by professor, courses in a
room, categories), so any professor can answer questions about other classes.

The model is reached through Portkey (OpenAI-compatible). It reads `PORTKEY_API_KEY` and
`OPENAI_MODEL` from a `.env` file in `backend/`, the repo root, or the folder above the repo.
`.env` files are git-ignored; never commit the key.

## Run it

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --reload-exclude '.venv/*' --port 8000
```

Then run the frontend (`npm run dev` in the repo root). Vite proxies `/api` to port 8000.

## API

- `GET /api/health`
- `GET /api/professors`: everyone, with their courses and rooms
- `GET /api/professors/{id}`: e.g. `tauhid-zaman`
- `POST /api/professors/{id}/chat` with `{"message": "...", "session_id": null}`: returns
  `{"reply", "session_id"}`; send the session id back to continue the conversation

## Adding a speaking style

Add an entry to `STYLES` in `professors.py`, keyed by the professor's id (their name as a slug).
