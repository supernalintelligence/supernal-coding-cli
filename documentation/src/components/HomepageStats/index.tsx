import Heading from '@theme/Heading';
import clsx from 'clsx';
import styles from './styles.module.css';

type StatItem = {
  title: string;
  value: string;
  description: string;
  icon: string;
};

const _StatsList: StatItem[] = [
  {
    title: 'CLI Commands',
    value: '17+',
    description: 'Auto-documented commands for complete workflow management',
    icon: '🛠️'
  },
  {
    title: 'Requirements Tracked',
    value: '31',
    description: 'Live requirement tracking with automated git integration',
    icon: '📋'
  },
  {
    title: 'Workflow Phases',
    value: '6',
    description: 'Complete development lifecycle from epic to deployment',
    icon: '🔄'
  },
  {
    title: 'Agent Handoffs',
    value: '100%',
    description: 'Structured knowledge transfer between AI agents',
    icon: '🤖'
  }
];

function _Stat({ title, value, description, icon }: StatItem) {
  return (
    <div className={clsx('col col--3')}>
      <div className={styles.statCard}>
        <div className={styles.statIcon}>{icon}</div>
        <div className={styles.statValue}>{value}</div>
        <Heading as="h4" className={styles.statTitle}>
          {title}
        </Heading>
        <p className={styles.statDescription}>{description}</p>
      </div>
    </div>
  );
}
