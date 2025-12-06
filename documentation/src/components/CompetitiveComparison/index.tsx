import clsx from 'clsx';
import type React from 'react';
import { useState } from 'react';
import styles from './styles.module.css';

interface ComparisonFeature {
  category: string;
  feature: string;
  supernal: 'full' | 'partial' | 'none';
  specKit: 'full' | 'partial' | 'none';
  taskMaster: 'full' | 'partial' | 'none';
  description: string;
}

const comparisonData: ComparisonFeature[] = [
  // INCEPTION PHASE - Requirements & Planning
  {
    category: 'Inception Phase',
    feature: 'Gherkin/BDD Specifications',
    supernal: 'full',
    specKit: 'full',
    taskMaster: 'none',
    description:
      'Behavior-driven development with executable Gherkin scenarios',
  },
  {
    category: 'Inception Phase',
    feature: 'Requirement Validation',
    supernal: 'full',
    specKit: 'partial',
    taskMaster: 'none',
    description:
      'Automated validation of requirement structure and completeness',
  },
  {
    category: 'Inception Phase',
    feature: 'Traceability Matrix',
    supernal: 'full',
    specKit: 'none',
    taskMaster: 'none',
    description:
      'Automated bi-directional traceability from requirements to code to tests',
  },
  {
    category: 'Inception Phase',
    feature: 'Task Decomposition',
    supernal: 'full',
    specKit: 'partial',
    taskMaster: 'full',
    description: 'AI-driven breakdown of requirements into actionable tasks',
  },
  {
    category: 'Inception Phase',
    feature: 'Multi-Repository Support',
    supernal: 'full',
    specKit: 'none',
    taskMaster: 'none',
    description: 'Requirements spanning multiple coordinated repositories',
  },

  // CONSTRUCTION PHASE - Development & Implementation
  {
    category: 'Construction Phase',
    feature: 'Git-Smart Workflow',
    supernal: 'full',
    specKit: 'partial',
    taskMaster: 'none',
    description:
      'Intelligent version control with safety validation and requirement linking',
  },
  {
    category: 'Construction Phase',
    feature: 'Automated Branching',
    supernal: 'partial',
    specKit: 'full',
    taskMaster: 'none',
    description:
      'Requirement-driven branch creation with naming conventions (in development)',
  },
  {
    category: 'Construction Phase',
    feature: 'Git Hooks Validation',
    supernal: 'full',
    specKit: 'partial',
    taskMaster: 'none',
    description: 'Pre-commit/pre-push validation integrated into Git workflow',
  },
  {
    category: 'Construction Phase',
    feature: 'Multi-Agent Coordination',
    supernal: 'full',
    specKit: 'none',
    taskMaster: 'partial',
    description:
      'Multiple AI agents working simultaneously with conflict detection',
  },
  {
    category: 'Construction Phase',
    feature: 'Story-to-Test Generation',
    supernal: 'full',
    specKit: 'partial',
    taskMaster: 'none',
    description:
      'AI-powered test generation from user stories via interface.supernal.ai',
  },
  // {
  //   category: 'Construction Phase',
  //   feature: 'Context Memory Across Sessions',
  //   supernal: 'full',
  //   specKit: 'none',
  //   taskMaster: 'full',
  //   description: 'Persistent project context and decision history',
  // },
  {
    category: 'Construction Phase',
    feature: 'Domain Model Artifacts',
    supernal: 'partial',
    specKit: 'partial',
    taskMaster: 'none',
    description: 'Documentation of domain models and architectural decisions',
  },

  // TESTING & VALIDATION PHASE
  {
    category: 'Testing & Validation',
    feature: 'Test Framework Generation',
    supernal: 'full',
    specKit: 'full',
    taskMaster: 'none',
    description: 'Automated test scaffolding from Gherkin scenarios',
  },
  {
    category: 'Testing & Validation',
    feature: 'Coverage Enforcement',
    supernal: 'full',
    specKit: 'partial',
    taskMaster: 'none',
    description: 'Priority-based coverage targets with automated tracking',
  },
  {
    category: 'Testing & Validation',
    feature: 'Test-to-Requirement Mapping',
    supernal: 'full',
    specKit: 'partial',
    taskMaster: 'none',
    description: 'Explicit links between tests and requirements',
  },
  {
    category: 'Testing & Validation',
    feature: 'Continuous Test Execution',
    supernal: 'full',
    specKit: 'full',
    taskMaster: 'none',
    description: 'Automated testing on every commit/push',
  },
  {
    category: 'Testing & Validation',
    feature: 'Performance & Security Testing',
    supernal: 'partial',
    specKit: 'none',
    taskMaster: 'none',
    description:
      'Under testing: Performance benchmarking and security scanning',
  },

  // OPERATIONS PHASE - Monitoring & Deployment
  {
    category: 'Operations Phase',
    feature: 'Real-Time Dashboard',
    supernal: 'full',
    specKit: 'partial',
    taskMaster: 'none',
    description: 'Live visualization of project status, tests, and coverage',
  },
  {
    category: 'Operations Phase',
    feature: 'Deployment Validation',
    supernal: 'partial',
    specKit: 'none',
    taskMaster: 'none',
    description:
      'Under testing: Pre-deployment safety checks and requirement verification',
  },
  {
    category: 'Operations Phase',
    feature: 'Compliance Reporting',
    supernal: 'full',
    specKit: 'none',
    taskMaster: 'none',
    description: 'Automated audit trails and regulatory compliance exports',
  },
  {
    category: 'Operations Phase',
    feature: 'Observability Integration',
    supernal: 'partial',
    specKit: 'none',
    taskMaster: 'none',
    description: 'Basic monitoring with planned AI-driven observability',
  },

  // COLLABORATION & WORKFLOW
  {
    category: 'Collaboration & Workflow',
    feature: 'Unified CLI',
    supernal: 'full',
    specKit: 'partial',
    taskMaster: 'full',
    description: 'Single command interface coordinating entire lifecycle',
  },
  {
    category: 'Collaboration & Workflow',
    feature: 'AI Agent Handoffs',
    supernal: 'full',
    specKit: 'none',
    taskMaster: 'partial',
    description: 'Seamless context transfer between AI agents and sessions',
  },
  {
    category: 'Collaboration & Workflow',
    feature: 'Project Templates',
    supernal: 'full',
    specKit: 'full',
    taskMaster: 'none',
    description: 'Pre-configured templates for quick project initialization',
  },
  {
    category: 'Collaboration & Workflow',
    feature: 'Documentation Generation',
    supernal: 'full',
    specKit: 'full',
    taskMaster: 'none',
    description: 'Automated BUILDME, TESTME, and API documentation',
  },

  // ENTERPRISE & COMPLIANCE
  {
    category: 'Enterprise & Compliance',
    feature: 'Regulatory Compliance (FDA, GxP)',
    supernal: 'full',
    specKit: 'none',
    taskMaster: 'none',
    description: 'Built-in 21 CFR Part 11 compliance and CSV workflows',
  },
  {
    category: 'Enterprise & Compliance',
    feature: 'Audit Trail Automation',
    supernal: 'full',
    specKit: 'none',
    taskMaster: 'none',
    description: 'Immutable audit logs with digital signatures',
  },
  {
    category: 'Enterprise & Compliance',
    feature: 'Multi-Repo Family Architecture',
    supernal: 'full',
    specKit: 'none',
    taskMaster: 'none',
    description: 'Coordinated development across repository families',
  },
  {
    category: 'Enterprise & Compliance',
    feature: 'Custom Workflow Extensions',
    supernal: 'full',
    specKit: 'partial',
    taskMaster: 'partial',
    description: 'Extensible architecture for organization-specific needs',
  },
  {
    category: 'Enterprise & Compliance',
    feature: 'Open Source & Self-Hosted',
    supernal: 'full',
    specKit: 'partial',
    taskMaster: 'partial',
    description: 'Run on your infrastructure with no vendor lock-in',
  },
];

