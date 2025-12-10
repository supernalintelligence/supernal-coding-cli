/**
 * FormatHelper - Format conversion and section extraction
 * Part of REQ-REN-004: Config Display & Debug Commands
 */

import yaml from 'yaml';

interface YAMLOptions {
  indent?: number;
  lineWidth?: number;
  [key: string]: unknown;
}

interface JSONOptions {
  indent?: number;
}

class FormatHelper {
  static extractSection(obj: Record<string, unknown>, path: string): unknown {
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

  static toYAML(obj: unknown, options: YAMLOptions = {}): string {
    return yaml.stringify(obj, {
      indent: 2,
      lineWidth: 80,
      ...options
    });
  }

  static toJSON(obj: unknown, options: JSONOptions = {}): string {
    const indent = options.indent || 2;
    return JSON.stringify(obj, null, indent);
  }
}

export default FormatHelper;
module.exports = FormatHelper;
