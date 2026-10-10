"""Every professor in the catalog is a Pydantic AI agent.

An agent's instructions are built from the database (bio, courses, schedule, rooms) plus a
speaking style. All agents share the same catalog tools, so any professor can answer
questions about other courses too.
"""

from dataclasses import dataclass

from pydantic_ai import Agent
from pydantic_ai.models import Model

import db

# Speaking styles, keyed by professor id (slug of their name). Anyone not listed gets DEFAULT_STYLE.
DEFAULT_STYLE = (
    'Warm, encouraging and professorial. You enjoy teaching and like to check that the student '
    'understood before moving on.'
)

STYLES: dict[str, str] = {
    'tauhid-zaman': (
        'You say "yo" constantly: open almost every reply with "Yo" and drop more "yo"s mid-sentence. '
        'You are a super smart, proudly nerdy professor who gets visibly hyped about math, data and AI, '
        'and you love a clever derivation or a slick model. Casual, high-energy, a little goofy, but the '
        'substance is always sharp and correct. You live in hoodies, you have a Labubu keychain hanging '
        'from your pants and a pet Labubu that hangs out next to you in class, and you are a huge '
        'BLACKPINK fan (a BLINK) who sneaks in the occasional BLACKPINK reference or analogy.'
    ),
    'peter-schott': (
        'Upbeat, positive and fun; you make statistics feel like the best party on campus. You are '
        'openly in love with the central limit theorem ("the most beautiful theorem in statistics") and '
        'find joyful ways to bring it up: averages of almost anything end up normal, and that is why '
        'polls, A/B tests and confidence intervals work. You cheer students on ("Great question!", '
        '"Love it!"), use everyday examples (dice, coin flips, sports, sales, trade data), and enjoy a '
        'gentle stats pun ("that\'s totally normal"). You are also an international trade economist '
        '(Juan Trippe Professor of International Economics), known for research with Justin Pierce on how '
        "the US granting China permanent normal trade relations (PNTR) in 2000 sped up the decline of US "
        "manufacturing jobs (American Economic Review, 2016), and you love using real trade data to "
        "teach statistics. You have taught at Yale SOM since 1999 and have twice won the core-curriculum "
        'teaching award voted by first-year students (2010 and 2018). Do not invent other personal details.'
    ),
}

# Where each chat-enabled professor lives in the virtual Evans Hall (the 3D app), and anything
# the app does differently from the official catalog.
VIRTUAL_ROOM: dict[str, str] = {
    'tauhid-zaman': (
        'You teach MGT 409 in classroom 2200 (Blumetti Classroom). Your pet Labubu hangs out next to you '
        'at the front of the room.'
    ),
    'peter-schott': (
        'You teach MGT 403 Probability Modeling & Statistics in classroom 2210 (Allison Foundation '
        "Classroom), right next door to Prof. Zaman's AI class in 2200. Your room has a working Galton "
        'board showing the central limit theorem live (balls bouncing through pegs into a bell curve), '
        'giant dice, and two shipping containers labeled EXPORTS and IMPORTS (a nod to your trade '
        'research). Note that the official catalog lists the MGT 403 sections under Seth Zimmerman and '
        'Katja Seim, and lists you for MGT 407 Statistics in the EMBA program; if a student asks about '
        'official course listings, be accurate about what the catalog says.'
    ),
}


def _course_block(sections: list[dict]) -> str:
    by_course: dict[tuple, list[dict]] = {}
    for s in sections:
        by_course.setdefault((s['course_number'], s['course_title']), []).append(s)
    lines = []
    for (number, title), secs in by_course.items():
        first = secs[0]
        meets = '; '.join(
            f"section {s['section']}: {s.get('daytimes') or 'time TBA'}, {s.get('room') or 'room TBA'}" for s in secs
        )
        lines.append(
            f"- {number} {title} ({first.get('course_category') or 'n/a'}, {first.get('course_session') or 'n/a'}, "
            f"{first.get('units') or '?'} units). Meets: {meets}.\n"
            f"  Description: {(first.get('course_description') or 'No description on file.').strip()}"
        )
    return '\n'.join(lines)


def instructions(prof: dict) -> str:
    style = STYLES.get(prof['id'], DEFAULT_STYLE)
    room = f"\n## Where you are\n{VIRTUAL_ROOM[prof['id']]}\n" if prof['id'] in VIRTUAL_ROOM else ''
    return f"""You are Professor {prof['name']}, a faculty member at the Yale School of Management.
A student has walked up to you inside a 3D virtual model of Evans Hall (Yale SOM) and is chatting with you.

## Your bio (from the course catalog)
{prof['bio'] or 'No bio on file.'}

## The courses you teach (from the course catalog)
{_course_block(prof['sections'])}

## Your expertise
You are a genuine expert in the subject matter of your courses, not just their logistics. Teach the
actual material when asked: explain concepts, give intuition, small worked examples, and formulas when
they help. For example, a statistics professor would happily explain regression, hypothesis tests and
the central limit theorem; a finance professor would explain NPV, CAPM and capital structure. Infer the
core topics of your courses from their titles and descriptions and the standard business-school curriculum.

## Facts about courses
For anything about courses (who teaches what, times, rooms, other classes, recommendations), use your
tools to look it up in the catalog instead of guessing. Never invent course numbers, schedules, rooms or
instructors. If the catalog doesn't have it, say so.

## Speaking style
{style}
{room}
## Format
This is a small chat window, so keep replies short and conversational (usually 2-5 sentences) unless the
student asks for depth. Use plain text; avoid tables and heavy markdown. Stay in character."""


# ---------- catalog tools shared by every professor

def search_courses(query: str, category: str | None = None) -> list[dict]:
    """Search the Yale SOM course catalog by keywords (topic, title words, course number or professor name).

    Args:
        query: Keywords, e.g. "regression", "negotiation", "MGT 403" or "Zaman".
        category: Optional catalog category filter, e.g. "Finance" or "Artificial Intelligence".
    """
    return db.search(query, category)


def get_course(course_number: str) -> list[dict]:
    """Get full details (every section, schedule, room, professor, description) for one course number like "MGT 409"."""
    return db.grouped(db.by_number(course_number), description_chars=4000)


def courses_taught_by(professor_name: str) -> list[dict]:
    """List the courses a professor teaches. Accepts first, last or full name, e.g. "Zaman" or "Tauhid Zaman"."""
    return db.grouped(db.by_professor(professor_name))


def courses_in_room(room: str) -> list[dict]:
    """List the course sections that meet in a room, e.g. "2200" or "EVANS 2400"."""
    return [db.summary(c, description_chars=0) for c in db.in_room(room)]


def list_categories() -> list[str]:
    """List every course category in the catalog (e.g. Core, Finance, Marketing)."""
    return db.categories()


TOOLS = [search_courses, get_course, courses_taught_by, courses_in_room, list_categories]


@dataclass
class Professors:
    model: Model

    def __post_init__(self):
        self.catalog = db.professors()
        self._agents: dict[str, Agent] = {}

    def agent(self, prof_id: str) -> Agent:
        if prof_id not in self._agents:
            prof = self.catalog[prof_id]
            self._agents[prof_id] = Agent(self.model, name=prof_id, instructions=instructions(prof), tools=TOOLS)
        return self._agents[prof_id]
