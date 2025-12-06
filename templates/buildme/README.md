# BUILDME Template System

Comprehensive build script templates for Supernal Coding projects with auto-detection and multi-language support.

## Overview

The BUILDME system provides intelligent, self-configuring build scripts that:

- **Auto-detect** project type (Node.js, Python, Go, Rust, Java, Ruby, PHP)
- **Read configuration** from `supernal.yaml`
- **Run appropriate** build commands based on project structure
- **Execute smoke tests** to validate builds
- **Support CI/CD** with quiet mode and standardized exit codes

## Quick Start

### 1. Copy Base Template

```bash
# Copy the universal build script to your project root
cp templates/buildme/BUILDME-BASE.sh ./BUILDME.sh
chmod +x BUILDME.sh

# Run the build
./BUILDME.sh
```

### 2. Or Use Project-Specific Template

```bash
# For Node.js projects
cp templates/buildme/examples/BUILDME-nodejs.sh ./BUILDME.sh

# For Python projects
cp templates/buildme/examples/BUILDME-python.sh ./BUILDME.sh

# For Monorepos
cp templates/buildme/examples/BUILDME-monorepo.sh ./BUILDME.sh

chmod +x BUILDME.sh
```

## Available Templates

### 📦 BUILDME-BASE.sh (Universal)

**Best for:** Any project type
**Features:**

- Automatic project type detection
- Support for 8+ languages/frameworks
- Reads config from `supernal.yaml`
- Intelligent dependency management
- Built-in smoke tests

**Supported Project Types:**

- Node.js (package.json)
- Python (requirements.txt, setup.py, pyproject.toml)
- Go (go.mod)
- Rust (Cargo.toml)
- Java (pom.xml, build.gradle)
- Ruby (Gemfile)
- PHP (composer.json)
- Make (Makefile)

### 🟢 BUILDME-nodejs.sh

**Best for:** Node.js/TypeScript projects
**Features:**

- Package manager detection (npm/yarn/pnpm)
- TypeScript type checking
- ESLint integration
- Smoke test support

### 🐍 BUILDME-python.sh

**Best for:** Python projects
**Features:**

- Virtual environment management
- Poetry support
- Flake8/Pylint linting
- Mypy type checking
- Pytest integration

### 📚 BUILDME-monorepo.sh

**Best for:** Monorepo projects
**Features:**

- Detects monorepo tool (pnpm/lerna/nx/turbo)
- Parallel builds
- Workspace management
- Affected project detection

## Configuration

### Using supernal.yaml

The BUILDME system reads configuration from your `supernal.yaml`:

```yaml
build:
  command: 'npm run build'
  test: 'npm test'
  lint: 'npm run lint'

scripts:
  pre_build:
    - 'npm run lint'
    - 'npm run type-check'
  post_build:
    - 'npm run test:smoke'

project:
  type: 'nodejs'
  runtime: 'node:18'
```

### Command Line Options

All BUILDME scripts support these options:

```bash
./BUILDME.sh [options]

Options:
  --quiet, -q           Minimize output (CI-friendly)
  --no-colors          Disable colored output
  --no-smoke-tests     Skip smoke tests
  --skip-deps          Skip dependency installation
  --help, -h           Show help message
```

## Examples

### Node.js with TypeScript

```bash
# Install dependencies and build
./BUILDME.sh

# CI mode (quiet, no colors)
./BUILDME.sh --quiet --no-colors

# Quick rebuild (skip deps)
./BUILDME.sh --skip-deps
```

### Python with Poetry

```bash
# Full build with virtual environment
./BUILDME.sh

# Skip tests for faster builds
./BUILDME.sh --no-smoke-tests
```

### Monorepo with pnpm

```bash
# Build all packages
./BUILDME.sh

# Parallel builds
PARALLEL=true ./BUILDME.sh
```

## Integration with Supernal Coding

### Automatic Detection

BUILDME integrates with Supernal Coding's project detection:

```bash
# BUILDME reads from supernal.yaml
sc init  # Creates supernal.yaml
# Add build configuration
./BUILDME.sh  # Uses configuration automatically
```

### Git Hooks

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
./BUILDME.sh --quiet --no-smoke-tests
```

### CI/CD Integration

#### GitHub Actions

```yaml
- name: Build Project
  run: ./BUILDME.sh --quiet --no-colors
```

#### GitLab CI

```yaml
build:
  script:
    - chmod +x BUILDME.sh
    - ./BUILDME.sh --quiet
```

## Project Type Detection Logic

The base template detects project type by checking for:

1. **Node.js**: `package.json` exists
2. **Python**: `requirements.txt`, `setup.py`, or `pyproject.toml`
3. **Go**: `go.mod` exists
4. **Rust**: `Cargo.toml` exists
5. **Java**: `pom.xml` or `build.gradle`
6. **Ruby**: `Gemfile` exists
7. **PHP**: `composer.json` exists
8. **Make**: `Makefile` exists

## Smoke Tests

Each project type includes intelligent smoke tests:

### Node.js

- Module import validation
- `test:smoke` script if available

### Python

- Package import test
- Basic pytest run

### Go

- Quick test suite (`go test -short`)

### Rust

- Cargo test (release mode)

## Advanced Usage

### Custom Build Commands

Override detection in `supernal.yaml`:

```yaml
build:
  command: 'make custom-build'
  test: 'make test'
```

### Environment-Specific Builds

```bash
# Development build
NODE_ENV=development ./BUILDME.sh

# Production build
NODE_ENV=production ./BUILDME.sh --no-smoke-tests
```

### Multi-Stage Builds

Create a Docker-friendly BUILDME:

```dockerfile
FROM node:18

COPY . /app
WORKDIR /app

# Use BUILDME for consistent builds
RUN chmod +x BUILDME.sh && ./BUILDME.sh --quiet
```

## Troubleshooting

### Build Fails with "Unknown project type"

**Solution:** Create a `supernal.yaml` with explicit build command:

```yaml
build:
  command: 'your-build-command'
```

### Dependencies Not Installing

**Solution:** Check package manager files exist:

- Node.js: `package.json` or `package-lock.json`
- Python: `requirements.txt` or `setup.py`
- Go: `go.mod`

### Smoke Tests Failing

**Solution:** Skip smoke tests during development:

```bash
./BUILDME.sh --no-smoke-tests
```

## Migration from Legacy BUILDME

If you have an old BUILDME.sh:

```bash
# Backup old version
mv BUILDME.sh BUILDME.sh.old

# Copy new template
cp templates/buildme/BUILDME-BASE.sh ./BUILDME.sh
chmod +x BUILDME.sh

# Migrate custom logic if needed
```

## Best Practices

1. **Keep it executable**: `chmod +x BUILDME.sh`
2. **Commit to repo**: Include BUILDME.sh in version control
3. **Use in CI**: Standardizes builds across environments
4. **Configure via YAML**: Use `supernal.yaml` for project-specific settings
5. **Test locally**: Run BUILDME before committing

## Contributing

To add support for a new project type:

1. Add detection logic to `detect_project_type()`
2. Create `build_<type>()` function
3. Add smoke test in `smoke_test_<type>()`
4. Update documentation

## See Also

- [TESTME.sh Templates] (see project documentation) - Companion testing scripts
- [Supernal Coding Docs] (see project documentation) - Full documentation
- [Configuration Guide] (see project documentation)
