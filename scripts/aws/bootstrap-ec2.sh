#!/usr/bin/env bash
set -euo pipefail

# Amazon Linux 2023 bootstrap for Docker + Compose
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user

sudo mkdir -p /opt/shortys-inventory
sudo chown -R ec2-user:ec2-user /opt/shortys-inventory

echo "Bootstrap complete. Reconnect SSH once so docker group membership applies."
