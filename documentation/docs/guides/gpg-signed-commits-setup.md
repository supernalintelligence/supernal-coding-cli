---
title: GPG Signed Commits Setup Guide
category: developer-guide
status: needs_approval
created: 2025-12-03
updated: 2025-12-03
---

# GPG Signed Commits Setup Guide

This guide helps you configure GPG signing for git commits, enabling cryptographic verification of document approvals per ADR-001.

## Why Sign Commits?

- **Identity Verification**: Proves who made changes
- **Non-Repudiation**: Approvers cannot deny they approved
- **Compliance**: Meets FDA 21 CFR Part 11 electronic signature requirements
- **Audit Trail**: Cryptographic proof in git history

## Quick Setup (macOS)

### 1. Install GPG

```bash
# Using Homebrew
brew install gnupg pinentry-mac

# Configure pinentry for macOS
echo "pinentry-program $(brew --prefix)/bin/pinentry-mac" >> ~/.gnupg/gpg-agent.conf
gpgconf --kill gpg-agent
```

### 2. Generate a Key

```bash
# Generate new GPG key
gpg --full-generate-key

# Select:
# - (1) RSA and RSA
# - 4096 bits
# - Key does not expire (or set expiration)
# - Enter your name and email (must match git config)
```

### 3. Get Your Key ID

```bash
# List your keys
gpg --list-secret-keys --keyid-format=long

# Output example:
# sec   rsa4096/ABCD1234EF567890 2025-12-03 [SC]
#       Key fingerprint = XXXX XXXX XXXX XXXX XXXX XXXX ABCD 1234 EF56 7890
# uid                 [ultimate] Your Name <your.email@example.com>

# Your key ID is: ABCD1234EF567890
```

### 4. Configure Git

```bash
# Set your signing key
git config --global user.signingkey ABCD1234EF567890

# Enable signing by default
git config --global commit.gpgsign true

# Set GPG program (if needed)
git config --global gpg.program gpg
```

### 5. Test Signing

```bash
# Create a signed commit
git commit -S -m "Test signed commit"

# Verify the signature
git log --show-signature -1
```

## Quick Setup (Linux)

### 1. Install GPG

```bash
# Ubuntu/Debian
sudo apt-get install gnupg

# Fedora/RHEL
sudo dnf install gnupg2
```

### 2. Follow Steps 2-5 Above

Same as macOS after GPG is installed.

## Quick Setup (Windows)

### 1. Install Gpg4win

Download from: https://www.gpg4win.org/

### 2. Configure Git for Gpg4win

```bash
git config --global gpg.program "C:/Program Files (x86)/GnuPG/bin/gpg.exe"
```

### 3. Follow Steps 2-5 Above

## SSH Signing (Alternative)

Git 2.34+ supports SSH key signing as an alternative to GPG.

```bash
# Configure SSH signing
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
```

## GitHub/GitLab Integration

### Add GPG Key to GitHub

1. Export your public key:
   ```bash
   gpg --armor --export ABCD1234EF567890
   ```

2. Go to GitHub → Settings → SSH and GPG keys → New GPG key

3. Paste the exported key

### Verify on GitHub

Commits will show "Verified" badge when:
- Key is added to GitHub
- Commit email matches GitHub email
- Signature is valid

## Team Registration

Register your key in the people configuration for approval workflow:

```yaml
# .supernal/config/people.yaml
users:
  - id: your-id
    name: Your Name
    email: your.email@example.com
    github: your-github-username
    gpg_key_id: ABCD1234EF567890  # Add this line
```

## Using Signed Commits

### Manual Signing

```bash
# Sign a specific commit
git commit -S -m "[DOC] Update SOP status"

# Sign when amending
git commit --amend -S
```

### Automatic Signing

With `commit.gpgsign = true`, all commits are signed automatically.

### Verify Signatures

```bash
# Check commit signature
git verify-commit HEAD

# Show signature in log
git log --show-signature

# Using sc docs history
sc docs history docs/workflow/sops/SOP-0.1.01.md
# Shows ✓ for signed, ✗ for unsigned
```

## Troubleshooting

### "gpg failed to sign the data"

```bash
# Restart gpg-agent
gpgconf --kill gpg-agent

# Check GPG_TTY is set
export GPG_TTY=$(tty)

# Add to ~/.bashrc or ~/.zshrc
echo 'export GPG_TTY=$(tty)' >> ~/.zshrc
```

### "No secret key"

```bash
# Verify key ID matches
gpg --list-secret-keys --keyid-format=long

# Update git config if needed
git config --global user.signingkey YOUR_ACTUAL_KEY_ID
```

### "Cannot open '/dev/tty'"

When signing in scripts or CI:

```bash
# Use loopback pinentry
echo "use-agent" >> ~/.gnupg/gpg.conf
echo "pinentry-mode loopback" >> ~/.gnupg/gpg.conf
```

### Key Expired

```bash
# Extend key expiration
gpg --edit-key ABCD1234EF567890
gpg> expire
# Follow prompts
gpg> save
```

## Best Practices

1. **Use Strong Keys**: RSA 4096-bit or ED25519
2. **Set Expiration**: 1-2 years, extend when needed
3. **Backup Your Key**: Store securely offline
4. **Use Passphrase**: Always protect your private key
5. **Revoke Compromised Keys**: Generate new key if compromised

## Backup and Recovery

### Export Private Key

```bash
# Export private key (KEEP SECURE!)
gpg --export-secret-keys ABCD1234EF567890 > private-key.gpg

# Export public key
gpg --export ABCD1234EF567890 > public-key.gpg
```

### Import Key on New Machine

```bash
gpg --import private-key.gpg
gpg --import public-key.gpg

# Trust the key
gpg --edit-key ABCD1234EF567890
gpg> trust
# Select 5 (ultimate)
gpg> save
```

## Related Documentation

- [ADR-001: Signed Commit Verification](../features/workflow-management/approval-workflow-system/design/adr-001-signed-commit-verification.md)
- [Document Approval Workflow](../features/workflow-management/approval-workflow-system/README.md)
- [Git Documentation: Signing Commits](https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work)

