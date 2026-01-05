#!/usr/bin/env bash
set -euo pipefail
cd /opt/doc2loc
sudo docker build -t doc2loc-app:latest .
sudo docker rm -f doc2loc 2>/dev/null || true
sudo docker run -d \
  --name doc2loc \
  --restart unless-stopped \
  --env-file /opt/doc2loc/.env \
  --network doc2loc-net \
  -p 3000:3000 \
  doc2loc-app:latest
sudo docker logs --tail 30 doc2loc
