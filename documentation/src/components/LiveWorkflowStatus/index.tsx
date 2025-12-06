import { useEffect, useState } from 'react';
import styles from './styles.module.css';

interface ActivityItem {
  id: string;
  timestamp: Date;
  type: 'commit' | 'requirement' | 'task' | 'handoff' | 'build';
  message: string;
  user?: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

interface WorkflowStatus {
  isOnline: boolean;
  lastUpdate: Date;
  activeAgents: number;
  pendingTasks: number;
  blockedItems: number;
  buildStatus: 'passing' | 'failing' | 'building';
  systemHealth: number; // 0-100
}

interface LiveWorkflowStatusProps {
  updateInterval?: number;
}

export default function LiveWorkflowStatus({
  updateInterval = 10000
}: LiveWorkflowStatusProps): JSX.Element {
  const [status, setStatus] = useState<WorkflowStatus>({
    isOnline: true,
    lastUpdate: new Date(),
    activeAgents: 1,
    pendingTasks: 8,
    blockedItems: 2,
    buildStatus: 'passing',
    systemHealth: 94
  });

  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      type: 'commit',
      message: 'REQ-025: Enhanced interactive workflow documentation',
      user: 'Claude',
      status: 'success'
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 600000), // 10 minutes ago
      type: 'build',
      message: 'Documentation build completed successfully',
      status: 'success'
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 900000), // 15 minutes ago
      type: 'requirement',
      message: 'REQ-025 Phase 2 marked as completed',
      user: 'System',
      status: 'success'
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 1200000), // 20 minutes ago
      type: 'task',
      message: 'Interactive workflow components testing in progress',
      status: 'info'
    },
    {
      id: '5',
      timestamp: new Date(Date.now() - 1500000), // 25 minutes ago
      type: 'handoff',
      message: 'REQ-025 Phase 2 handoff document created',
      user: 'Claude',
      status: 'success'
    }
  ]);

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time updates
      setStatus((prev) => ({
        ...prev,
        lastUpdate: new Date(),
        pendingTasks: Math.max(
          0,
          prev.pendingTasks +
            (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0)
        ),
        blockedItems: Math.max(
          0,
          prev.blockedItems +
            (Math.random() > 0.9 ? (Math.random() > 0.5 ? 1 : -1) : 0)
        ),
        systemHealth: Math.min(
          100,
          Math.max(85, prev.systemHealth + (Math.random() - 0.5) * 2)
        )
      }));

      // Occasionally add new activities
      if (Math.random() > 0.8) {
        const newActivity: ActivityItem = {
          id: Date.now().toString(),
          timestamp: new Date(),
          type: ['commit', 'task', 'build', 'requirement'][
            Math.floor(Math.random() * 4)
          ] as any,
          message: [
            'Component state updated',
            'Real-time data refresh completed',
            'Live metrics synchronized',
            'Workflow status refreshed',
            'Interactive filter updated'
          ][Math.floor(Math.random() * 5)],
          user: Math.random() > 0.5 ? 'System' : 'Claude',
          status: 'info'
        };

        setActivities((prev) => [newActivity, ...prev.slice(0, 9)]); // Keep last 10 items
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  const getStatusIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'commit':
        return '📝';
      case 'requirement':
        return '📋';
      case 'task':
        return '✅';
      case 'handoff':
        return '🤝';
      case 'build':
        return '🔨';
      default:
        return '📌';
    }
  };

  const getStatusColor = (status: ActivityItem['status']) => {
    switch (status) {
      case 'success':
        return styles.statusSuccess;
      case 'warning':
        return styles.statusWarning;
      case 'error':
        return styles.statusError;
      case 'info':
        return styles.statusInfo;
      default:
        return styles.statusInfo;
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getHealthColor = (health: number) => {
    if (health >= 90) return styles.healthExcellent;
    if (health >= 75) return styles.healthGood;
    if (health >= 60) return styles.healthWarning;
    return styles.healthPoor;
  };

  return (
    <div className={styles.workflowStatus}>
      <div
        className={styles.statusHeader}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={styles.statusIndicator}>
          <div
            className={`${styles.onlineIndicator} ${status.isOnline ? styles.online : styles.offline}`}
          />
          <h4>Live Workflow Status</h4>
        </div>
        <div className={styles.statusSummary}>
          <span className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Tasks:</span>
            <span className={styles.summaryValue}>{status.pendingTasks}</span>
          </span>
          <span className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Health:</span>
            <span
              className={`${styles.summaryValue} ${getHealthColor(status.systemHealth)}`}
            >
              {Math.round(status.systemHealth)}%
            </span>
          </span>
          <button className={styles.expandButton}>
            {isExpanded ? '🔼' : '🔽'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.statusDetails}>
          <div className={styles.metricsRow}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{status.activeAgents}</div>
              <div className={styles.metricLabel}>Active Agents</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{status.pendingTasks}</div>
              <div className={styles.metricLabel}>Pending Tasks</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{status.blockedItems}</div>
              <div className={styles.metricLabel}>Blocked Items</div>
            </div>

            <div className={styles.metricCard}>
              <div
                className={`${styles.metricValue} ${status.buildStatus === 'passing' ? styles.statusSuccess : styles.statusError}`}
              >
                {status.buildStatus === 'passing' ? '✅' : '❌'}
              </div>
              <div className={styles.metricLabel}>Build Status</div>
            </div>
          </div>

          <div className={styles.healthBar}>
            <div className={styles.healthLabel}>System Health</div>
            <div className={styles.healthBarTrack}>
              <div
                className={`${styles.healthBarFill} ${getHealthColor(status.systemHealth)}`}
                style={{ width: `${status.systemHealth}%` }}
              />
            </div>
            <div className={styles.healthValue}>
              {Math.round(status.systemHealth)}%
            </div>
          </div>

          <div className={styles.activityFeed}>
            <h5>Recent Activity</h5>
            <div className={styles.activityList}>
              {activities.map((activity) => (
                <div key={activity.id} className={styles.activityItem}>
                  <div className={styles.activityIcon}>
                    {getStatusIcon(activity.type)}
                  </div>
                  <div className={styles.activityContent}>
                    <div className={styles.activityMessage}>
                      {activity.message}
                    </div>
                    <div className={styles.activityMeta}>
                      {activity.user && (
                        <span className={styles.activityUser}>
                          {activity.user}
                        </span>
                      )}
                      <span className={styles.activityTime}>
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`${styles.activityStatus} ${getStatusColor(activity.status)}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={styles.statusFooter}>
            <span className={styles.lastUpdate}>
              Last updated: {status.lastUpdate.toLocaleTimeString()}
            </span>
            <button
              className={styles.refreshButton}
              onClick={() =>
                setStatus((prev) => ({ ...prev, lastUpdate: new Date() }))
              }
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
