PY := .venv/bin/python

.PHONY: setup data test lint web clean-cache

setup:
	python3.12 -m venv .venv
	$(PY) -m pip install -r requirements.txt
	$(PY) -m pip install -e . --no-deps

data:
	$(PY) -m pipeline.run

test:
	$(PY) -m pytest --cov=pipeline --cov-report=term-missing --cov-fail-under=80

lint:
	$(PY) -m ruff check pipeline tests scripts

web:
	@test -d web && (cd web && npm ci && npm run build) || echo "web/ todavía no existe (Fase 5)"

clean-cache:
	rm -rf data/cache
