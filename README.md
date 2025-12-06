# Supernal Code

[![npm version](https://badge.fury.io/js/supernal-code.svg)](https://badge.fury.io/js/supernal-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Complete development workflow management system with AI agent integration, requirements tracking, and automated validation.

## 🚀 Quick Start

### Global Installation (Recommended)

```bash
npm install -g supernal-code
```

### Local Installation

```bash
npm install --save-dev supernal-code
```

### Initialize a Project

```bash
# Global installation
sc init

# Local installation
npx sc init
```

## ✨ Features

- **🎯 Requirements Management**: Create, track, and validate requirements with Gherkin scenarios
- **📊 Test Coverage**: Line-item validation of acceptance criteria
- **🤖 AI Agent Integration**: Seamless handoffs and collaboration workflows
- **🔄 Git Integration**: Smart commit validation and workflow automation
- **📋 Kanban Workflow**: Priority-based task management and epic organization
- **🏗️ Project Templates**: Automated setup for different project types
- **📈 Progress Tracking**: Real-time visibility into project status

## 📚 Commands

### Core Commands

```bash
sc init [type]          # Initialize project (general, monorepo, library, etc.)
sc status               # Show project health and status
sc req new <title>      # Create a new requirement
sc req list             # List all requirements
sc req validate <id>    # Validate requirement completeness
sc req coverage-report  # Generate test coverage report
sc workflow             # Kanban workflow management
sc git-smart            # Intelligent git operations
sc handoff              # Create agent handoff documentation
```

### Requirements Management

```bash
# Create requirements
sc req new "User Authentication" --epic=auth --priority=high
sc req new "Fix Login Bug" --request-type=bug

# Manage requirements
sc req list --status=pending
sc req show 036
sc req validate 036
sc req generate-tests 036
sc req start-work 036

# Test coverage
sc req validate-coverage 036
sc req coverage-report
```

### Project Types

Supernal Code supports automatic configuration for different project types:

- **General**: Standard project structure and workflows
- **Monorepo**: Multi-package coordination and shared configuration
- **Library**: API documentation and version management focus
- **Application**: Feature-driven development and deployment
- **Microservice**: Service-oriented architecture patterns

## 🎯 Project Initialization

When you run `sc init`, supernal-code will:

1. **Detect your project type** and apply appropriate templates
2. **Create requirements structure** with proper categorization
3. **Set up git workflow validation** with smart commit hooks
4. **Generate project documentation** (BUILDME.md, TESTME.md, AGENTIFYME.md)
5. **Configure development templates** based on your tech stack

### Example: Web Application

```bash
mkdir my-web-app
cd my-web-app
sc init application

# Creates:
# ├── .supernal-code/          # Configuration and templates
# ├── requirements/            # Requirements organized by category
# ├── BUILDME.md              # Build instructions and guidelines
# ├── TESTME.md               # Testing procedures and standards
# ├── AGENTIFYME.md           # AI agent collaboration guide
# └── .git/hooks/             # Automated validation hooks
```

## 🤖 AI Agent Integration

Supernal Code provides first-class support for AI agent collaboration:

### AGENTIFYME.md

Every initialized project gets an `AGENTIFYME.md` file containing:

- Project context and architecture overview
- Development workflow and conventions
- Standard operating procedures for common tasks
- Communication protocols and handoff procedures

### Agent Handoffs

```bash
sc handoff create "Feature implementation complete"
# Creates structured handoff documentation with:
# - Current project status
# - Completed work summary
# - Next steps and priorities
# - Context for the next agent
```

## 📊 Requirements & Test Coverage

### Line-Item Validation

Supernal Code analyzes acceptance criteria and maps them to tests:

```bash
sc req validate-coverage 036
# Shows:
# 📊 Coverage Analysis: REQ-036
# 📈 Overall Coverage: 85%
# 📋 Total Criteria: 12
# ✅ Tested Criteria: 10
# ❌ Untested Criteria: 2
```

### Project-Wide Coverage

```bash
sc req coverage-report
# Generates comprehensive report showing:
# - Total requirements vs tested requirements
# - Specific acceptance criteria coverage
# - Action items for improving coverage
```

## 🔄 Git Integration

### Smart Commit Validation

Pre-commit hooks automatically validate:

- Conventional commit message format
- Requirement file completeness
- Test coverage for requirement changes
- Code quality and standards

### Branch Management

```bash
sc req start-work 036
# Creates: feature/req-036-[requirement-title]
# Updates requirement with branch info
# Provides guided next steps
```

## 🏗️ Templates & Build Scripts

### BUILDME.sh

AI-optimized build scripts with:

- Dual-mode output (AI-friendly minimal vs human-readable)
- Comprehensive smoke testing
- Configurable verbosity levels
- Error handling and status reporting

### TESTME.sh

Comprehensive testing framework with:

- Multi-framework support (Jest, Mocha, Playwright, etc.)
- Coverage threshold validation
- Parallel execution capabilities
- Clear pass/fail feedback

## 📋 Configuration

Supernal Code automatically creates `.supernal-code/config.json`:

```json
{
  "projectType": "application",
  "workflow": {
    "requirementValidation": true,
    "commitHooks": true,
    "testCoverage": {
      "threshold": 80,
      "blockCommits": false
    }
  },
  "agent": {
    "handoffEnabled": true,
    "contextTracking": true
  }
}
```

## 🚀 Development Workflow

1. **Initialize**: `sc init` sets up complete project structure
2. **Plan**: `sc req new` creates requirements with acceptance criteria
3. **Validate**: `sc req validate` ensures completeness
4. **Implement**: `sc req start-work` begins development
5. **Test**: `sc req validate-coverage` tracks progress
6. **Handoff**: `sc handoff` transfers context between agents/developers

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

## 📄 License

MIT © [Supernal Technologies](https://supernal.ai)

## 🔗 Links

- [Documentation](https://github.com/supernal/supernal-code/docs)
- [Issues](https://github.com/supernal/supernal-code/issues)
- [Changelog](../CHANGELOG.md)
- [Supernal.ai](https://supernal.ai)

---

**Built for developers and AI agents working together**
