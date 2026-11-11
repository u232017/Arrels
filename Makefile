PY := .venv/bin/python

.PHONY: setup data test lint web web-dev notebook clean-cache

setup:
	python3.12 -m venv .venv
	$(PY) -m pip install -r requirements.txt
	$(PY) -m pip install -e . --no-deps
	cd web && npm ci --no-audit --no-fund

data:
	$(PY) -m pipeline.run
	$(PY) -m pipeline.export

test:
	$(PY) -m pytest --cov=pipeline --cov-report=term-missing --cov-fail-under=80

lint:
	$(PY) -m ruff check pipeline tests scripts
	$(PY) -m mypy pipeline --ignore-missing-imports
	cd web && npx tsc -b --noEmit

notebook:
	$(PY) scripts/build_notebook.py
	$(PY) scripts/run_notebook.py

web:
	cd web && npm run build

web-dev:
	cd web && npm run dev

clean-cache:
	rm -rf data/cache
