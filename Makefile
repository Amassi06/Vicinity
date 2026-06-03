# Connected Neighbours — wrappers Docker Compose DEV.

COMPOSE_DIR  := infra/docker
COMPOSE_FILE := $(COMPOSE_DIR)/docker-compose.dev.yml
ENV_FILE     := $(COMPOSE_DIR)/.env.dev
COMPOSE      := docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE)


env: ## Crée infra/docker/.env.dev depuis l'exemple si absent
	@test -f $(ENV_FILE) || cp $(COMPOSE_DIR)/.env.dev.example $(ENV_FILE)

up: env ## Démarre la stack DEV
	$(COMPOSE) up -d

down: ## Stoppe la stack DEV
	$(COMPOSE) down

ps: ## Liste les services
	$(COMPOSE) ps

logs: ## Suit les logs (Ctrl+C pour sortir)
	$(COMPOSE) logs -f --tail=100
