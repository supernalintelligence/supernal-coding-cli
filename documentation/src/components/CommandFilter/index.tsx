import Link from '@docusaurus/Link';
import { useMemo, useState } from 'react';
import styles from './styles.module.css';

interface Command {
  name: string;
  description: string;
  category: string;
  usage?: string;
  examples?: string[];
  complexity?: 'basic' | 'intermediate' | 'advanced';
  frequency?: 'high' | 'medium' | 'low';
  tags?: string[];
}

interface CommandFilterProps {
  commands?: Command[];
}

const defaultCommands: Command[] = [
  {
    name: 'agent',
    description: 'Run AI agent tasks for development automation',
    category: 'Agent',
    complexity: 'intermediate',
    frequency: 'high',
    tags: ['ai', 'automation', 'development']
  },
  {
    name: 'kanban',
    description: 'Kanban board operations and task management',
    category: 'Kanban & Project Management',
    complexity: 'basic',
    frequency: 'high',
    tags: ['tasks', 'management', 'workflow']
  },
  {
    name: 'git-hooks',
    description: 'Install and manage git hooks for automation',
    category: 'Git Integration',
    complexity: 'intermediate',
    frequency: 'medium',
    tags: ['git', 'automation', 'hooks']
  },
  {
    name: 'validate',
    description: 'Validate project structure and requirements',
    category: 'Development',
    complexity: 'basic',
    frequency: 'high',
    tags: ['validation', 'testing', 'quality']
  },
  {
    name: 'docs',
    description: 'Generate and manage documentation',
    category: 'Documentation',
    complexity: 'basic',
    frequency: 'medium',
    tags: ['documentation', 'generation']
  },
  {
    name: 'deploy',
    description: 'Deploy applications and services',
    category: 'Deployment',
    complexity: 'advanced',
    frequency: 'low',
    tags: ['deployment', 'production', 'release']
  },
  {
    name: 'suggest',
    description: 'Get AI suggestions for development improvements',
    category: 'Agent',
    complexity: 'basic',
    frequency: 'medium',
    tags: ['ai', 'suggestions', 'improvements']
  },
  {
    name: 'priority',
    description: 'Set and manage task priorities',
    category: 'Kanban & Project Management',
    complexity: 'basic',
    frequency: 'medium',
    tags: ['priority', 'tasks', 'management']
  }
];