const FeatureIcon: React.FC<{ status: 'full' | 'partial' | 'none' }> = ({
  status,
}) => {
  const tooltips = {
    full: 'Full Support',
    partial: 'Partial / In Development',
    none: 'Not Supported',
  };

  switch (status) {
    case 'full':
      return (
        <span className={styles.iconFull} title={tooltips.full}>
          ✓
        </span>
      );
    case 'partial':
      return (
        <span className={styles.iconPartial} title={tooltips.partial}>
          ~
        </span>
      );
    case 'none':
      return (
        <span className={styles.iconNone} title={tooltips.none}>
          −
        </span>
      );
  }
};

const CompetitiveComparison: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const categories = [
    'all',
    ...Array.from(new Set(comparisonData.map((item) => item.category))),
  ];
  const filteredData =
    selectedCategory === 'all'
      ? comparisonData
      : comparisonData.filter((item) => item.category === selectedCategory);

  // Show only first 8 items when collapsed
  const displayData = isExpanded ? filteredData : filteredData.slice(0, 8);
  const hasMore = filteredData.length > 8;

  return (
    <section className={styles.comparison}>
      <div className="container">
        <div className={styles.header}>
          <h2>Development Lifecycle Comparison</h2>
          <p className={styles.subtitle}>
            Comprehensive comparison across all SDLC phases
          </p>
        </div>

        <div className={styles.controls}>
          <div className={styles.categoryFilter}>
            {categories.map((category) => (
              <button
                key={category}
                className={clsx(
                  styles.categoryButton,
                  selectedCategory === category && styles.active
                )}
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'All Phases' : category}
              </button>
            ))}
          </div>

          <button
            className={styles.detailsToggle}
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide' : 'Show'} Descriptions
          </button>
        </div>

        <div className={styles.comparisonTable}>
          <div className={styles.tableHeader}>
            <div className={styles.featureColumn}>Capability</div>
            <div className={styles.productColumn}>Supernal</div>
            <div className={styles.productColumn}>Spec-Kit</div>
            <div className={styles.productColumn}>TaskMaster</div>
          </div>

          {displayData.map((item, index) => (
            <div key={index} className={styles.tableRow}>
              <div className={styles.featureColumn}>
                <div className={styles.featureName}>{item.feature}</div>
                {showDetails && (
                  <div className={styles.featureDescription}>
                    {item.description}
                  </div>
                )}
              </div>
              <div className={styles.productColumn}>
                <FeatureIcon status={item.supernal} />
              </div>
              <div className={styles.productColumn}>
                <FeatureIcon status={item.specKit} />
              </div>
              <div className={styles.productColumn}>
                <FeatureIcon status={item.taskMaster} />
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className={styles.expandButtonContainer}>
            <button
              className={styles.expandButton}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  Show Less <span className={styles.arrow}>▲</span>
                </>
              ) : (
                <>
                  Show All {filteredData.length} Features{' '}
                  <span className={styles.arrow}>▼</span>
                </>
              )}
            </button>
          </div>
        )}

        <div className={styles.callout}>
          <h3>Working with AI Driven Development</h3>
          <p>
            Supernal Coding extends the principles from{' '}
            <a
              href="https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/"
              target="_blank"
              rel="noopener noreferrer"
            >
              AWS AI-Driven Development Lifecycle (AI-DLC)
            </a>{' '}
            with production-ready tooling and enterprise features:
          </p>
          <ul>
            <li>
              <strong>Complete Implementation:</strong> Not just methodology -
              actual tools you can use today
            </li>
            <li>
              <strong>Story-to-Test Generation:</strong> AI-powered via{' '}
              <a
                href="https://interface.supernal.ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                interface.supernal.ai
              </a>
            </li>
            <li>
              <strong>Git-Smart Integration:</strong> Intelligent version
              control with safety validation throughout the lifecycle
            </li>
            <li>
              <strong>Compliance Automation:</strong> Built-in support for
              regulated industries (FDA 21 CFR Part 11, GxP)
            </li>
            <li>
              <strong>Real-Time Visibility:</strong> Live dashboards for
              requirements, tests, coverage, and agent activity
            </li>
            <li>
              <strong>Multi-Repo Coordination:</strong> Family-based
              architecture for complex enterprise systems
            </li>
            <li>
              <strong>Open Source:</strong> Run on your infrastructure with full
              customization and no vendor lock-in
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default CompetitiveComparison;
