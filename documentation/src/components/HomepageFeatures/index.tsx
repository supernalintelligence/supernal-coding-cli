import Heading from '@theme/Heading';
import type { ReactNode } from 'react';
import styles from './styles.module.css';

type WorkflowStep = {
  step: number;
  title: string;
  description: ReactNode;
  aiRole: string;
  humanRole: string;
};

const WorkflowSteps: WorkflowStep[] = [
  {
    step: 0,
    title: 'See a Problem or Have an Idea',
    description: (
      <>
        Identify an opportunity or challenge that needs solving. Validate it's
        worth pursuing.
      </>
    ),
    aiRole: 'AI helps research and validate the idea',
    humanRole: 'Define the vision and business value'
  },
  {
    step: 1,
    title: 'Write Stories',
    description: (
      <>
        Capture requirements as user stories that describe what needs to be
        built
      </>
    ),
    aiRole: 'AI helps structure and validate stories',
    humanRole: 'Define business needs and priorities'
  },
  {
    step: 2,
    title: 'Model Everything',
    description: (
      <>
        Define names, types, components, containers, data structures,
        architecture, tests, and code patterns
      </>
    ),
    aiRole: 'AI generates comprehensive models and architecture',
    humanRole: 'Review and refine technical decisions'
  },
  {
    step: 3,
    title: 'Generate Tests',
    description: (
      <>
        Create comprehensive test suites that validate against requirements and
        models
      </>
    ),
    aiRole: 'AI creates test frameworks and cases',
    humanRole: 'Validate test coverage and edge cases'
  },
  {
    step: 4,
    title: 'Implement & Iterate',
    description: (
      <>
        Build features with AI assistance, continuously validating against tests
        and requirements
      </>
    ),
    aiRole: 'AI generates code and fixes issues',
    humanRole: 'Guide implementation and ensure quality'
  }
];

function WorkflowStep({
  step,
  title,
  description,
  aiRole,
  humanRole
}: WorkflowStep) {
  return (
    <div className={styles.workflowStep}>
      <div className={styles.stepNumber}>{step}</div>
      <div className={styles.stepContent}>
        <Heading as="h3" className={styles.stepTitle}>
          {title}
        </Heading>
        <p className={styles.stepDescription}>{description}</p>
        <div className={styles.rolesContainer}>
          <div className={styles.aiRole}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span>{aiRole}</span>
          </div>
          <div className={styles.humanRole}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>{humanRole}</span>
          </div>
        </div>
      </div>
      {step < 4 && (
        <div className={styles.stepArrow}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.workflowContainer}>
          {WorkflowSteps.map((props) => (
            <WorkflowStep key={props.step} {...props} />
          ))}
        </div>
        <div className={styles.emphasisNote}>
          <p>
            <strong>AI-Accelerated at Every Step</strong> — Human expertise
            guides the process while AI handles the heavy lifting
          </p>
        </div>
      </div>
    </section>
  );
}