export default function CommandFilter({
  commands = defaultCommands
}: CommandFilterProps): JSX.Element {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedComplexity, setSelectedComplexity] = useState('all');
  const [selectedFrequency, setSelectedFrequency] = useState('all');
  const [sortBy, setSortBy] = useState<
    'name' | 'category' | 'frequency' | 'complexity'
  >('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = Array.from(
      new Set(commands.map((cmd) => cmd.category))
    ).sort();
    return ['all', ...cats];
  }, [commands]);

  // Filter and sort commands
  const filteredCommands = useMemo(() => {
    const filtered = commands.filter((cmd) => {
      const matchesSearch =
        cmd.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cmd.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cmd.tags?.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const matchesCategory =
        selectedCategory === 'all' || cmd.category === selectedCategory;
      const matchesComplexity =
        selectedComplexity === 'all' || cmd.complexity === selectedComplexity;
      const matchesFrequency =
        selectedFrequency === 'all' || cmd.frequency === selectedFrequency;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesComplexity &&
        matchesFrequency
      );
    });

    // Sort commands
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'category':
          return a.category.localeCompare(b.category);
        case 'frequency': {
          const freqOrder = { high: 3, medium: 2, low: 1 };
          return (
            (freqOrder[b.frequency || 'medium'] || 2) -
            (freqOrder[a.frequency || 'medium'] || 2)
          );
        }
        case 'complexity': {
          const complexOrder = { basic: 1, intermediate: 2, advanced: 3 };
          return (
            (complexOrder[a.complexity || 'basic'] || 1) -
            (complexOrder[b.complexity || 'basic'] || 1)
          );
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [
    commands,
    searchTerm,
    selectedCategory,
    selectedComplexity,
    selectedFrequency,
    sortBy
  ]);

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'basic':
        return styles.complexityBasic;
      case 'intermediate':
        return styles.complexityIntermediate;
      case 'advanced':
        return styles.complexityAdvanced;
      default:
        return styles.complexityBasic;
    }
  };

  const getFrequencyIcon = (frequency: string) => {
    switch (frequency) {
      case 'high':
        return '🔥';
      case 'medium':
        return '⚡';
      case 'low':
        return '💎';
      default:
        return '⚡';
    }
  };

  return (
    <div className={styles.commandFilter}>
      <div className={styles.filterHeader}>
        <h3>🔍 Interactive Command Explorer</h3>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            ⊞
          </button>
          <button
            className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            ☰
          </button>
        </div>
      </div>

      <div className={styles.searchSection}>
        <input
          type="text"
          placeholder="Search commands, descriptions, or tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <button
          className={styles.advancedToggle}
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          {showAdvancedFilters ? '🔼 Hide Filters' : '🔽 Advanced Filters'}
        </button>
      </div>

      {showAdvancedFilters && (
        <div className={styles.advancedFilters}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={styles.filterSelect}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Complexity</label>
              <select
                value={selectedComplexity}
                onChange={(e) => setSelectedComplexity(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Levels</option>
                <option value="basic">Basic</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Usage Frequency</label>
              <select
                value={selectedFrequency}
                onChange={(e) => setSelectedFrequency(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Frequencies</option>
                <option value="high">🔥 High Usage</option>
                <option value="medium">⚡ Medium Usage</option>
                <option value="low">💎 Specialized</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={styles.filterSelect}
              >
                <option value="name">Name (A-Z)</option>
                <option value="category">Category</option>
                <option value="frequency">Usage Frequency</option>
                <option value="complexity">Complexity</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className={styles.resultsHeader}>
        <span className={styles.resultCount}>
          {filteredCommands.length} of {commands.length} commands
        </span>
        <button
          className={styles.clearFilters}
          onClick={() => {
            setSearchTerm('');
            setSelectedCategory('all');
            setSelectedComplexity('all');
            setSelectedFrequency('all');
            setSortBy('name');
          }}
        >
          🗑️ Clear All Filters
        </button>
      </div>

      <div
        className={`${styles.commandGrid} ${viewMode === 'list' ? styles.listView : styles.gridView}`}
      >
        {filteredCommands.map((command) => (
          <div key={command.name} className={styles.commandCard}>
            <div className={styles.commandHeader}>
              <Link
                to={`./${command.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
                className={styles.commandName}
              >
                <code>{command.name}</code>
              </Link>
              <div className={styles.commandBadges}>
                <span
                  className={styles.frequencyBadge}
                  title={`${command.frequency} usage frequency`}
                >
                  {getFrequencyIcon(command.frequency || 'medium')}
                </span>
                <span
                  className={`${styles.complexityBadge} ${getComplexityColor(command.complexity || 'basic')}`}
                >
                  {command.complexity || 'basic'}
                </span>
              </div>
            </div>

            <div className={styles.commandDescription}>
              {command.description}
            </div>

            <div className={styles.commandFooter}>
              <span className={styles.commandCategory}>{command.category}</span>
              {command.tags && (
                <div className={styles.commandTags}>
                  {command.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className={styles.tag}>
                      #{tag}
                    </span>
                  ))}
                  {command.tags.length > 3 && (
                    <span className={styles.tagMore}>
                      +{command.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredCommands.length === 0 && (
        <div className={styles.noResults}>
          <div className={styles.noResultsIcon}>🔍</div>
          <h4>No commands found</h4>
          <p>
            Try adjusting your search terms or filters to find what you're
            looking for.
          </p>
        </div>
      )}
    </div>
  );
}
