---
title: "Dashboard Guide: Visual Project Management"
sidebar_label: "Dashboard Guide: Visual Project Management"
---

# Dashboard Guide: Visual Project Management

The Supernal Coding Dashboard provides a comprehensive visual interface for managing your compliant development projects. This guide covers all dashboard features, components, and workflows.

## Dashboard Overview

The dashboard serves as your central command center, providing:

- **Real-time project status** across all development phases
- **Interactive requirement cards** with detailed views and actions
- **Compliance monitoring** with framework-specific validation
- **Testing results** and coverage visualization
- **Team collaboration** tools and progress tracking

### 🎛️ **Dashboard Component Structure**

<SimpleMermaid chart={`
graph TB
subgraph DF ["Dashboard Frontend (Next.js 14)"]
Header["🎯 Header Component<br/>Navigation & Project Info"]
PhaseTabs["📋 Phase Tabs<br/>Discovery | Foundation | Implementation | Validation | Compliance"]
PhaseContent["📊 Phase Content<br/>Dynamic content based on selected phase"]

        subgraph PSC ["Phase-Specific Components"]
            ReqCards["📝 Requirement Cards<br/>Interactive requirement display"]
            CompOverview["🏆 Compliance Overview<br/>Framework status & gaps"]
            TestResults["🧪 Test Results<br/>Coverage & validation status"]
            KanbanBoard["📋 Kanban Board<br/>Task management interface"]
        end
    end

    subgraph DB ["Dashboard Backend (API Routes)"]
        ReqAPI["📋 Requirements API<br/>/api/[repoId]/requirements"]
        PhaseAPI["📊 Phases API<br/>/api/[repoId]/phases"]
        CompAPI["🏆 Compliance API<br/>/api/[repoId]/compliance"]
        KanbanAPI["📋 Kanban API<br/>/api/[repoId]/kanban"]
    end

    subgraph DS ["Data Sources"]
        FileSystem["📁 File System<br/>Requirements, tests, docs"]
        GitRepo["🗂️ Git Repository<br/>Version history & branches"]
        CompFrameworks["📜 Compliance Frameworks<br/>ISO 13485, FDA, GDPR mappings"]
    end

    Header --> PhaseTabs
    PhaseTabs --> PhaseContent
    PhaseContent --> ReqCards
    PhaseContent --> CompOverview
    PhaseContent --> TestResults
    PhaseContent --> KanbanBoard

    ReqCards --> ReqAPI
    CompOverview --> CompAPI
    TestResults --> PhaseAPI
    KanbanBoard --> KanbanAPI

    ReqAPI --> FileSystem
    PhaseAPI --> FileSystem
    CompAPI --> CompFrameworks
    KanbanAPI --> GitRepo

    style Header fill:#e1f5fe
    style PhaseTabs fill:#f3e5f5
    style CompOverview fill:#fff3e0
    style FileSystem fill:#e8f5e8

`} />

### 🔄 **Dashboard Data Flow**

<SimpleMermaid chart={`
sequenceDiagram
participant User
participant Dashboard
participant API
participant FileSystem
participant Git

    User->>Dashboard: Load dashboard
    Dashboard->>API: GET /api/[repoId]/phases
    API->>FileSystem: Scan requirements directory
    API->>Git: Get branch/commit info
    FileSystem-->>API: Requirements data
    Git-->>API: Version info
    API-->>Dashboard: Phase data with requirements
    Dashboard-->>User: Render phase tabs & content

    User->>Dashboard: Click requirement card
    Dashboard->>API: GET /api/[repoId]/requirements/[reqId]
    API->>FileSystem: Read requirement file
    FileSystem-->>API: Detailed requirement data
    API-->>Dashboard: Requirement details
    Dashboard-->>User: Show requirement modal/detail view

    User->>Dashboard: Switch to Compliance phase
    Dashboard->>API: GET /api/[repoId]/compliance
    API->>FileSystem: Scan compliance mappings
    API->>FileSystem: Check requirement-compliance links
    FileSystem-->>API: Compliance status
    API-->>Dashboard: Compliance overview data
    Dashboard-->>User: Render compliance dashboard

`} />

## Accessing the Dashboard

### Launch Methods

```bash
# Standard launch (port 3001)
sc dashboard

# Custom port
sc dashboard --port=3002

# Development mode with auto-reload
sc dashboard --dev

# Open browser automatically
sc dashboard --open
```

### URL Structure

- **Main Dashboard**: `http://localhost:3001/`
- **Requirements View**: `http://localhost:3001/requirements`
- **Compliance View**: `http://localhost:3001/compliance`
- **Testing View**: `http://localhost:3001/testing`
- **Settings**: `http://localhost:3001/settings`

