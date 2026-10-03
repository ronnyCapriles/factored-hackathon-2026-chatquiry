#!/bin/bash
set -euxo pipefail

dnf install -y docker git
systemctl enable --now docker

# AL2023 does not package the compose plugin.
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Headroom for the 2 GB box when migrations or a burst of conversations spike memory.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  echo '/swapfile none swap defaults 0 0' >> /etc/fstab
fi
swapon -a

mkdir -p /opt/chatquiry
