import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import CompetitiveComparison from '@site/src/components/CompetitiveComparison';
import CookieBanner from '@site/src/components/CookieBanner/CookieBanner';
import ErrorBoundary from '@site/src/components/ErrorBoundary/ErrorBoundary';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import SignupCTA from '@site/src/components/SignupCTA/SignupCTA';
import WorkflowDiagram from '@site/src/components/WorkflowDiagram';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import styles from './index.module.css';

// WHAT WE DO - Hero
function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          AI Accelerated Development
        </Heading>
        <p className="hero__subtitle">
          Build production-ready software faster with AI agents guided by
          structured workflows, priorities, and continuous iteration.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/">
            Start Building
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started"
          >
            Why Supernal?
          </Link>
          <a
            className="button button--outline button--lg"
            href="/dashboard-live"
            target="_blank"
            rel="noopener noreferrer"
          >
            See It In Action
          </a>
        </div>
      </div>
    </header>
  );
}

// THE PROBLEM
function ProblemSection() {
  return (
    <section className={styles.problemSection}>
      <div className="container">
        <div className="row">
          <div className="col col--8 col--offset-2">
            <div className="text--center">
              <Heading as="h2" className={styles.sectionTitle}>
                The Challenge
              </Heading>
              <p className={styles.problemText}>
                Developing quickly with AI needs to be done right.
              </p>
              <p className={styles.problemText}>
                Developing compliance systems quickly is even harder.
              </p>
              <p className={styles.problemSubtext}>
                AI agents can generate code fast, but without structure,
                priorities, and traceability, you end up with technical debt,
                compliance gaps, and features that miss the mark.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// THE UNDERSTANDING - Workflow
// (WorkflowDiagram component shows the development cycle)

// THE SOLUTION
function SolutionSection() {
  return (
    <section className={styles.solutionSection}>
      <div className="container">
        <div className="row">
          <div className="col col--10 col--offset-1">
            <div className="text--center margin-bottom--lg">
              <Heading as="h2" className={styles.sectionTitle}>
                Supernal Coding Provides the Structure.
              </Heading>
              <p className={styles.solutionSubtitle}>
                Your people work with AI agents to create code that measurably
                solves problems.
              </p>
            </div>
          </div>
        </div>
        <HomepageFeatures />
      </div>
    </section>
  );
}

// CONTACT/CTA
function ContactSection() {
  return (
    <section className={styles.contactSection}>
      <div className="container">
        <div className="row">
          <div className="col col--8 col--offset-2">
            <div className="text--center">
              <Heading as="h2" className={styles.sectionTitle}>
                Ready to Build Better Software?
              </Heading>
              <p className={styles.contactText}>
                Join developers using Supernal Coding to ship compliant,
                high-quality software with AI-accelerated workflows.
              </p>
              <div className={styles.contactButtons}>
                <Link className="button button--primary button--lg" to="/docs/">
                  Get Started
                </Link>
                <Link
                  className="button button--outline button--lg"
                  href="https://github.com/supernalintelligence/supernal-coding"
                  aria-label="View on GitHub"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    height="24"
                    viewBox="0 0 16 16"
                    width="24"
                    fill="currentColor"
                    style={{ marginRight: '4px' }}
                  >
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                  </svg>
                  <svg
                    height="16"
                    viewBox="0 0 24 24"
                    width="16"
                    fill="currentColor"
                    style={{ opacity: 0.7 }}
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// FOOTER MESSAGE
function FooterMessage() {
  return (
    <section className={styles.footerMessage}>
      <div className="container">
        <div className="row">
          <div className="col col--12">
            <p className={styles.footerText}>
              We are building the core of evolving AI-accelerated development.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="AI Accelerated Development"
      description="Developing quickly with AI needs to be done right. Build production-ready software with structured workflows, priority-driven iteration, and intelligent AI agents."
    >
      <HomepageHeader />
      <main>
        <ProblemSection />
        <WorkflowDiagram />
        <SolutionSection />
        <CompetitiveComparison />
        <SignupCTA
          variant="banner"
          title="Get Early Access to Enterprise Features"
          description="Join our beta program for advanced workflow automation and priority support."
        />
        <ContactSection />
        <FooterMessage />
      </main>
      <ErrorBoundary
        fallback={<div>Cookie preferences temporarily unavailable</div>}
      >
        <CookieBanner />
      </ErrorBoundary>
    </Layout>
  );
}
