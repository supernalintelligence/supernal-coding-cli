import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import styles from './styles.module.css';

interface WorkflowStage {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

// SVG Icons as React components
const SearchIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const BookIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const ClipboardIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </svg>
);

const BoxIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const RocketIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

const ActivityIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const MicroscopeIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 18h8" />
    <path d="M3 22h18" />
    <path d="M14 22a7 7 0 1 0 0-14h-1" />
    <path d="M9 14h2" />
    <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
    <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
  </svg>
);

const PlayIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const PauseIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const workflowStages: WorkflowStage[] = [
  {
    title: 'Discover',
    description: 'See a problem or solution opportunity',
    icon: <SearchIcon />,
    color: '#1e293b'
  },
  {
    title: 'Research',
    description: 'Gather context and understand the domain',
    icon: <BookIcon />,
    color: '#334155'
  },
  {
    title: 'Plan',
    description: 'Define requirements and priorities',
    icon: <ClipboardIcon />,
    color: '#475569'
  },
  {
    title: 'Model',
    description: 'Design architecture, types, tests, and patterns',
    icon: <BoxIcon />,
    color: '#64748b'
  },
  {
    title: 'Test & Complete',
    description: 'Validate against requirements and priorities',
    icon: <CheckCircleIcon />,
    color: '#334155'
  },
  {
    title: 'Deploy',
    description: 'Ship to production with confidence',
    icon: <RocketIcon />,
    color: '#1e293b'
  },
  {
    title: 'Monitor',
    description: 'Track performance and user behavior',
    icon: <ActivityIcon />,
    color: '#0f172a'
  },
  {
    title: 'Analyze',
    description: 'Learn and identify next priorities',
    icon: <MicroscopeIcon />,
    color: '#475569'
  }
];

export default function WorkflowDiagram(): React.ReactElement {
  const [rotation, setRotation] = useState(0);
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHoveringCenter, setIsHoveringCenter] = useState(false);
  const [isHoveringCarousel, setIsHoveringCarousel] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Rotation: happens when playing OR hovering
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Create new interval if should rotate
    if (isPlaying || isHoveringCarousel) {
      intervalRef.current = setInterval(() => {
        setRotation((prev) => prev - 45);
      }, 5000);
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, isHoveringCarousel]);

  const handleRotate = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleCardPress = (index: number) => {
    setActiveCard(index);
    setTimeout(() => setActiveCard(null), 200); // Quick press effect
  };

  return (
    <section className={styles.workflowSection}>
      <div className="container">
        <div className={styles.header}>
          <h2 className={styles.title}>A Structured Iterative Approach</h2>
          <p className={styles.subtitle}>Prioritizing what matters most</p>
        </div>

        <div
          className={styles.circularContainer}
          onMouseEnter={() => setIsHoveringCarousel(true)}
          onMouseLeave={() => setIsHoveringCarousel(false)}
        >
          <div
            className={styles.circleWrapper}
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {workflowStages.map((stage, index) => {
              const angle = (index * 45 - 90) * (Math.PI / 180);
              const radius = 280;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <div
                  key={stage.title}
                  className={`${styles.circleStage} ${activeCard === index ? styles.pressed : ''}`}
                  style={
                    {
                      transform: `translate(${x}px, ${y}px) rotate(${-rotation}deg)`,
                      '--stage-color': stage.color
                    } as React.CSSProperties
                  }
                  onClick={() => handleCardPress(index)}
                >
                  <div
                    className={styles.stageIcon}
                    style={{ color: stage.color }}
                  >
                    {stage.icon}
                  </div>
                  <h3 className={styles.stageTitle}>{stage.title}</h3>
                  <p className={styles.stageDescription}>{stage.description}</p>
                </div>
              );
            })}
          </div>

          {/* Center with Continuous Iteration and animated arrows */}
          <div className={styles.centerContent}>
            <svg
              className={styles.rotatingArrows}
              width="200"
              height="200"
              viewBox="0 0 200 200"
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#475569" />
                </marker>
              </defs>
              <path
                d="M 100,30 A 50,50 0 1,1 99.9,30"
                fill="none"
                stroke="#475569"
                strokeWidth="3"
                markerEnd="url(#arrowhead)"
                className={styles.arrow1}
              />
              <path
                d="M 100,50 A 30,30 0 1,0 100.1,50"
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
                className={styles.arrow2}
              />
            </svg>
            <button
              className={styles.centerButton}
              onClick={handleRotate}
              onMouseEnter={() => setIsHoveringCenter(true)}
              onMouseLeave={() => setIsHoveringCenter(false)}
              aria-label={isPlaying ? 'Pause workflow' : 'Play workflow'}
            >
              {isHoveringCenter ? (
                <div className={styles.playPauseIcon}>
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </div>
              ) : (
                <>
                  <span className={styles.centerText}>Continuous</span>
                  <span className={styles.centerText}>Iteration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
