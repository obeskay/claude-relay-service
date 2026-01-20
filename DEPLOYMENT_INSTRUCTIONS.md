# Deployment Instructions for Protec Server

## Quick Start (3 Options)

### Option 1: Automated Deployment via GitHub Actions (Recommended)

**Prerequisites**: SSH access to Protec server

1. **Generate SSH Key** (on your local machine):

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/protec_deploy -N ""
   ```

2. **Add Public Key to Protec**:

   ```bash
   ssh-copy-id -i ~/.ssh/protec_deploy.pub obed.woow@admin.cloud.obeskay.com
   ```

3. **Copy Private Key**:

   ```bash
   cat ~/.ssh/protec_deploy
   ```

   Copy the output (starts with `-----BEGIN OPENSSH PRIVATE KEY-----`)

4. **Add GitHub Secrets**:
   - Go to: https://github.com/obeskay/claude-relay-service/settings/secrets/actions
   - Click "New repository secret"
   - Add the following secrets:

   | Name             | Value                                                               | Required |
   | ---------------- | ------------------------------------------------------------------- | -------- |
   | `DATABASE_URL`   | `postgresql://user:password@localhost:5432/sub2api?sslmode=disable` | ✅ Yes   |
   | `ENCRYPTION_KEY` | Your 32-character encryption key from current deployment            | ✅ Yes   |
   | `PROTEC_HOST`    | `admin.cloud.obeskay.com`                                           | ✅ Yes   |
   | `PROTEC_USER`    | `obed.woow`                                                         | ✅ Yes   |
   | `PROTEC_KEY`     | [paste SSH private key from step 3]                                 | ✅ Yes   |

5. **Wait for CI/CD**:
   - Push already done at: https://github.com/obeskay/claude-relay-service/tree/main-v2
   - Watch workflow at: https://github.com/obeskay/claude-relay-service/actions
   - Deployment will run automatically

### Option 2: Manual Deployment (Step-by-Step)

If you can't use SSH, follow the manual guide:

1. **Access Protec Server**:
   - SSH: `ssh obed.woow@admin.cloud.obeskay.com`
   - Or via admin panel: https://admin.cloud.obeskay.com

2. **Follow Manual Guide**:
   - Read: `MANUAL_DEPLOYMENT_GUIDE.md`
   - Execute commands in guide sequentially
   - Verify each step succeeds before proceeding

3. **Key Steps**:
   - Set up PostgreSQL
   - Configure environment variables
   - Apply SQL migration
   - Run migration script
   - Verify deployment

### Option 3: Get Your ENCRYPTION_KEY

If you can provide your ENCRYPTION_KEY, I can help test and prepare everything.

**How to find ENCRYPTION_KEY**:

From your current deployment:

```bash
# If running as service
cat /proc/$(pgrep -f claude-relay-service)/environ | tr '\0' '\n' | grep ENCRYPTION_KEY

# Or from .env file
cat /path/to/claude-relay-service/.env | grep ENCRYPTION_KEY

# Or from config
cat config/config.js | grep ENCRYPTION_KEY
```

Once you have ENCRYPTION_KEY, provide it to me and I can:

- Verify the migration script
- Test OAuth token decryption
- Validate data transformation

## Critical Information

### Your Credentials

- **Email**: obeskay.mail@gmail.com
- **Password**: iQf1nd3r00!
- **Target**: admin.cloud.obeskay.com
- **Admin Panel**: https://admin.cloud.obeskay.com

### ENCRYPTION_KEY is CRITICAL

⚠️ **The ENCRYPTION_KEY MUST match your current deployment**

Without the correct ENCRYPTION_KEY:

- ❌ OAuth tokens will NOT decrypt
- ❌ User credentials will be LOST
- ❌ Account access will be BROKEN
- ❌ Migration will FAIL

### What We've Already Done

✅ **Completed (11/21 tasks)**:

- Migration script created and ready
- CI/CD pipeline configured
- All documentation written
- SQL migration file created
- GitHub secrets guide provided
- Pushed to main-v2 branch

❌ **Pending (10/21 tasks)**:

- All require Protec server access
- Cannot proceed without deployment

## Files Ready for Deployment

All files are already committed and pushed to main-v2:

- `scripts/migrate-complete.js` - Migration script
- `MANUAL_DEPLOYMENT_GUIDE.md` - Manual deployment instructions
- `GITHUB_SECRETS.md` - GitHub secrets configuration
- `MIGRATION_STATUS_REPORT.md` - Complete status report

**Branch URL**: https://github.com/obeskay/claude-relay-service/tree/main-v2

