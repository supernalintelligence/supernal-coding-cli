---
sidebar_position: 0
title: Welcome to Supernal Coding
description: Introduction to Supernal Coding - what it is and what it does
---

# Welcome to Supernal Coding

**Build compliant software faster with AI-accelerated workflows.**

---

## The Problem

Building software in regulated industries is painful:

| Challenge | Impact |
|-----------|--------|
| 📋 **Compliance paperwork** | Weeks spent on documentation instead of shipping |
| 🔄 **Manual tracking** | Requirements scattered across Jira, Notion, spreadsheets |
| 🐌 **Slow releases** | Audit requirements block every deployment |
| 💸 **Expensive consultants** | $500/hr for templates you can't maintain |
| 🤖 **AI can't help** | LLMs don't understand your compliance context |

## The Solution

Supernal Coding provides a **CLI-first workflow** that makes compliance automatic:

| Feature | What You Get |
|---------|-------------|
| **🤖 AI-Friendly Structure** | Organized for AI agents to understand and contribute |
| **📋 Requirements Management** | Complete lifecycle from creation to validation |
| **🗂️ Kanban Workflow** | Built-in tracking for requirements and progress |
| **🧪 Integrated Testing** | Automatic test generation and validation |
| **🌿 Smart Git Operations** | Intelligent branching, merging, and traceability |
| **🏆 Compliance Templates** | HIPAA, SOC2, ISO 27001, GDPR, FDA - ready to use |

---

## 🚀 Quick Start

```bash
# Install globally
npm install -g supernal-code

# Initialize your project
sc init --interactive

# Create your first requirement
sc req new "User Authentication" --priority=high
```

**🎯 Core Concept**: Every feature starts as a requirement with clear acceptance criteria, test strategies, and compliance mappings, organized into **Discovery → Foundation → Implementation → Validation → Compliance** phases.

## 🔄 How It Works

<SimpleMermaid chart={`
flowchart TB
subgraph "🚀 Discovery Phase"
A["🚀 Initialize<br/>sc init"]
B["🎯 Define Purpose<br/>Project goals & scope"]
C["👥 Gather User Stories<br/>Stakeholder needs"]
A --> B
B --> C
end

    subgraph "📋 Foundation Phase"
        D["📋 Draft Requirements<br/>High-level features"]
        E["📝 Build Specific Requirements<br/>sc req new 'Feature'"]
        F["🧪 Generate Tests<br/>sc req generate-tests"]
        G["🗂️ Organize Kanban<br/>Priority & workflow"]
        C --> D
        D --> E
        E --> F
        F --> G
    end

    subgraph "💻 Implementation Phase"
        H["🌿 Start Work<br/>sc git-smart branch + sc req update --status=in-progress"]
        I["💻 Develop<br/>Code + Documentation"]
        J["🧪 Run Tests<br/>Validate implementation"]
        G --> H
        H --> I
        I --> J
    end

    subgraph "✅ Validation Phase"
        K["✅ Validate<br/>sc req validate REQ-001"]
        L["📊 Dashboard Review<br/>Visual progress check"]
        M["🔄 Merge<br/>sc git-smart merge"]
        J --> K
        K --> L
        L --> M
    end

    subgraph "🏆 Compliance Phase"
        N["🏆 Compliance Check<br/>Automated validation"]
        O["📈 Reporting<br/>Audit trails"]
        M --> N
        N --> O
    end

    %% Feedback loops
    K -.->|"Issues found"| I
    L -.->|"Adjustments needed"| E
    N -.->|"Compliance gaps"| D

    %% AI Integration points - Early and continuous
    P["🤖 AI Agents<br/>Continuous assistance"]
    C -.->|"Project context"| P
    P -.->|"Requirements generation"| D
    P -.->|"Documentation creation"| E
    P -.->|"Test generation"| F
    P -.->|"Code generation"| I
    P -.->|"Validation assistance"| K

    style A fill:#e1f5fe
    style B fill:#e1f5fe
    style C fill:#e1f5fe
    style D fill:#f3e5f5
    style E fill:#f3e5f5
    style F fill:#f3e5f5
    style G fill:#f3e5f5
    style H fill:#fff3e0
    style I fill:#fff3e0
    style J fill:#fff3e0
    style K fill:#e8f5e8
    style L fill:#e8f5e8
    style M fill:#e8f5e8
    style N fill:#fce4ec
    style O fill:#fce4ec
    style P fill:#f1f8e9

`} />

---

## 📚 What's Next?

### New to Supernal Coding?

Start with [**What is Supernal Coding?**](./overview/what-is-supernal-coding) for a complete overview.

### Ready to Build?

Jump to [**Getting Started**](./index.md) for step-by-step setup.

### Need Quick Reference?

Check [**CLI Commands**](../cli-commands/complete-reference.md) or [**Workflow Example**](../../workflow/user-guides/complete-workflow-example.md).

### Want Visual Guides?

Explore [**Visual Workflows**](../../workflow/user-guides/visual-workflow-diagrams.md), [**Dashboard Guide**](../dashboard/dashboard-guide.md), or [**Compliance Visualization**](../../requirements/compliance/compliance-visualization.md).

---

## 🏆 Compliance Frameworks

Templates for major regulatory frameworks:

| Framework | Industry | Templates |
|-----------|----------|-----------|
| **HIPAA** | Healthcare | 52 controls |
| **SOC 2** | SaaS/Enterprise | 40+ controls |
| **ISO 27001** | Global security | 93 controls |
| **GDPR** | EU data privacy | 45 articles |
| **FDA 21 CFR Part 11** | Life sciences | 14 requirements |
| **ISO 13485** | Medical devices | Full coverage |

→ [Browse All Compliance Templates](../compliance)

---

## 👥 For Teams: Supernal Dashboard

The CLI gives you everything for individual development. For **team visibility and collaboration**:

| Feature | CLI (Free) | Dashboard |
|---------|-----------|-----------|
| Requirements tracking | ✅ Terminal output | ✅ Visual + history |
| Compliance checks | ✅ Terminal output | ✅ Team-wide view |
| Audit reports | JSON export | PDF, XLSX, API |
| Team visibility | ❌ | ✅ Real-time |
| Multi-repo management | ❌ | ✅ Unified view |

→ [**Try the Dashboard**](https://app.coding.supernal.ai) — Free tier available

---

## 🤝 Resources

- **Documentation**: You're here! Browse the guides in the sidebar.
- **GitHub**: [supernal-coding-cli](https://github.com/supernalintelligence/supernal-coding-cli)
- **Dashboard**: [app.coding.supernal.ai](https://app.coding.supernal.ai)
- **Issues & Support**: [GitHub Issues](https://github.com/supernalintelligence/supernal-coding-cli/issues)
