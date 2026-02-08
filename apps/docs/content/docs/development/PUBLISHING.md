---
title: Publishing to npm
description: Guide for publishing the `create-respondeo-app` package to npm, including GitHub Actions setup and manual steps.
---

## Publishing to npm

This repository uses GitHub Actions to automatically publish packages to npm.

## Setup

1. **Create npm Access Token**
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token" → "Granular Access Token"
   - Set token name (e.g., `github-actions-respondeo`)
   - Set expiration as needed
   - Select packages: `create-respondeo-app`
   - Permissions: Read and write
   - Copy the token

2. **Add Secret to GitHub**
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste the npm token
   - Click "Add secret"

## Publishing Workflow

### Automatic (Recommended)

1. Update version in `packages/create-respondeo-app/package.json`:

   ```bash
   cd packages/create-respondeo-app
   # Update version number manually or use:
   npm version patch  # 0.1.0 → 0.1.1
   npm version minor  # 0.1.0 → 0.2.0
   npm version major  # 0.1.0 → 1.0.0
   ```

2. Commit and push the version change:

   ```bash
   git add packages/create-respondeo-app/package.json
   git commit -m "chore: bump create-respondeo-app to v0.2.0"
   git push
   ```

3. Create a GitHub Release:
   - Go to https://github.com/sebdanielsson/respondeo/releases/new
   - Tag: `create-respondeo-app-v0.2.0` (or just `v0.2.0`)
   - Title: `create-respondeo-app v0.2.0`
   - Description: Add release notes
   - Click "Publish release"

4. The GitHub Action will automatically:
   - Build the package
   - Run type checking
   - Publish to npm with provenance

### Manual Trigger

You can also manually trigger the publish workflow:

1. Go to Actions → Publish to npm → Run workflow
2. Select the package to publish
3. Click "Run workflow"

## Verification

After publishing:

1. Check npm: https://www.npmjs.com/package/create-respondeo-app
2. Test installation:
   ```bash
   bun create respondeo-app test-app
   ```

## Important Notes

- **Provenance**: The workflow uses `--provenance` flag for attestation (requires npm 9.5.0+)
- **Access**: Published as public package (`--access public`)
- **Version**: Must manually bump version before releasing (no automatic versioning)
- **Permissions**: Workflow needs `id-token: write` for provenance

## Troubleshooting

### Publishing Fails with 403

- Verify `NPM_TOKEN` secret is set correctly
- Ensure npm token has write permissions for the package
- Check if package name is available on npm

### Version Already Exists

- You cannot republish the same version
- Bump the version in package.json before releasing

### Build Fails

- Ensure all tests pass locally first
- Check CI workflow passes on main branch
- Review build logs in GitHub Actions
