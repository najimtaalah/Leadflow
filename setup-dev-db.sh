#!/bin/bash
set -e

MYSQL_ROOT_PASSWORD="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' leadflow-mysql | sed -n 's/^MYSQL_ROOT_PASSWORD=//p')"

if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
  echo "Mot de passe root MySQL introuvable dans leadflow-mysql"
  exit 1
fi

echo "==> Test connexion MySQL..."
docker exec -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" leadflow-mysql mysql -u root -e "SELECT 1;" >/dev/null

echo "==> Préparation base leadflow_dev..."

docker exec -i -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" leadflow-mysql mysql -u root <<'SQL'
CREATE DATABASE IF NOT EXISTS leadflow_dev
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON leadflow_dev.* TO 'fcf_admin'@'%';
FLUSH PRIVILEGES;

SELECT 'leadflow_dev ready' AS status;
SQL

echo "==> Application des migrations Knex..."
NODE_ENV=development npm run migrate

echo "==> Terminé."