---

## Main Dashboard Interface

### Header Navigation

```
┌─────────────────────────────────────────────────────────────┐
│ 🏗️ Supernal Coding    [Requirements] [Compliance] [Tests]   │
│                                                    [⚙️ Settings] │
└─────────────────────────────────────────────────────────────┘
```

**Navigation Items:**

- **Requirements**: Requirement management and tracking
- **Compliance**: Framework validation and monitoring
- **Tests**: Test execution and results
- **Settings**: Project configuration and preferences

### Project Overview Panel

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Project: Medical User Management System                  │
│ ├─ Status: In Progress                                      │
│ ├─ Compliance: ISO 13485 (98.75%)                         │
│ ├─ Requirements: 15 total (12 done, 3 in-progress)        │
│ └─ Test Coverage: 95% (245 tests passing)                 │
└─────────────────────────────────────────────────────────────┘
```

**Key Metrics:**

- Overall project status
- Primary compliance framework and percentage
- Requirements completion summary
- Test coverage and pass rate

---

## Phase-Based Organization

The dashboard organizes work into five development phases:

### Phase Tabs

```
┌─────────────────────────────────────────────────────────────┐
│ [Discovery] [Foundation] [Implementation] [Validation] [Compliance] │
└─────────────────────────────────────────────────────────────┘
```

Each phase shows:

- Number of requirements in that phase
- Completion percentage
- Critical items requiring attention
- Phase-specific actions

### Phase Details

#### 1. Discovery Phase

**Purpose**: Problem definition and planning

**Typical Requirements:**

- Problem statements
- User stories
- Architecture decisions
- Compliance framework selection

**Dashboard Features:**

- Epic organization
- Requirement prioritization
- Stakeholder assignment
- Initial compliance mapping

#### 2. Foundation Phase

**Purpose**: Infrastructure and setup

**Typical Requirements:**

- Database schema
- API structure
- Security middleware
- Testing framework setup

**Dashboard Features:**

- Infrastructure dependency tracking
- Setup validation
- Configuration management
- Tool integration status

#### 3. Implementation Phase

**Purpose**: Feature development

**Typical Requirements:**

- Feature implementations
- API endpoints
- User interfaces
- Business logic

**Dashboard Features:**

- Active development tracking
- Code review status
- Feature branch management
- Progress visualization

#### 4. Validation Phase

**Purpose**: Testing and quality assurance

**Typical Requirements:**

- Test execution
- Performance validation
- Security testing
- User acceptance testing

**Dashboard Features:**

- Test result visualization
- Coverage tracking
- Performance metrics
- Quality gates

#### 5. Compliance Phase

**Purpose**: Regulatory validation

**Typical Requirements:**

- Compliance validation
- Documentation review
- Audit preparation
- Regulatory submission

**Dashboard Features:**

- Compliance percentage
- Gap analysis
- Audit trail generation
- Regulatory reporting

---

## Requirement Cards

### Card Layout

```
┌─────────────────────────────────────────────────────────────┐
│ REQ-001 🔴 CRITICAL                              [⋯ Actions] │
│ User Authentication System                                   │
│                                                             │
│ 📋 Epic: Authentication                                     │
│ 👤 Assignee: john.doe                                      │
│ 📅 Due: 2024-12-31                                         │
│ 🏷️ Tags: security, backend, api                            │
│                                                             │
│ ✅ Compliance: ISO 13485 (Section 4.1.1)                  │
│ 🧪 Tests: 15/15 passing (100% coverage)                   │
│                                                             │
│ Status: ✅ Done                                            │
│ Progress: ████████████████████████ 100%                    │
└─────────────────────────────────────────────────────────────┘
```

### Card Elements

**Header Section:**

- **REQ-ID**: Unique requirement identifier
- **Priority Indicator**: 🔴 Critical, 🟡 High, 🔵 Medium, ⚪ Low
- **Title**: Descriptive requirement name
- **Actions Menu**: Quick actions (⋯)

**Details Section:**

- **Epic**: Feature group or theme
- **Assignee**: Responsible developer
- **Due Date**: Target completion date
- **Tags**: Categorization labels

**Status Section:**

- **Compliance Mapping**: Framework and section references
- **Test Status**: Test count and coverage percentage
- **Overall Status**: Current state (Pending, In Progress, Done, Blocked)
- **Progress Bar**: Visual completion indicator

### Interactive Features

#### Click Actions

- **Card Click**: Opens detailed requirement view
- **Epic Click**: Filters to show all requirements in that epic
- **Assignee Click**: Shows all requirements for that person
- **Tag Click**: Filters by tag
- **Compliance Click**: Shows compliance details

#### Quick Actions Menu (⋯)

- **Edit**: Modify requirement details
- **Start Work**: Create feature branch and begin development
- **Add Subtask**: Break down into smaller tasks
- **Clone**: Create similar requirement
- **Archive**: Move to archived state
- **Delete**: Remove requirement (with confirmation)

### Card States

#### Visual Indicators

**Status Colors:**

- 🔴 **Blocked**: Red border, urgent attention needed
- 🟡 **In Progress**: Yellow border, actively being worked
- 🟢 **Done**: Green border, completed and validated
- ⚪ **Pending**: Gray border, waiting to be started

**Progress Indicators:**

- **Empty Bar**: Not started (0%)
- **Partial Bar**: In progress (1-99%)
- **Full Bar**: Complete (100%)
- **Striped Bar**: Blocked or issues

**Compliance Indicators:**

- ✅ **Compliant**: Meets all framework requirements
- ⚠️ **Partial**: Some requirements met
- ❌ **Non-compliant**: Fails compliance checks
- ❓ **Unknown**: Not yet validated

---

## Detailed Requirement View

### Opening Detailed View

Click any requirement card to open the detailed view:

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Dashboard                              [Edit] [⋯]  │
│                                                             │
│ REQ-001: User Authentication System                         │
│ Epic: Authentication | Priority: Critical | Status: Done    │
│                                                             │
│ ┌─ Description ─────────────────────────────────────────┐   │
│ │ Implement secure user authentication system with:    │   │
│ │ - Email/password login                               │   │
│ │ - JWT token management                               │   │
│ │ - Session handling                                   │   │
│ │ - Password reset functionality                       │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Subtasks (5) ───────────────────────────────────────┐   │
│ │ ✅ REQ-001.1: User registration                      │   │
│ │ ✅ REQ-001.2: Password hashing                       │   │
│ │ ✅ REQ-001.3: JWT implementation                     │   │
│ │ ✅ REQ-001.4: Session management                     │   │
│ │ ✅ REQ-001.5: Password reset                         │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Compliance Mapping ─────────────────────────────────┐   │
│ │ ISO 13485:                                           │   │
│ │ ├─ 4.1.1 General Requirements ✅                    │   │
│ │ ├─ 7.3.2 Design Inputs ✅                           │   │
│ │ └─ 8.2.4 Monitoring of Processes ✅                 │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Test Results ───────────────────────────────────────┐   │
│ │ Unit Tests: 15/15 passing                            │   │
│ │ Integration Tests: 8/8 passing                       │   │
│ │ E2E Tests: 5/5 passing                              │   │
│ │ Coverage: 98% (lines), 95% (branches)               │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Implementation Notes ───────────────────────────────┐   │
│ │ 2024-01-15: Initial implementation completed         │   │
│ │ 2024-01-16: Added bcrypt for password hashing       │   │
│ │ 2024-01-17: JWT integration and testing complete    │   │
│ │ 2024-01-18: All compliance requirements validated   │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Git History ────────────────────────────────────────┐   │
│ │ abc123f REQ-001: Complete user authentication       │   │
│ │ def456a REQ-001: Add JWT token validation           │   │
│ │ ghi789b REQ-001: Implement password hashing         │   │
│ │ jkl012c REQ-001: Initial auth structure             │   │
│ └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Detailed View Sections

#### 1. Header Actions

- **Back Button**: Return to main dashboard
- **Edit Button**: Modify requirement details
- **Actions Menu**: Additional operations

#### 2. Description Section

- Full requirement description
- Acceptance criteria
- Business context
- Technical specifications

#### 3. Subtasks Section

- Hierarchical task breakdown
- Individual subtask status
- Progress tracking
- Clickable subtask details

#### 4. Compliance Mapping

- Framework-specific requirements
- Compliance status per section
- Gap identification
- Validation history

#### 5. Test Results

- Test suite breakdown by type
- Coverage metrics
- Pass/fail status
- Performance benchmarks

#### 6. Implementation Notes

- Timestamped development log
- Decision rationale
- Technical notes
- Issue resolution

#### 7. Git History

- Related commits
- Branch information
- Merge history
- Code review status

---

## Compliance Dashboard

### Compliance Overview

```
┌─────────────────────────────────────────────────────────────┐
│ 🛡️ Compliance Status                                        │
│                                                             │
│ Primary Framework: ISO 13485                                │
│ Overall Compliance: 98.75% ████████████████████▒▒          │
│                                                             │
│ ┌─ Framework Breakdown ────────────────────────────────┐   │
│ │ 4.1 General Requirements      100% ████████████████ │   │
│ │ 4.2 Documentation            100% ████████████████ │   │
│ │ 7.3 Design & Development      95% ███████████████▒ │   │
│ │ 8.2 Monitoring               100% ████████████████ │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Critical Gaps (1) ──────────────────────────────────┐   │
│ │ ⚠️ 7.3.4 Design Review - Missing peer review docs   │   │
│ │    Requirements: REQ-003, REQ-007                    │   │
│ │    Action: Generate design review documentation      │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Recent Validations ─────────────────────────────────┐   │
│ │ ✅ 2024-01-18: REQ-001 compliance validated          │   │
│ │ ✅ 2024-01-17: Security audit completed              │   │
│ │ ⚠️ 2024-01-16: Documentation gap identified          │   │
│ └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Compliance Features

