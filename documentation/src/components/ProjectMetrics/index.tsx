import { useEffect, useState } from 'react';
import styles from './styles.module.css';

interface ProjectMetricsProps {
  data?: {
    totalRequirements?: number;
    completedRequirements?: number;
    pendingRequirements?: number;
    totalCommands?: number;
    lastUpdate?: string;
  };
}

interface MetricsData {
  requirements: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    completionRate: number;
  };
  development: {
    activeBranches: number;
    dailyCommits: number;
    testCoverage: number;
    codeQuality: number;
  };
  workflow: {
    openHandoffs: number;
    blockedTasks: number;
    avgCycleTime: number;
    automationRate: number;
  };
  lastUpdate: string;
}

export default function ProjectMetrics({
  data
}: ProjectMetricsProps): JSX.Element {
  const [metrics, setMetrics] = useState<MetricsData>({
    requirements: {
      total: 31,
      completed: 12,
      pending: 15,
      inProgress: 4,
      completionRate: 38.7
    },
    development: {
      activeBranches: 3,
      dailyCommits: 8,
      testCoverage: 85,
      codeQuality: 92
    },
    workflow: {
      openHandoffs: 1,
      blockedTasks: 2,
      avgCycleTime: 2.8,
      automationRate: 94
    },
    lastUpdate: new Date().toLocaleString()
  });

  const [selectedView, setSelectedView] = useState<
    'overview' | 'requirements' | 'development' | 'workflow'
  >('overview');

  useEffect(() => {
    // Simulate live data updates every 30 seconds
    const interval = setInterval(() => {
      setMetrics((prev) => ({
        ...prev,
        development: {
          ...prev.development,
          dailyCommits: Math.floor(Math.random() * 12) + 5,
          activeBranches: Math.floor(Math.random() * 5) + 2
        },
        workflow: {
          ...prev.workflow,
          blockedTasks: Math.floor(Math.random() * 4),
          avgCycleTime: Math.round((Math.random() * 2 + 1.5) * 10) / 10
        },
        lastUpdate: new Date().toLocaleString()
      }));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const renderOverview = () => (
    <div className={styles.overviewGrid}>
      <div className={styles.metricCard}>
        <div className={styles.metricValue}>{metrics.requirements.total}</div>
        <div className={styles.metricLabel}>Total Requirements</div>
        <div className={styles.metricSubtext}>
          {metrics.requirements.completed} completed,{' '}
          {metrics.requirements.pending} pending
        </div>
      </div>

      <div className={styles.metricCard}>
        <div className={styles.metricValue}>
          {metrics.requirements.completionRate}%
        </div>
        <div className={styles.metricLabel}>Completion Rate</div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${metrics.requirements.completionRate}%` }}
          />
        </div>
      </div>

      <div className={styles.metricCard}>
        <div className={styles.metricValue}>
          {metrics.development.activeBranches}
        </div>
        <div className={styles.metricLabel}>Active Branches</div>
        <div className={styles.metricSubtext}>
          {metrics.development.dailyCommits} commits today
        </div>
      </div>

      <div className={styles.metricCard}>
        <div className={styles.metricValue}>
          {metrics.workflow.avgCycleTime}d
        </div>
        <div className={styles.metricLabel}>Avg Cycle Time</div>
        <div className={styles.metricSubtext}>
          {metrics.workflow.blockedTasks} tasks blocked
        </div>
      </div>
    </div>
  );

  const renderRequirements = () => (
    <div className={styles.detailView}>
      <div className={styles.chartContainer}>
        <div className={styles.donutChart}>
          <div className={styles.donutInner}>
            <div className={styles.donutValue}>
              {metrics.requirements.completionRate}%
            </div>
            <div className={styles.donutLabel}>Complete</div>
          </div>
        </div>
      </div>
      <div className={styles.requirementsList}>
        <div className={styles.requirementItem}>
          <span className={`${styles.requirementStatus} ${styles.completed}`}>
            ●
          </span>
          <span>Completed: {metrics.requirements.completed}</span>
        </div>
        <div className={styles.requirementItem}>
          <span className={`${styles.requirementStatus} ${styles.inProgress}`}>
            ●
          </span>
          <span>In Progress: {metrics.requirements.inProgress}</span>
        </div>
        <div className={styles.requirementItem}>
          <span className={`${styles.requirementStatus} ${styles.pending}`}>
            ●
          </span>
          <span>Pending: {metrics.requirements.pending}</span>
        </div>
      </div>
    </div>
  );

  const renderDevelopment = () => (
    <div className={styles.devMetrics}>
      <div className={styles.metricRow}>
        <span>Test Coverage</span>
        <div className={styles.metricBar}>
          <div
            className={styles.metricBarFill}
            style={{ width: `${metrics.development.testCoverage}%` }}
          />
          <span className={styles.metricBarValue}>
            {metrics.development.testCoverage}%
          </span>
        </div>
      </div>

      <div className={styles.metricRow}>
        <span>Code Quality</span>
        <div className={styles.metricBar}>
          <div
            className={`${styles.metricBarFill} ${styles.quality}`}
            style={{ width: `${metrics.development.codeQuality}%` }}
          />
          <span className={styles.metricBarValue}>
            {metrics.development.codeQuality}%
          </span>
        </div>
      </div>

      <div className={styles.metricRow}>
        <span>Automation Rate</span>
        <div className={styles.metricBar}>
          <div
            className={`${styles.metricBarFill} ${styles.automation}`}
            style={{ width: `${metrics.workflow.automationRate}%` }}
          />
          <span className={styles.metricBarValue}>
            {metrics.workflow.automationRate}%
          </span>
        </div>
      </div>
    </div>
  );

  const renderWorkflow = () => (
    <div className={styles.workflowMetrics}>
      <div className={styles.workflowStat}>
        <div className={styles.workflowValue}>
          {metrics.workflow.openHandoffs}
        </div>
        <div className={styles.workflowLabel}>Open Handoffs</div>
      </div>
      <div className={styles.workflowStat}>
        <div className={styles.workflowValue}>
          {metrics.workflow.blockedTasks}
        </div>
        <div className={styles.workflowLabel}>Blocked Tasks</div>
      </div>
      <div className={styles.workflowStat}>
        <div className={styles.workflowValue}>
          {metrics.development.dailyCommits}
        </div>
        <div className={styles.workflowLabel}>Daily Commits</div>
      </div>
    </div>
  );

  return (
    <div className={styles.metricsContainer}>
      <div className={styles.metricsHeader}>
        <h3>📊 Live Project Metrics</h3>
        <span className={styles.lastUpdate}>Updated: {metrics.lastUpdate}</span>
      </div>

      <div className={styles.tabContainer}>
        <button
          className={`${styles.tab} ${selectedView === 'overview' ? styles.active : ''}`}
          onClick={() => setSelectedView('overview')}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${selectedView === 'requirements' ? styles.active : ''}`}
          onClick={() => setSelectedView('requirements')}
        >
          Requirements
        </button>
        <button
          className={`${styles.tab} ${selectedView === 'development' ? styles.active : ''}`}
          onClick={() => setSelectedView('development')}
        >
          Development
        </button>
        <button
          className={`${styles.tab} ${selectedView === 'workflow' ? styles.active : ''}`}
          onClick={() => setSelectedView('workflow')}
        >
          Workflow
        </button>
      </div>

      <div className={styles.metricsContent}>
        {selectedView === 'overview' && renderOverview()}
        {selectedView === 'requirements' && renderRequirements()}
        {selectedView === 'development' && renderDevelopment()}
        {selectedView === 'workflow' && renderWorkflow()}
      </div>
    </div>
  );
}
