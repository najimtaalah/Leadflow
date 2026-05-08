#!/bin/bash
# Run this as root to create the leadflow_dev database
# Usage: sudo bash /home/paperclip/leadflow-dev/setup-dev-db.sh

set -e
echo "==> Creating leadflow_dev database and granting access to fcf_admin..."

docker exec mysql mysql -u root -p'ChangeMe_StrongRootPass!' << 'SQL'
CREATE DATABASE IF NOT EXISTS leadflow_dev 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON leadflow_dev.* TO 'fcf_admin'@'%';
FLUSH PRIVILEGES;

SELECT 'Database leadflow_dev created successfully' AS status;
SHOW DATABASES LIKE 'leadflow_dev';
SQL

echo "==> Done! leadflow_dev is ready."
echo "==> Run the schema: node -e \"require('./src/config/database')\" in /home/paperclip/leadflow-dev/"

echo "==> Applying schema to leadflow_dev..."
docker exec -i mysql mysql -u root -p'ChangeMe_StrongRootPass!' leadflow_dev < /home/paperclip/leadflow-dev/schema_v4_complet.sql
echo "==> Schema applied!"
