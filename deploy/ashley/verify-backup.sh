#!/usr/bin/env bash
set -euo pipefail

bucket=gs://cited-alpha-20260701-ashley-trial-backups/daily
latest=$(gcloud storage ls "$bucket/*.tar.gz" | sort | tail -1)
test -n "$latest"
stamp=${latest##*/}
stamp=${stamp%.tar.gz}
tmp=$(mktemp -d /srv/ashley/data/restore-check.XXXXXX)
container=ashley-restore-check-mongo
cleanup() {
  docker stop "$container" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
gcloud storage cp "$latest" "$bucket/$stamp.sha256" "$tmp/" >/dev/null
cd "$tmp"
sha256sum -c "$stamp.sha256"
mkdir restored
tar -xzf "$stamp.tar.gz" -C restored
test "$(sqlite3 restored/selection/selection.sqlite 'PRAGMA integrity_check')" = ok
test -d restored/meili
docker run -d --rm --name "$container" --memory=1024m \
  mirror.gcr.io/library/mongo@sha256:098862b1339f031900ca66cf8fef799e616d6324fa41b9a263f2ec899552c1ef \
  --noauth >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$container" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$container" mongorestore --archive --drop <restored/mongo.archive >/dev/null
docker exec "$container" mongosh LibreChat --quiet --eval 'db.getCollectionNames().length' | grep -Eq '^[1-9][0-9]*$'
echo "Verified $stamp: archive checksum, SQLite integrity and MongoDB restore"
