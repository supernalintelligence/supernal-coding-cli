# Build Guidelines

This document provides guidance on effective build script practices for AI-assisted development environments.

## Build Script Philosophy

### For AI Consumption

- **Minimize Output**: Keep build logs concise for AI parsing and understanding
- **Clear Status Messages**: Use consistent prefixes like "Building...", "Testing...", "Complete"
- **Structured Output**: Use consistent formatting for easy pattern recognition
- **Error Clarity**: Provide clear, actionable error messages with specific failure points

### For Human Developers

- **Colored Output**: Use colors to highlight important information and status
- **Progress Indicators**: Show build progress and current status clearly
- **Contextual Information**: Provide helpful context for debugging issues
- **Visual Feedback**: Use emojis and formatting for better user experience

## Implementation Example

See [`BUILDME.sh`](./BUILDME.sh) in this project for a reference implementation that demonstrates:

- **Dual-mode output** (AI-optimized vs human-readable)
- **Proper error handling** with clear status reporting
- **Integration of smoke tests** for immediate error detection
- **Configurable verbosity levels** via command-line flags
- **Color-coded status messages** for human readability

## Core Build Script Principles

### 1. Intelligent Output Management

```bash
# AI-optimized minimal output
log_ai() {
    if [[ "$QUIET_MODE" == "false" ]]; then
        echo "$1"
    fi
}

# Human-friendly colored output
log_human() {
    if [[ "$SHOW_COLORS" == "true" ]]; then
        echo -e "${2}$1${NC}"
    else
        echo "$1"
    fi
}
```

**Best Practice**: Always provide both AI and human modes. AI agents benefit from concise, parseable output, while humans need visual cues and context.

### 2. Comprehensive Error Handling

```bash
# Fail fast with clear error reporting
set -e
trap 'log_human "❌ Build failed" "$RED"; exit 1' ERR

# Specific error checking
node -e "require('./src/main.js')" || {
    log_human "❌ Module import failed" "$RED"
    exit 1
}
```

**Best Practice**: Use `set -e` for fail-fast behavior and specific error checks for critical operations.

### 3. Smoke Testing Integration

Essential smoke tests should catch common runtime errors:

```bash
run_smoke_tests() {
    # Test module imports
    node -e "require('./src/main.js')" || return 1

    # Check configuration files
    [[ -f "config/app.json" ]] || return 1

    # Verify database connection (if applicable)
    npm run db:ping || return 1

    # Test API endpoints (if applicable)
    curl -f http://localhost:3000/health || return 1
}
```

### Essential Smoke Test Categories

1. **Import/Require Tests**: Verify main modules can be loaded without syntax errors
2. **Configuration Validation**: Check required config files exist and are valid
3. **Dependency Verification**: Ensure critical dependencies are available and accessible
4. **Basic Functionality**: Test core features without running full test suite
5. **Service Health**: Verify external services (databases, APIs) are reachable

## Command-Line Interface Best Practices

### Standard Options

```bash
--quiet, -q           # Minimize output for AI consumption
--no-colors          # Disable colored output for CI/CD
--no-smoke-tests     # Skip smoke tests for faster builds
--help, -h           # Show usage information
```

### Usage Examples

```bash
# Standard build with full output
./BUILDME.sh

# AI-optimized quiet build
./BUILDME.sh --quiet

# CI/CD build without colors
./BUILDME.sh --no-colors

# Quick build without smoke tests
./BUILDME.sh --no-smoke-tests
```

## Project Type Adaptations

### Node.js Projects

```bash
# Install dependencies
npm ci --silent || npm install --silent

# Run build
npm run build

# Smoke test
node -e "require('./package.json').main && console.log('✓')"
```

### Make-based Projects

```bash
# Build
make build

# Smoke test
make test-smoke || ./bin/app --version
```

### Docker Projects

```bash
# Build image
docker build -t project:latest .

# Smoke test
docker run --rm project:latest --version
```

## Integration with Development Workflow

### Git Hooks Integration

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
./BUILDME.sh --quiet || exit 1
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Build and Test
  run: |
    ./BUILDME.sh --no-colors
    ./TESTME.sh --no-colors --coverage-threshold 80
```

### IDE Integration

Configure your IDE to run build scripts with appropriate flags for the environment.

## Performance Optimization

### Parallel Execution

```bash
# Run independent tasks in parallel
npm run lint &
npm run test:unit &
npm run build:assets &
wait  # Wait for all background jobs
```

### Caching Strategies

```bash
# Check for cached builds
if [[ -f ".build-cache" ]] && [[ "src/" -ot ".build-cache" ]]; then
    log_ai "Using cached build"
    exit 0
fi
```

### Incremental Builds

```bash
# Only rebuild changed components
if [[ "src/api/" -nt "dist/api/" ]]; then
    npm run build:api
fi
```

## Debugging and Troubleshooting

### Verbose Mode

```bash
if [[ "$VERBOSE" == "true" ]]; then
    set -x  # Enable command tracing
fi
```

### Build Artifacts

```bash
# Save build logs for debugging
exec > >(tee build.log)
exec 2>&1
```

### Environment Validation

```bash
# Check required tools
command -v node >/dev/null || { echo "Node.js required"; exit 1; }
command -v npm >/dev/null || { echo "npm required"; exit 1; }
```

## Integration with Supernal-Code Workflow

This build script template integrates seamlessly with the supernal-code workflow system:

- **Requirements Validation**: Build scripts validate that implementation matches requirements
- **Git Workflow**: Integration with commit hooks and branch protection
- **Agent Coordination**: Consistent build status for agent handoffs
- **Testing Pipeline**: Links with `TESTME.sh` for comprehensive validation

### Agent Handoff Compatibility

When creating handoffs, ensure build status is documented:

```bash
# Document build status in handoff
echo "Build Status: $(./BUILDME.sh --quiet && echo 'PASSING' || echo 'FAILING')" >> handoff.md
```

### Requirement Traceability

Link build steps to requirements:

```bash
# Example: REQ-003 build validation
log_ai "REQ-003: Validating npm package structure"
[[ -f "package.json" ]] || { log_human "❌ REQ-003: Missing package.json"; exit 1; }
```

## Updates and Maintenance

This template is maintained as part of the supernal-coding repository synchronization system. Updates are automatically available through:

- Repository sync via `sc sync` command
- Template updates during project initialization
- Version compatibility checking

For contributing improvements to this template, see the feedback system in the supernal-code package documentation.

---

**Remember**: A good build script is the foundation of reliable development. It should be fast, clear, and consistent across all environments—whether running locally, in CI/CD, or being analyzed by AI agents.
