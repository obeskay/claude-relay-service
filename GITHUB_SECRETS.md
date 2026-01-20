# GitHub Secrets Configuration for Protec Deployment

## Overview

This document lists all GitHub repository secrets required for the automated CI/CD pipeline to deploy to the Protec server (`admin.cloud.obeskay.com`).

## Required GitHub Secrets

### Database & Authentication

| Secret Name      | Description                                   | Example Value                                                       | Required |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------- | -------- |
| `DATABASE_URL`   | PostgreSQL connection string                  | `postgresql://user:password@localhost:5432/sub2api?sslmode=disable` | ✅ Yes   |
| `ENCRYPTION_KEY` | AES encryption key for decrypting legacy data | `32-character-random-string`                                        | ✅ Yes   |

**IMPORTANT**: The `ENCRYPTION_KEY` MUST be the same value used in your current claude-relay-service deployment to successfully decrypt OAuth tokens and other encrypted data.

### Protec Server Access

| Secret Name   | Description                         | Example Value                            | Required |
| ------------- | ----------------------------------- | ---------------------------------------- | -------- |
| `PROTEC_HOST` | Protec server hostname              | `admin.cloud.obeskay.com`                | ✅ Yes   |
| `PROTEC_USER` | SSH username                        | `obed.woow`                              | ✅ Yes   |
| `PROTEC_KEY`  | SSH private key                     | `-----BEGIN OPENSSH PRIVATE KEY-----...` | ✅ Yes   |
| `PROTEC_PORT` | SSH port (optional, defaults to 22) | `22`                                     | ❌ No    |

**SSH Key Requirements**:

- Must be in PEM format (OpenSSH or RSA)
- Should NOT have a passphrase (CI/CD automation requires key without passphrase)
- Corresponding public key must be added to `~/.ssh/authorized_keys` on Protec server

### Deployment Configuration

| Secret Name           | Description                    | Example Value        | Required                                 |
| --------------------- | ------------------------------ | -------------------- | ---------------------------------------- |
| `DEPLOY_PATH`         | Deployment directory on Protec | `/opt/sub2api`       | ❌ No (defaults to `/opt/sub2api`)       |
| `DOCKER_COMPOSE_FILE` | Docker Compose file path       | `docker-compose.yml` | ❌ No (defaults to `docker-compose.yml`) |

## How to Add GitHub Secrets

### Option 1: Using GitHub Web UI

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the **Name** and **Value** for each secret
5. Click **Add secret**
6. Repeat for all required secrets

### Option 2: Using GitHub CLI (gh)

```bash
# Add database URL
gh secret set DATABASE_URL --body "postgresql://user:password@localhost:5432/sub2api?sslmode=disable"

# Add encryption key
gh secret set ENCRYPTION_KEY --body "32-character-random-string"

# Add Protec host
gh secret set PROTEC_HOST --body "admin.cloud.obeskay.com"

# Add Protec user
gh secret set PROTEC_USER --body "obed.woow"

# Add SSH private key (from file)
gh secret set PROTEC_KEY < ~/.ssh/id_rsa

# Add optional secrets
gh secret set PROTEC_PORT --body "22"
gh secret set DEPLOY_PATH --body "/opt/sub2api"
```

## Getting Your ENCRYPTION_KEY

The ENCRYPTION_KEY is CRITICAL for the migration to succeed. It's used to decrypt:

- OAuth tokens (accessToken, refreshToken)
- Other encrypted data stored in Redis

### From Current Deployment

If you have SSH access to your current deployment server:

```bash
# Check environment variables
cat /proc/$(pgrep -f claude-relay-service)/environ | tr '\0' '\n' | grep ENCRYPTION_KEY

# Or check .env file
cat /path/to/claude-relay-service/.env | grep ENCRYPTION_KEY
```

### From Configuration File

```bash
# Check config file if it stores the key
cat config/config.js | grep ENCRYPTION_KEY
```

### If You Don't Know It

⚠️ **CRITICAL**: If you cannot locate your ENCRYPTION_KEY, the migration will FAIL for:

- OAuth token decryption
- Encrypted credentials
- Other sensitive data

**You MUST have the same ENCRYPTION_KEY** used in your current deployment.

## Generating SSH Key for CI/CD

If you don't have an SSH key for deployment:

```bash
# Generate new SSH key (no passphrase)
ssh-keygen -t ed25519 -f ~/.ssh/protec_deploy -N ""

# Copy public key to Protec server
ssh-copy-id -i ~/.ssh/protec_deploy.pub obed.woow@admin.cloud.obeskay.com

# Test SSH connection
ssh -i ~/.ssh/protec_deploy obed.woow@admin.cloud.obeskay.com

# Add private key to GitHub Secrets
cat ~/.ssh/protec_deploy | gh secret set PROTEC_KEY
```

## Testing Secrets Locally

Before adding secrets to GitHub, test them locally:

```bash
# Test database connection
psql $DATABASE_URL

# Test SSH connection
ssh -i ~/.ssh/protec_deploy -p $PROTEC_PORT $PROTEC_USER@$PROTEC_HOST

# Test encryption key (must be 32 characters)
echo $ENCRYPTION_KEY | wc -c
```

## Security Best Practices

1. **Never commit secrets to git** - Use GitHub Secrets only
2. **Rotate keys regularly** - Update secrets and deploy new keys
3. **Use strong encryption keys** - 32+ random characters
4. **Limit SSH key permissions** - Read-only for the deploy user
5. **Monitor deployment logs** - Check for secret exposure
6. **Use keyless authentication** - GitHub OIDC provider (advanced)

## Troubleshooting

### SSH Connection Fails

```
Error: Permission denied (publickey)
```

**Solutions**:

1. Verify SSH private key is in correct format (starts with `-----BEGIN`)
2. Ensure public key is added to `~/.ssh/authorized_keys` on Protec
3. Check SSH user is correct (`obed.woow`)
4. Verify PROTEC_HOST is correct (`admin.cloud.obeskay.com`)

### Database Connection Fails

```
Error: connection refused
```

**Solutions**:

1. Verify PostgreSQL is running on Protec
2. Check DATABASE_URL format
3. Ensure firewall allows database connections
4. Verify database credentials

### ENCRYPTION_KEY Wrong

```
Error: decryption failed
```

**Solutions**:

1. Ensure ENCRYPTION_KEY is exactly 32 characters
2. Verify it matches the key from current deployment
3. Check for whitespace or special characters
4. Migration will fail if key doesn't match

### Workflow Fails with Missing Secret

```
Error: Required secret not found
```

**Solutions**:

1. Check secret name matches exactly (case-sensitive)
2. Verify secret is added at repository level (not organization)
3. Check repository permissions for GitHub Actions

## Quick Reference

```bash
# Required secrets (minimum)
DATABASE_URL
ENCRYPTION_KEY
PROTEC_HOST
PROTEC_USER
PROTEC_KEY

# Optional secrets
PROTEC_PORT (default: 22)
DEPLOY_PATH (default: /opt/sub2api)
DOCKER_COMPOSE_FILE (default: docker-compose.yml)
```

## Next Steps

1. ✅ Add all required GitHub secrets
2. ✅ Test secrets locally if possible
3. ✅ Push to `main-v2` branch
4. ✅ Monitor GitHub Actions workflow execution
5. ✅ Verify deployment succeeded

## Contact

For issues with GitHub Secrets configuration:

1. Check GitHub Actions logs
2. Verify secret values are correct
3. Ensure SSH key has correct permissions
4. Contact repository maintainer if needed
