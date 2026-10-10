"""FastAPI backend: chat with any Yale SOM professor, each one a Pydantic AI agent.

Run from the backend folder (see README.md for setup):
    .venv/bin/uvicorn main:app --reload --reload-exclude '.venv/*' --port 8000
"""

import os
import uuid
from pathlib import Path

os.environ.setdefault('PYDANTIC_AI_NO_BANNER', '1')

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from pydantic_ai.messages import ModelMessage, ModelRequest, UserPromptPart
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from professors import Professors

# .env holds PORTKEY_API_KEY and OPENAI_MODEL. Look next to the backend, at the repo root, then one
# folder up (where the class .env lives), so the key never has to be copied into the repo.
HERE = Path(__file__).resolve().parent
for env in (HERE / '.env', HERE.parent / '.env', HERE.parent.parent / '.env'):
    if env.exists():
        load_dotenv(env)
        break

PORTKEY_API_KEY = os.environ.get('PORTKEY_API_KEY')
MODEL_NAME = os.environ.get('OPENAI_MODEL', 'gpt-5.6-luna')
if not PORTKEY_API_KEY:
    raise RuntimeError('PORTKEY_API_KEY is missing: add it to a .env file (see backend/README.md).')

# Portkey is an OpenAI-compatible gateway; the key's Portkey config routes to the model.
client = AsyncOpenAI(
    base_url='https://api.portkey.ai/v1',
    api_key=PORTKEY_API_KEY,
    default_headers={'x-portkey-api-key': PORTKEY_API_KEY},
)
faculty = Professors(OpenAIChatModel(MODEL_NAME, provider=OpenAIProvider(openai_client=client)))

app = FastAPI(title='Yale SOM Virtual: Professors')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173', 'https://ryanbeel.github.io', 'https://zlisto.github.io'],
    allow_methods=['*'],
    allow_headers=['*'],
)

# conversation history per chat session, kept in memory (resets when the server restarts)
MAX_SESSIONS = 500
sessions: dict[str, list[ModelMessage]] = {}


def _trim(history: list[ModelMessage], keep: int = 40) -> list[ModelMessage]:
    """Keep roughly the last `keep` messages, cut at the start of a user turn so tool calls stay paired."""
    for i in range(max(0, len(history) - keep), len(history)):
        m = history[i]
        if isinstance(m, ModelRequest) and any(isinstance(p, UserPromptPart) for p in m.parts):
            return history[i:]
    return history


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: str | None = None


class ChatOut(BaseModel):
    reply: str
    session_id: str


def _public(p: dict) -> dict:
    seen = {}
    for s in p['sections']:
        seen.setdefault(s['course_number'], {'number': s['course_number'], 'title': s['course_title']})
    return {
        'id': p['id'],
        'name': p['name'],
        'courses': list(seen.values()),
        'rooms': sorted({s['room'] for s in p['sections'] if s.get('room')}),
    }


@app.get('/api/health')
def health():
    return {'ok': True, 'model': MODEL_NAME, 'professors': len(faculty.catalog)}


@app.get('/api/professors')
def list_professors():
    return [_public(p) for p in sorted(faculty.catalog.values(), key=lambda p: p['name'].split()[-1])]


@app.get('/api/professors/{prof_id}')
def get_professor(prof_id: str):
    if prof_id not in faculty.catalog:
        raise HTTPException(404, f'No professor with id {prof_id!r}')
    return _public(faculty.catalog[prof_id])


@app.post('/api/professors/{prof_id}/chat', response_model=ChatOut)
async def chat(prof_id: str, body: ChatIn):
    if prof_id not in faculty.catalog:
        raise HTTPException(404, f'No professor with id {prof_id!r}')
    sid = body.session_id if body.session_id in sessions else str(uuid.uuid4())
    try:
        result = await faculty.agent(prof_id).run(body.message, message_history=sessions.get(sid))
    except Exception as e:  # surface model/gateway problems to the chat window instead of a bare 500
        raise HTTPException(502, f'The professor could not answer right now: {e}') from e
    if sid not in sessions and len(sessions) >= MAX_SESSIONS:
        sessions.pop(next(iter(sessions)))
    sessions[sid] = _trim(result.all_messages())
    return ChatOut(reply=result.output, session_id=sid)