#### Framework Selection

- **Primary Framework**: Main compliance target
- **Secondary Frameworks**: Additional compliance requirements
- **Custom Frameworks**: Organization-specific requirements

#### Gap Analysis

- **Critical Gaps**: Must-fix compliance issues
- **Recommendations**: Suggested improvements
- **Action Items**: Specific tasks to address gaps

#### Validation Tracking

- **Automated Validation**: Continuous compliance checking
- **Manual Reviews**: Human validation checkpoints
- **Audit Trail**: Complete validation history

---

## Testing Dashboard

### Test Results Overview

```
┌─────────────────────────────────────────────────────────────┐
│ 🧪 Test Results                                             │
│                                                             │
│ Overall Status: ✅ All Tests Passing                       │
│ Total Tests: 245 | Passing: 245 | Failing: 0              │
│ Coverage: 95% (lines), 92% (branches)                      │
│                                                             │
│ ┌─ Test Suites ────────────────────────────────────────┐   │
│ │ Unit Tests        150/150 ✅  Coverage: 98%          │   │
│ │ Integration Tests  65/65  ✅  Coverage: 95%          │   │
│ │ E2E Tests          30/30  ✅  Coverage: 85%          │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Performance Metrics ────────────────────────────────┐   │
│ │ Average Response Time: 45ms                          │   │
│ │ 95th Percentile: 120ms                               │   │
│ │ Throughput: 1,000 req/sec                           │   │
│ │ Memory Usage: 45MB peak                              │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Recent Test Runs ───────────────────────────────────┐   │
│ │ 2024-01-18 14:30 ✅ All suites passed (2m 15s)     │   │
│ │ 2024-01-18 12:45 ✅ Unit tests passed (45s)        │   │
│ │ 2024-01-18 10:20 ✅ E2E tests passed (5m 30s)      │   │
│ └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Test Features

#### Real-time Results

- **Live Updates**: Test results update automatically
- **Progress Tracking**: Visual progress during test runs
- **Failure Notifications**: Immediate alerts for test failures

#### Coverage Visualization

- **Line Coverage**: Percentage of code lines tested
- **Branch Coverage**: Percentage of code branches tested
- **Function Coverage**: Percentage of functions tested
- **File Coverage**: Per-file coverage breakdown

#### Performance Monitoring

- **Response Times**: API endpoint performance
- **Throughput**: Requests per second capacity
- **Resource Usage**: Memory and CPU utilization
- **Load Testing**: Concurrent user simulation

---

## Dashboard Customization

### Settings Panel

```
┌─────────────────────────────────────────────────────────────┐
│ ⚙️ Dashboard Settings                                        │
│                                                             │
│ ┌─ Display Preferences ────────────────────────────────┐   │
│ │ Theme: [Dark] [Light] [Auto]                         │   │
│ │ Card Size: [Compact] [Standard] [Detailed]           │   │
│ │ Refresh Rate: [Real-time] [30s] [1m] [5m]           │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Notification Settings ──────────────────────────────┐   │
│ │ ✅ Test Failures                                     │   │
│ │ ✅ Compliance Gaps                                   │   │
│ │ ✅ Requirement Updates                               │   │
│ │ ✅ Deployment Status                                 │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Integration Settings ───────────────────────────────┐   │
│ │ Git Repository: ✅ Connected                         │   │
│ │ CI/CD Pipeline: ✅ Connected                         │   │
│ │ Slack Notifications: ❌ Not configured               │   │
│ │ Email Alerts: ✅ Configured                          │   │
│ └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Customization Options

