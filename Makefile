.PHONY: dev build stop clean logs setup

setup: ## Erstkonfiguration: .env anlegen
	@if [ ! -f .env ]; then cp .env.example .env && echo "✅ .env erstellt – bitte JWT_SECRET setzen!"; else echo "ℹ️  .env existiert bereits"; fi

dev: ## Entwicklungsmodus starten
	docker compose up --build

build: ## Produktions-Images bauen
	docker compose build

stop: ## Container stoppen
	docker compose down

clean: ## Container + Volumes entfernen
	docker compose down -v --remove-orphans

logs: ## Live-Logs aller Services
	docker compose logs -f

logs-backend: ## Backend-Logs
	docker compose logs -f backend

logs-frontend: ## Frontend-Logs
	docker compose logs -f frontend

help: ## Diese Hilfe anzeigen
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'