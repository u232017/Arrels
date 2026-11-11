"""Execute the notebook into data/processed/ (git-ignored) and report the wall time."""

from __future__ import annotations

import sys
import time
from pathlib import Path

import nbformat
from nbclient import NotebookClient

SOURCE = Path("notebooks/arrels_mvp.ipynb")
TARGET = Path("data/processed/arrels_mvp.executed.ipynb")
TIMEOUT_S = 1800


def main() -> int:
    nb = nbformat.read(SOURCE, as_version=4)
    t0 = time.time()
    NotebookClient(nb, timeout=TIMEOUT_S, kernel_name="python3",
                   resources={"metadata": {"path": "notebooks"}}).execute()
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    nbformat.write(nb, TARGET)
    print(f"notebook executed in {time.time() - t0:.0f} s -> {TARGET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