#### Visual Themes

- **Dark Mode**: Reduced eye strain for long sessions
- **Light Mode**: High contrast for detailed work
- **Auto Mode**: Follows system preferences

#### Layout Options

- **Compact Cards**: More requirements visible
- **Standard Cards**: Balanced information density
- **Detailed Cards**: Maximum information per card

#### Filtering and Sorting

- **Status Filters**: Show only specific statuses
- **Priority Sorting**: Order by importance
- **Epic Grouping**: Organize by feature groups
- **Assignee Views**: Filter by team member

---

## Mobile and Responsive Design

### Mobile Dashboard

The dashboard adapts to mobile devices:

```
┌─────────────────┐
│ 🏗️ Supernal     │
│ ≡ Menu          │
├─────────────────┤
│ 📊 Overview     │
│ 15 Requirements │
│ 95% Coverage    │
├─────────────────┤
│ REQ-001 🔴      │
│ User Auth       │
│ ✅ Done         │
├─────────────────┤
│ REQ-002 🟡      │
│ Role Control    │
│ 🔄 In Progress  │
├─────────────────┤
│ [+ New Req]     │
└─────────────────┘
```

### Mobile Features

- **Swipe Navigation**: Swipe between phases
- **Touch Actions**: Tap to expand, long-press for menu
- **Responsive Cards**: Optimized for small screens
- **Offline Support**: View cached data without connection

