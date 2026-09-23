#!/usr/bin/env bash
set -euo pipefail
cd /srv/ashley/release
MONGO_PASSWORD=$(python3 -c 'print(next(line.split("=", 1)[1].strip() for line in open("/srv/ashley/runtime/app.env") if line.startswith("MONGO_PASSWORD=")))')
stamp=$(date -u +%Y%m%dT%H%M%SZ)
tmp=$(mktemp -d /srv/ashley/data/backup.XXXXXX)
cleanup() {
  docker compose --env-file /srv/ashley/runtime/app.env up -d meilisearch selection-demo api >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
docker compose --env-file /srv/ashley/runtime/app.env stop api selection-demo meilisearch
docker compose --env-file /srv/ashley/runtime/app.env exec -T mongodb mongodump \
  --username root --password "$MONGO_PASSWORD" --authenticationDatabase admin \
  --archive >"$tmp/mongo.archive"
cp -a /srv/ashley/data/selection "$tmp/selection"
cp -a /srv/ashley/data/meili "$tmp/meili"
cp -a /srv/ashley/data/appdata "$tmp/appdata"
cp -a /srv/ashley/data/images "$tmp/images"
cp -a /srv/ashley/data/uploads "$tmp/uploads"
cp /srv/ashley/release/manifest.json "$tmp/manifest.json"
tar -C "$tmp" -czf "/srv/ashley/data/ashley-$stamp.tar.gz" .
(cd /srv/ashley/data && sha256sum "ashley-$stamp.tar.gz" >"ashley-$stamp.sha256")
gcloud storage cp "/srv/ashley/data/ashley-$stamp.tar.gz" "/srv/ashley/data/ashley-$stamp.sha256" \
  gs://cited-alpha-20260701-ashley-trial-backups/daily/
rm -f "/srv/ashley/data/ashley-$stamp.tar.gz" "/srv/ashley/data/ashley-$stamp.sha256"
