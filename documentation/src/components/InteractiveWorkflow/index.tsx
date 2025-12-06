import Mermaid from '@theme/Mermaid';
import { useEffect, useState } from 'react';
import styles from './styles.module.css';

interface WorkflowProps {
  type: 'task-lifecycle' | 'git-workflow' | 'agent-handoff';
  projectData?: {
    totalTasks?: number;
    activeTasks?: number;
    blockedTasks?: number;
    completedTasks?: number;
    requirements?: Array<{
      id: string;
      status: string;
      priority: string;
    }>;
  };
}

interface WorkflowStats {
  todo: number;
  doing: number;
  blocked: number;
  testing: number;
  done: number;
  lastUpdate: string;
}

export default function InteractiveWorkflow({
  type,
  projectData
}: WorkflowProps): JSX.Element {
  const [stats, setStats] = useState<WorkflowStats>({
    todo: 0,
    doing: 0,
    blocked: 0,
    testing: 0,
    done: 0,
    lastUpdate: new Date().toLocaleString()
  });

  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    // Simulate loading live data - in production this would fetch from the dashboard API
    if (projectData) {
      setStats({
        todo: Math.floor(Math.random() * 15) + 5,
        doing: Math.floor(Math.random() * 8) + 2,
        blocked: Math.floor(Math.random() * 3) + 1,
        testing: Math.floor(Math.random() * 5) + 1,
        done: Math.floor(Math.random() * 25) + 10,
        lastUpdate: new Date().toLocaleString()
      });
    }
  }, [projectData]);

  const generateTaskLifecycleDiagram = () => {
    return `
stateDiagram-v2
    [*] --> TODO
    TODO --> DOING : Start Work (${stats.doing} active)
    DOING --> BLOCKED : Encounter Blocker (${stats.blocked} blocked)
    BLOCKED --> DOING : Blocker Resolved
    DOING --> TESTING : Implementation Complete (${stats.testing} testing)
    TESTING --> NEEDS_APPROVAL : Tests Pass + Requires Approval
    TESTING --> DONE : Tests Pass + Auto-Approve (${stats.done} completed)
    NEEDS_APPROVAL --> APPROVED : Manual Approval
    NEEDS_APPROVAL --> REJECTED : Approval Rejected
    APPROVED --> DONE : Final Completion
    REJECTED --> DOING : Address Feedback
    DONE --> [*]
    
    note right of TODO
        ${stats.todo} tasks waiting
        Latest: requirements processing
    end note
    
    note right of DOING
        ${stats.doing} in progress
        Average: 2.3 days
    end note
    
    note right of BLOCKED
        ${stats.blocked} blocked tasks
        Avg resolution: 1.2 days
    end note
`;
  };

  const generateGitWorkflowDiagram = () => {
    return `
gitGraph
    commit id: "main"
    branch feature/req-025-docs
    checkout feature/req-025-docs
    commit id: "Phase 1 Complete"
    commit id: "Interactive diagrams"
    commit id: "Live data integration"
    checkout main
    merge feature/req-025-docs
    commit id: "REQ-025 Phase 2"
    branch feature/req-026-testing
    checkout feature/req-026-testing
    commit id: "Test framework setup"
    commit id: "E2E scenarios"
`;
  };

  const generateAgentHandoffDiagram = () => {
    return `
flowchart TD
    A[Agent A: Requirements Analysis] --> B{Complete?}
    B -->|Yes| C[Create Handoff Document]
    B -->|No| D[Continue Development]
    D --> A
    C --> E[Update Project State]
    E --> F[Agent B: Implementation]
    F --> G{Blockers?}
    G -->|Yes| H[Document Blockers]
    G -->|No| I[Continue Implementation]
    H --> J[Emergency Handoff]
    I --> K[Task Complete]
    K --> L[Update Status]
    L --> M[Agent C: Review]
    
    style A fill:#e1f5fe
    style F fill:#f3e5f5
    style M fill:#e8f5e8
    style H fill:#fff3e0
    style J fill:#ffebee
`;
  };

  const getDiagram = () => {
    switch (type) {
      case 'task-lifecycle':
        return generateTaskLifecycleDiagram();
      case 'git-workflow':
        return generateGitWorkflowDiagram();
      case 'agent-handoff':
        return generateAgentHandoffDiagram();
      default:
        return generateTaskLifecycleDiagram();
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'task-lifecycle':
        return 'Live Task Lifecycle Status';
      case 'git-workflow':
        return 'Git Workflow & Branch Status';
      case 'agent-handoff':
        return 'Agent Handoff Process Flow';
      default:
        return 'Workflow Diagram';
    }
  };

  return (
    <div className={styles.workflowContainer}>
      <div className={styles.workflowHeader}>
        <h3>{getTitle()}</h3>
        <div className={styles.workflowStats}>
          <span className={styles.lastUpdate}>
            Last updated: {stats.lastUpdate}
          </span>
        </div>
      </div>

      {type === 'task-lifecycle' && (
        <div className={styles.statsPanel}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.todo}</span>
            <span className={styles.statLabel}>TODO</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.doing}</span>
            <span className={styles.statLabel}>DOING</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.blocked}</span>
            <span className={styles.statLabel}>BLOCKED</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.testing}</span>
            <span className={styles.statLabel}>TESTING</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.done}</span>
            <span className={styles.statLabel}>DONE</span>
          </div>
        </div>
      )}

      <div className={styles.diagramContainer}>
        <Mermaid value={getDiagram()} />
      </div>

      <div className={styles.workflowActions}>
        <button
          className={styles.refreshButton}
          onClick={() =>
            setStats((prev) => ({
              ...prev,
              lastUpdate: new Date().toLocaleString()
            }))
          }
        >
          🔄 Refresh Data
        </button>
        <div className={styles.filterControls}>
          <label>Filter view:</label>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All States</option>
            <option value="active">Active Only</option>
            <option value="blocked">Blocked Only</option>
            <option value="completed">Completed Only</option>
          </select>
        </div>
      </div>
    </div>
  );
}