---

## Integration with Development Tools

### IDE Integration

#### VS Code Extension

- **Requirement Sidebar**: View requirements in editor
- **Status Bar**: Show current requirement status
- **Code Annotations**: Link code to requirements
- **Quick Actions**: Create requirements from code comments

#### Cursor Integration

- **AI Agent Context**: Requirements visible to AI agents
- **Smart Suggestions**: AI-powered requirement updates
- **Code Generation**: Generate code from requirements
- **Compliance Checking**: Real-time compliance validation

### Git Integration

#### Branch Management

- **Automatic Branches**: Create branches from requirements
- **Status Updates**: Update requirement status from commits
- **Merge Validation**: Ensure requirements are complete before merge

#### Commit Tracking

- **Requirement Linking**: Link commits to requirements
- **Progress Updates**: Automatic progress calculation
- **Audit Trail**: Complete development history

---

## Advanced Dashboard Features

### Analytics and Reporting

#### Project Metrics

- **Velocity Tracking**: Requirements completed over time
- **Burn-down Charts**: Progress toward milestones
- **Team Performance**: Individual and team productivity
- **Quality Metrics**: Defect rates and resolution times

#### Compliance Analytics

- **Compliance Trends**: Framework compliance over time
- **Gap Analysis**: Identification of compliance weaknesses
- **Risk Assessment**: Compliance risk scoring
- **Audit Readiness**: Preparation status for audits

### Collaboration Features

#### Team Coordination

- **Assignment Management**: Distribute work across team
- **Progress Sharing**: Real-time status updates
- **Comment System**: Requirement-specific discussions
- **Notification System**: Keep team informed of changes

#### Stakeholder Views

- **Executive Dashboard**: High-level project status
- **Manager View**: Team performance and blockers
- **Developer View**: Technical details and tasks
- **Auditor View**: Compliance and validation status

---

## Troubleshooting

### Common Issues

#### Dashboard Won't Load

```bash
# Check if dashboard is running
sc dashboard status

# Restart dashboard
sc dashboard restart

# Check port conflicts
sc dashboard --port=3002
```

#### Slow Performance

```bash
# Clear dashboard cache
sc dashboard clear-cache

# Reduce refresh rate
# Settings > Display > Refresh Rate > 5m

# Check system resources
sc dashboard diagnostics
```

#### Missing Data

```bash
# Refresh data
sc dashboard refresh

# Rebuild dashboard data
sc dashboard rebuild

# Check data integrity
sc dashboard validate
```

### Getting Help

- **Built-in Help**: Click the `?` icon in any dashboard section
- **Keyboard Shortcuts**: Press `?` to see all shortcuts
- **Debug Mode**: Add `?debug=true` to URL for detailed logging
- **Support**: Use `sc dashboard support` to generate support bundle

---

## Next Steps

The dashboard is your central hub for managing compliant development. Explore these related guides:

- [CLI Commands Reference](../cli-commands/complete-reference.md) - Command-line operations
- [Workflow Guide](../../workflow/user-guides/complete-workflow-example.md) - End-to-end development process
- [Compliance Guide](../../requirements/compliance/frameworks.md) - Framework implementation

Ready to start using the dashboard? Launch it with `sc dashboard` and begin managing your compliant development project!
