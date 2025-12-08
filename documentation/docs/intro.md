---
sidebar_position: 0
title: Introduction
description: Build compliant software faster with AI-accelerated workflows
slug: /
---

# Supernal Coding

**Build compliant software faster with AI-accelerated workflows.**

## The Problem

Building software in regulated industries is painful:

| Challenge | Impact |
|-----------|--------|
| 📋 **Compliance paperwork** | Weeks spent on documentation instead of shipping |
| 🔄 **Manual tracking** | Requirements scattered across Jira, Notion, spreadsheets |
| 🐌 **Slow releases** | Audit requirements block every deployment |
| 💸 **Expensive consultants** | $500/hr for someone to write templates you can't maintain |
| 🤖 **AI can't help** | LLMs don't understand your compliance context |

## The Solution

Supernal Coding provides a **CLI-first workflow** that makes compliance automatic:

```bash
# Install in 30 seconds
npm install -g supernal-coding

# Initialize your project
sc init

# Add a compliance framework
sc compliance add hipaa

# Check your compliance status
sc compliance status
```

### What You Get

| Feature | Description |
|---------|-------------|
| **CLI Tools** | Manage requirements, features, and compliance from the terminal |
| **Templates** | HIPAA, SOC2, ISO 27001, GDPR, FDA 21 CFR Part 11, and more |
| **AI-Ready SOPs** | Standard Operating Procedures that work with Cursor, Copilot, Claude |
| **Git-Native** | Everything in version control - requirements, compliance, audit trails |
| **Traceability** | Every requirement linked to code, tests, and compliance evidence |

## Quick Start (5 Minutes)

### 1. Install the CLI

```bash
npm install -g supernal-coding
```

### 2. Initialize Your Project

```bash
cd your-project
sc init
```

### 3. Create Your First Requirement

```bash
sc requirement new "User Authentication" --epic=security --priority=high
```

### 4. Check Your Project Health

```bash
sc health
```

**That's it!** You now have a requirements-tracked, compliance-ready project.

→ [Full Getting Started Guide](./guides/getting-started)

---

## Who Uses Supernal Coding?

- **Startups** building in healthcare, fintech, or enterprise SaaS
- **Teams** that need to pass SOC2 audits without hiring consultants
- **Developers** who want compliance without leaving their IDE
- **AI-first teams** using Cursor, Copilot, or other AI coding assistants

## Compliance Frameworks

We provide templates for:

| Framework | Industry | Templates |
|-----------|----------|-----------|
| **HIPAA** | Healthcare | 52 controls |
| **SOC 2** | SaaS/Enterprise | 40+ controls |
| **ISO 27001** | Global security | 93 controls |
| **GDPR** | EU data privacy | 45 articles |
| **FDA 21 CFR Part 11** | Life sciences | 14 requirements |
| **ISO 13485** | Medical devices | Full coverage |
| **ISO 27701** | Privacy management | Full coverage |
| **EN 18031** | AI governance | 40 controls |

→ [Browse All Compliance Frameworks](./compliance)

## Standard Operating Procedures

Our 12-phase SOP workflow covers the complete development lifecycle:

1. **Discovery** - Understand the problem
2. **Research** - Validate the approach
3. **Design** - Architecture and UX
4. **Planning** - Break into requirements
5. **Requirements** - Detailed specifications
6. **Testing** - Test design and automation
7. **Building** - Implementation
8. **Integration** - Connect the pieces
9. **Milestone** - Internal review
10. **Staging** - Pre-production validation
11. **Production** - Controlled release
12. **Operations** - Maintenance and evolution

→ [Browse All SOPs](./sops)

---

## For Teams

The CLI gives you everything you need for individual development. For team visibility and collaboration:

### Supernal Dashboard

| Feature | CLI (Free) | Dashboard |
|---------|-----------|-----------|
| Requirements tracking | ✅ Terminal | ✅ Visual + history |
| Compliance checks | ✅ Terminal | ✅ Team-wide view |
| Audit reports | JSON export | PDF, XLSX, API |
| Team visibility | ❌ | ✅ Real-time |
| Requirement assignments | Git-based | Visual kanban |
| Compliance progress | Per-repo | Org-wide |

→ [Try the Dashboard](https://app.coding.supernal.ai) (free tier available)

---

## Getting Help

- **Documentation**: You're here! Browse the sidebar.
- **GitHub Issues**: [Report bugs or request features](https://github.com/supernalintelligence/supernal-coding-cli/issues)
- **Community**: Join discussions on GitHub

---

## What's Next?

<div className="row">
  <div className="col col--6">
    <div className="card">
      <div className="card__header">
        <h3>🚀 Getting Started</h3>
      </div>
      <div className="card__body">
        <p>Set up Supernal Coding in your project in 5 minutes.</p>
      </div>
      <div className="card__footer">
        <a href="/docs/guides/getting-started" className="button button--primary button--block">Get Started</a>
      </div>
    </div>
  </div>
  <div className="col col--6">
    <div className="card">
      <div className="card__header">
        <h3>📖 CLI Reference</h3>
      </div>
      <div className="card__body">
        <p>Complete reference for all CLI commands.</p>
      </div>
      <div className="card__footer">
        <a href="/docs/category/cli-commands" className="button button--secondary button--block">View Commands</a>
      </div>
    </div>
  </div>
</div>

