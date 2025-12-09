/**
 * ConfigTracer - Track value resolution through merge chain
 * Part of REQ-REN-004: Config Display & Debug Commands
 */

class ConfigTracer {
  /**
   * Trace resolution chain for a value
   * @param {string} path - Dot-notation path (e.g., 'workflow.startPhase')
   * @param {Object} finalConfig - Final resolved config
   * @param {Array} mergeHistory - History of configs that were merged
   * @returns {ResolutionChain}
   */
  trace(path, finalConfig, mergeHistory = []) {
    const finalValue = this._getNestedValue(finalConfig, path);
    const chain = [];

    // Build chain from merge history
    for (const entry of mergeHistory) {
      const value = this._getNestedValue(entry.config, path);
      if (value !== undefined) {
        chain.push({
          source: entry.source || 'unknown',
          line: entry.line || 0,
          value,
          isFinal: false
        });
      }
    }

    // Mark last as final
    if (chain.length > 0) {
      chain[chain.length - 1].isFinal = true;
    } else {
      // No history, value came from final config
      chain.push({
        source: 'final',
        line: 0,
        value: finalValue,
        isFinal: true
      });
    }

    return {
      path,
      finalValue,
      chain
    };
  }

  /**
   * Get nested value from object using dot notation
   * @private
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      // Handle array access
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, prop, index] = arrayMatch;
        return current?.[prop]?.[parseInt(index, 10)];
      }
      return current?.[key];
    }, obj);
  }
}

module.exports = ConfigTracer;
