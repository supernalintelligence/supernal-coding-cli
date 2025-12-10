/**
 * ConfigMerger - Deep merge configurations with override strategy
 *
 * Responsibilities:
 * - Deep merge nested objects
 * - Handle array merge strategies (append vs replace)
 * - Last-wins for scalar values
 */

export type MergeStrategy = 'deep' | 'shallow';

class ConfigMerger {
  protected strategy: MergeStrategy;

  constructor(strategy: MergeStrategy = 'deep') {
    this.strategy = strategy;
  }

  /**
   * Merge configs in order (first to last)
   */
  merge<T extends Record<string, unknown>>(configs: T[]): T {
    return configs.reduce((merged, config) => {
      return this.deepMerge(merged, config) as T;
    }, {} as T);
  }

  /**
   * Deep merge two objects
   */
  deepMerge<T extends Record<string, unknown>>(target: T, source: T): T {
    const result = { ...target } as Record<string, unknown>;

    for (const [key, value] of Object.entries(source)) {
      if (this.isPlainObject(value) && this.isPlainObject(result[key])) {
        result[key] = this.deepMerge(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>
        );
      } else if (Array.isArray(value) && Array.isArray(result[key])) {
        result[key] = this.mergeArrays(result[key] as unknown[], value);
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }

  /**
   * Merge arrays based on strategy
   */
  mergeArrays<T>(target: T[], source: T[]): T[] {
    if (source.length > 0 && source[0] === '__replace__') {
      return source.slice(1);
    }
    return [...target, ...source];
  }

  /**
   * Check if value is a plain object
   */
  isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}

export default ConfigMerger;
module.exports = ConfigMerger;
