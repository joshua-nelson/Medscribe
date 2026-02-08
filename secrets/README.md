# Secrets Directory

This directory contains sensitive configuration files needed for the application.

## Setup Instructions

Before running `docker compose up`, you must create the JWT secret file:

```bash
# Option 1: Copy from example and edit
cp jwt_secret.txt.example jwt_secret.txt

# Option 2: Generate a secure random secret
openssl rand -base64 32 > jwt_secret.txt
```

## Files

- `jwt_secret.txt` - JWT signing secret (Git-ignored, must be created locally)
- `jwt_secret.txt.example` - Example template for the JWT secret

## Security Notes

- Never commit `jwt_secret.txt` to version control
- Use strong, randomly-generated secrets in production
- Rotate secrets periodically according to your security policy
