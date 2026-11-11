"""Regenerate the reference tables in README.md from their sources of truth.

Sources: Makefile (`target: ## description`), web/package.json scripts, .env.example.
Run: python scripts/gen_docs.py   (tests/test_docs_in_sync.py fails if the README drifts)
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"

NPM_DESCRIPTIONS = {
    "dev": "Servidor de desarrollo (datos reales de `public/data/`)",
    "build": "Comprobación de tipos + build de producción",
    "preview": "Sirve el build de producción",
    "typecheck": "Solo comprobación de tipos",
    "test": "Tests unitarios (Vitest)",
    "test:watch": "Tests unitarios en modo watch",
    "e2e": "Tests e2e (Playwright, Chrome instalado, solo datos sintéticos)",
    "e2e:build": "Tests e2e contra el build de producción",
}


def make_targets(text: str) -> list[tuple[str, str]]:
    """(target, description) for every `target: ## description` line."""
    return re.findall(r"^([A-Za-z][\w-]*):.*?##\s*(.+)$", text, flags=re.M)


def env_vars(text: str) -> list[tuple[str, bool, str, str]]:
    """(name, required, description, example) from a commented .env.example."""
    out: list[tuple[str, bool, str, str]] = []
    required, comment = True, ""
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.lower() in ("# required", "# optional"):
            required, comment = stripped.lower() == "# required", ""
        elif stripped.startswith("#"):
            comment = stripped.lstrip("# ").strip()
        elif "=" in stripped:
            name, example = stripped.split("=", 1)
            out.append((name, required, comment, example))
            comment = ""
    return out


def _table(header: list[str], rows: list[list[str]]) -> str:
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(r) + " |" for r in rows]
    return "\n".join(lines)


def replace_section(doc: str, name: str, body: str) -> str:
    start, end = f"<!-- AUTO-GENERATED:{name} -->", f"<!-- /AUTO-GENERATED:{name} -->"
    pattern = re.compile(re.escape(start) + r"\n(?:.*?\n)?" + re.escape(end), flags=re.S)
    if not pattern.search(doc):
        raise ValueError(f"README has no {start} block")
    return pattern.sub(lambda _: f"{start}\n{body}\n{end}", doc)


def render_readme(doc: str) -> str:
    make = make_targets((ROOT / "Makefile").read_text(encoding="utf-8"))
    scripts = json.loads((ROOT / "web" / "package.json").read_text(encoding="utf-8"))["scripts"]
    env = env_vars((ROOT / ".env.example").read_text(encoding="utf-8"))
    commands = _table(["Comando", "Qué hace"], [[f"`make {t}`", d] for t, d in make])
    npm_rows = [[f"`npm run {s}`", NPM_DESCRIPTIONS.get(s, f"`{c}`")] for s, c in scripts.items()]
    npm = _table(["Comando (en `web/`)", "Qué hace"], npm_rows)
    envt = _table(["Variable", "Obligatoria", "Descripción", "Ejemplo"],
                  [[f"`{n}`", "sí" if r else "no", d, f"`{e}`"] for n, r, d, e in env])
    doc = replace_section(doc, "commands", commands)
    doc = replace_section(doc, "npm", npm)
    return replace_section(doc, "env", envt)


if __name__ == "__main__":
    README.write_text(render_readme(README.read_text(encoding="utf-8")), encoding="utf-8")