## Verification Steps

After deployment, verify:

1. **API Keys Work**:

   ```bash
   # Test with existing cr_ API key
   curl -X POST https://admin.cloud.obeskay.com/api/v1/messages \
     -H "x-api-key: cr_your_api_key" \
     -H "content-type: application/json" \
     -d '{"model": "claude-3-5-sonnet-20241022", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello"}]}'
   ```

2. **User Login Works**:
   - Go to: https://admin.cloud.obeskay.com
   - Login: obeskay.mail@gmail.com / iQf1nd3r00!
   - Verify successful login

3. **Usage Statistics**:
   - Check API key usage statistics
   - Verify token counts match before migration

4. **Health Check**:

   ```bash
   curl https://admin.cloud.obeskay.com/health
   ```

   Should return `200 OK`

5. **Monitor Logs**:
   - Check for decryption errors
   - Monitor for OAuth token refresh issues
   - Verify all services start correctly

## Troubleshooting

### CI/CD Workflow Fails

**Problem**: Workflow stops or shows errors

**Solutions**:

1. Check GitHub Actions logs for specific error
2. Verify all secrets are added correctly
3. Ensure SSH key has correct permissions (read-only)
4. Verify DATABASE_URL format is correct
5. Check ENCRYPTION_KEY is exactly 32 characters

### Migration Script Fails

**Problem**: Script reports decryption errors

**Solutions**:

1. Verify ENCRYPTION_KEY matches current deployment
2. Check Redis is running and accessible
3. Verify PostgreSQL is running
4. Check DATABASE_URL is correct
5. Verify migration script has correct permissions

### API Keys Don't Work

**Problem**: `cr_` prefixed keys return 401 unauthorized

**Solutions**:

1. Verify hash mapping table was created
2. Check migration script completed successfully
3. Verify API key exists in PostgreSQL
4. Check hash was generated correctly
5. Test hash with SHA-256 of API key

### Login Fails

**Problem**: Can't login with existing credentials

**Solutions**:

1. Verify user was migrated correctly
2. Check password hashing worked
3. Verify user table has correct data
4. Check authentication middleware is working
5. Reset password if needed

## Documentation

All documentation is available in the main-v2 branch:

- **MIGRATION_STATUS_REPORT.md** - Complete status and what's next
- **MANUAL_DEPLOYMENT_GUIDE.md** - Step-by-step manual deployment
- **GITHUB_SECRETS.md** - GitHub secrets configuration
- **MIGRATION_QUICKSTART.md** - Quick start guide
- **FULL_MIGRATION_PLAN.md** - Complete migration plan
- **MIGRATION_STRATEGY.md** - Architecture comparison
- **MIGRATION_README.md** - Commands and troubleshooting

## Contact

For issues or questions:

1. **Check documentation first** - Most issues are covered in guides
2. **Review GitHub Actions logs** - See specific error messages
3. **Check server logs** - Look for runtime errors
4. **Provide ENCRYPTION_KEY** - If deployment fails due to decryption

## Next Steps

### Immediate Actions

1. **Choose deployment method**:
   - SSH access + GitHub secrets (recommended, automated)
   - Manual deployment following guide
   - Provide ENCRYPTION_KEY for testing

2. **Get ENCRYPTION_KEY**:
   - Check current deployment environment variables
   - Copy to safe location
   - Add to GitHub secrets

3. **Configure GitHub Secrets**:
   - Add all required secrets
   - Verify secrets are correct
   - Test if possible

4. **Monitor Deployment**:
   - Watch GitHub Actions workflow
   - Check for errors
   - Verify health endpoint

### After Deployment

1. **Verify everything works**:
   - API keys authenticate
   - Users can login
   - Usage stats correct
   - All endpoints work

2. **Monitor for 24-48 hours**:
   - Check logs regularly
   - Monitor for errors
   - Verify OAuth token refresh

3. **Keep old system running**:
   - Don't shut down immediately
   - Run in parallel for testing
   - Cut over traffic gradually

4. **Rollback plan**:
   - Keep backup of data
   - Have rollback procedure ready
   - Test rollback process

## Summary

**Status**: Migration infrastructure complete, waiting for server deployment
**Completed**: 11/21 tasks (52%)
**Remaining**: 10 tasks (require Protec server access)
**Branch**: main-v2 (https://github.com/obeskay/claude-relay-service/tree/main-v2)
**Next Action**: Choose deployment method and provide access/credentials

---

**All preparation work is complete. The remaining steps require access to Protec server.**

**Please choose one of the three options above to proceed.**
