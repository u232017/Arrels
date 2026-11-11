"""README reference tables are generated from the Makefile, web/package.json and .env.example."""

from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("gen_docs", ROOT / "scripts" / "gen_docs.py")
assert _spec and _spec.loader
gen_docs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen_docs)


def test_make_targets_are_parsed_with_descriptions():
    targets = gen_docs.make_targets("data: ## Run it\n\tcmd\nhidden:\n\tcmd\n")
    assert targets == [("data", "Run it")]


def test_env_vars_know_required_and_optional():
    text = "# Required\n# Where\nA=/x\n\n# Optional\n# How much\nB=1\n"
    assert gen_docs.env_vars(text) == [("A", True, "Where", "/x"), ("B", False, "How much", "1")]


def test_replace_section_only_touches_the_marked_block():
    doc = "intro\n<!-- AUTO-GENERATED:x -->\nold\n<!-- /AUTO-GENERATED:x -->\nend\n"
    out = gen_docs.replace_section(doc, "x", "new")
    assert out == "intro\n<!-- AUTO-GENERATED:x -->\nnew\n<!-- /AUTO-GENERATED:x -->\nend\n"


def test_readme_is_in_sync_with_its_sources():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert gen_docs.render_readme(readme) == readme, "run: python scripts/gen_docs.py"
