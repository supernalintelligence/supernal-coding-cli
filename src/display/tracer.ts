/**
 * ConfigTracer - Track value resolution through merge chain
 * Part of REQ-REN-004: Config Display & Debug Commands
 */

interface MergeHistoryEntry {
  config: Record<string, unknown>;
  source?: string;
  line?: number;
}

interface ChainEntry {
  source: string;
  line: number;
  value: unknown;
  isFinal: boolean;
}

interface ResolutionChain {
  path: string;
  finalValue: unknown;
  chain: ChainEntry[];
}

class ConfigTracer {
  trace(path: string, finalConfig: Record<string, unknown>, mergeHistory: MergeHistoryEntry[] = []): ResolutionChain {
    const finalValue = this._getNestedValue(finalConfig, path);
    const chain: ChainEntry[] = [];

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

    if (chain.length > 0) {
      chain[chain.length - 1].isFinal = true;
    } else {
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

  private _getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current === null || current === undefined) return undefined;
      
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, prop, index] = arrayMatch;
        const currentObj = current as Record<string, unknown[]>;
        return currentObj?.[prop]?.[parseInt(index, 10)];
      }
      return (current as Record<string, unknown>)?.[key];
    }, obj);
  }
}

export default ConfigTracer;
module.exports = ConfigTracer;
