#!/usr/bin/env bash
set -euo pipefail

disk=/dev/disk/by-id/google-ashley-trial-data
mountpoint=/srv/ashley

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 jq sqlite3
sudo systemctl enable --now docker
if ! sudo blkid "$disk" >/dev/null 2>&1; then
  sudo mkfs.ext4 -F "$disk"
fi
uuid=$(sudo blkid -s UUID -o value "$disk")
sudo mkdir -p "$mountpoint"
if ! grep -q "$uuid" /etc/fstab; then
  echo "UUID=$uuid $mountpoint ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab >/dev/null
fi
sudo mount "$mountpoint" || true
mountpoint -q "$mountpoint"
sudo mkdir -p "$mountpoint"/{release,runtime,data/{appdata,images,uploads,selection,mongo,meili,redis,caddy}}
sudo chown -R 1000:1000 "$mountpoint/data/appdata" "$mountpoint/data/images" "$mountpoint/data/uploads" "$mountpoint/data/selection"
sudo chmod 700 "$mountpoint/runtime"
sudo chmod 750 "$mountpoint/release"
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo install -m 644 "$(dirname "$0")/docker-data-mount.conf" /etc/systemd/system/docker.service.d/ashley-data-mount.conf
sudo systemctl daemon-reload
sudo systemctl enable docker
