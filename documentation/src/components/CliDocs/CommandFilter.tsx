import React, { useState } from 'react';
import styles from './CommandFilter.module.css';

interface Command {
  name: string;
  category: string;
  description: string;
  complexity?: 'low' | 'medium' | 'high';
  status?: string;
}

interface CommandFilterProps {
  commands: Command[];
  onFilteredCommandsChange: (filteredCommands: Command[]) => void;
}

export default function CommandFilter({
  commands,
  onFilteredCommandsChange
}: CommandFilterProps) {
  const [filters, setFilters] = useState({
    category: 'all',
    complexity: 'all',
    search: ''
  });

  // Get unique categories
  const categories = [
    'all',
    ...Array.from(new Set(commands.map((cmd) => cmd.category)))
  ];
  const complexities = ['all', 'low', 'medium', 'high'];

  React.useEffect(() => {
    let filtered = commands;

    // Filter by category
    if (filters.category !== 'all') {
      filtered = filtered.filter((cmd) => cmd.category === filters.category);
    }

    // Filter by complexity
    if (filters.complexity !== 'all') {
      filtered = filtered.filter(
        (cmd) => cmd.complexity === filters.complexity
      );
    }

    // Filter by search term
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(searchTerm) ||
          cmd.description.toLowerCase().includes(searchTerm)
      );
    }

    onFilteredCommandsChange(filtered);
  }, [filters, commands, onFilteredCommandsChange]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className={styles.filterContainer}>
      <div className={styles.filterGroup}>
        <label htmlFor="search-input">🔍 Search Commands:</label>
        <input
          id="search-input"
          type="text"
          placeholder="Search by command name or description..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.filterGroup}>
        <label htmlFor="category-filter">📂 Category:</label>
        <select
          id="category-filter"
          value={filters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
          className={styles.filterSelect}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category === 'all'
                ? 'All Categories'
                : category.charAt(0).toUpperCase() + category.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.filterGroup}>
        <label htmlFor="complexity-filter">⚡ Complexity:</label>
        <select
          id="complexity-filter"
          value={filters.complexity}
          onChange={(e) => handleFilterChange('complexity', e.target.value)}
          className={styles.filterSelect}
        >
          {complexities.map((complexity) => (
            <option key={complexity} value={complexity}>
              {complexity === 'all'
                ? 'All Levels'
                : complexity.charAt(0).toUpperCase() + complexity.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.resultsCount}>
        📊 Showing {commands.length} command{commands.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
