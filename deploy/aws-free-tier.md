# AWS Free-Tier Deployment (Single EC2)

This deployment target is optimized for cost: one free-tier EC2 instance running both the app and Postgres in Docker.

## 1) Create EC2 (Free Tier)

- AMI: Amazon Linux 2023
- Instance type: t3.micro (or t2.micro where available)
- Storage: 20 GB gp3
- Security group inbound:
  - 22/tcp from your IP
  - 80/tcp from 0.0.0.0/0

## 2) Bootstrap the instance

SSH into the box and run:

```bash
cd /tmp
curl -fsSL https://raw.githubusercontent.com/<your-org>/<your-repo>/<your-branch>/scripts/aws/bootstrap-ec2.sh -o bootstrap-ec2.sh
bash bootstrap-ec2.sh
```

If you are not using GitHub yet, copy scripts/aws/bootstrap-ec2.sh manually and run it.

Reconnect SSH after bootstrap.

## 3) Upload project files

From your local machine, copy the repository to /opt/shortys-inventory.

Windows PowerShell example:

```powershell
scp -i C:\path\to\your-key.pem -r .\* ec2-user@<EC2_PUBLIC_IP>:/opt/shortys-inventory/
```

## 4) Configure environment

On EC2:

```bash
cd /opt/shortys-inventory
cp .env.aws.example .env.aws
nano .env.aws
```

Set strong POSTGRES_PASSWORD and real Toast/XtraCHEF values.

## 5) Deploy

```bash
cd /opt/shortys-inventory
bash scripts/aws/deploy-ec2.sh
```

## 6) Validate

- App health: http://<EC2_PUBLIC_IP>/api/health
- Sync status: http://<EC2_PUBLIC_IP>/api/integrations/toast/sync

## Notes

- Data persistence is on a Docker volume (shortys_pgdata) tied to instance storage.
- For production hardening, move Postgres to RDS and place EC2 behind an ALB with TLS.
- Free-tier coverage depends on your account age and region eligibility.
