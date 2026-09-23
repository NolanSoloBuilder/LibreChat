# Ashley trial deployment

Public entry: `https://ashley.forgepane.com`. GCP project: `cited-alpha-20260701`; VM: `ashley-trial-vm` in `asia-southeast1-b`. Cloudflare hosts the unproxied DNS record; Caddy manages HTTPS on the VM. The dedicated persistent disk is mounted at `/srv/ashley`. All application containers use digest-pinned images in `compose.yaml` and the release record is `release-manifest.json`.

The invited accounts are stored in Secret Manager as `ashley-trial-accounts`. Retrieve and distribute each account through a private channel; do not place passwords in tickets, commits or this guide. Public registration is disabled. The two `USER` accounts have explicit viewer permission on the private Ashley Assistant Agent. The admin account is for provisioning only. Agent conversations and saved selection tasks are owner-scoped.

`branding/ashley/librechat.yaml` sets the saved Ashley Agent as the new-chat default. Its `agent_id` must match the restored database or the ID returned by `provision-on-vm.sh` when initializing a fresh database. Verify a new chat shows “Ashley Assistant” before sharing the trial URL.

## Release

1. Build the application image with Cloud Build and record its resulting digest, build ID and source archive in `release-manifest.json`.
2. Copy this directory, `branding/ashley/librechat.yaml`, `branding/ashley/logo.svg` and `branding/ashley/icon.png` to `/srv/ashley/release` on the VM. Set `ASHLEY_IMAGE` in the restricted runtime env file to the new digest.
3. Run `docker compose --env-file /srv/ashley/runtime/app.env up -d` from `/srv/ashley/release`, then run `provision-on-vm.sh`. Keep the dedicated Vertex identity and application keys in Secret Manager.
4. Check `https://ashley.forgepane.com/api/config`, a normal answer, an open selection task, a sourced public search, and a saved draft readback with each invited account.

`services/selection-demo/instructions-local.md` keeps local validation on Codewiz. The deployed Agent uses Vertex AI Gemini and `instructions.md`. `search_public_web` calls Vertex AI Google Search grounding through the VM service identity and returns only source URLs present in provider grounding metadata. Business tools use deterministic synthetic data and never create real listings or purchase orders.

## Backup and recovery

The `ashley-trial-backup.timer` runs daily. `backup.sh` stops the API, selection service and Meilisearch briefly, dumps MongoDB, copies the selection SQLite database and persistent application/search files, computes a checksum, then uploads the archive to the private GCS bucket `cited-alpha-20260701-ashley-trial-backups` (`daily/`, 30-day lifecycle). Services restart on script exit. `verify-backup.sh` downloads the latest archive and checksum, checks SQLite integrity and restores MongoDB into a temporary isolated container. To restore production, stop application containers and restore the verified archive and Mongo dump to the persistent disk before restarting; first verify the release manifest and Secret Manager versions.

Cloud Monitoring uptime check `Ashley Trial HTTPS` probes `/api/config` from three regions every five minutes. The trial VM and disk have `application=ashley-trial` labels for the infrastructure budget; unlabelled Vertex AI charges are covered only by the project's broader budget alert. Message rate limits and per-user concurrency limits are set in the runtime env.
