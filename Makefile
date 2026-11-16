PY := .venv/bin/python

.PHONY: setup data test lint web web-dev notebook clean-cache

setup: ## Crea .venv (Python 3.12) e instala dependencias fijadas, Python y web
	python3.12 -m venv .venv
	$(PY) -m pip install -r requirements.txt
	$(PY) -m pip install -e . --no-deps
	cd web && npm ci --no-audit --no-fund

data: ## Pipeline completo (ingesta → calidad → agregados → indicadores) y export JSON para la web
	$(PY) -m pipeline.run
	$(PY) -m pipeline.export
	$(PY) scripts/export_map.py

test: ## Tests del pipeline con cobertura (mínimo 80 %)
	$(PY) -m pytest --cov=pipeline --cov-report=term-missing --cov-fail-under=80

lint: ## ruff + mypy (Python) y tsc (web)
	$(PY) -m ruff check pipeline tests scripts
	$(PY) -m mypy pipeline --ignore-missing-imports
	cd web && npx tsc -b --noEmit

notebook: ## Genera y ejecuta notebooks/arrels_mvp.ipynb (salida en data/processed/)
	$(PY) scripts/build_notebook.py
	$(PY) scripts/run_notebook.py

web: ## Build estático de la web en web/dist/
	cd web && npm run build

web-dev: ## Servidor de desarrollo de la web en http://localhost:5173
	cd web && npm run dev

clean-cache: ## Borra la caché Parquet (la próxima ejecución será en frío)
	rm -rf data/cache
