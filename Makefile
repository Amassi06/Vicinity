# Connected Neighbours — wrappers Docker Compose.
# Deux environnements :
#   DEV  (make up)      : bases seules, les applis tournent en local (npm/gradle).
#   FULL (make up-full) : bases + backend + web + admin, tout conteneurisé.

COMPOSE_DIR  := infra/docker
COMPOSE_FILE := $(COMPOSE_DIR)/docker-compose.dev.yml
FULL_FILE    := $(COMPOSE_DIR)/docker-compose.full.yml
ENV_FILE     := $(COMPOSE_DIR)/.env.dev
COMPOSE      := docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE)
COMPOSE_FULL := docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) -f $(FULL_FILE)


env: ## Crée infra/docker/.env.dev depuis l'exemple si absent
	@test -f $(ENV_FILE) || cp $(COMPOSE_DIR)/.env.dev.example $(ENV_FILE)

up: env ## Démarre la stack DEV (bases seules)
	$(COMPOSE) up -d

down: ## Stoppe la stack DEV
	$(COMPOSE) down

up-full: env ## Démarre la stack FULL (bases + backend + web + admin)
	$(COMPOSE_FULL) up -d --build

down-full: ## Stoppe la stack FULL
	$(COMPOSE_FULL) down

build-images: env ## (Re)construit les images applicatives
	$(COMPOSE_FULL) build

ps: ## Liste les services
	$(COMPOSE_FULL) ps

logs: ## Suit les logs (Ctrl+C pour sortir)
	$(COMPOSE_FULL) logs -f --tail=100
