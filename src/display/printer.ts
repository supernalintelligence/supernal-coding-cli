/**
 * ConfigPrinter - Pretty-print configs with optional colors
 * Part of REQ-REN-004: Config Display & Debug Commands
 */

import yaml from 'yaml';

interface PrinterOptions {
  color?: boolean;
}

class ConfigPrinter {
  protected color: boolean;

  constructor(options: PrinterOptions = {}) {
    this.color = options.color !== false;
  }

  print(config: Record<string, unknown>, format: 'yaml' | 'json' = 'yaml'): string {
    let output: string;

    if (format === 'json') {
      output = JSON.stringify(config, null, 2);
    } else {
      output = yaml.stringify(config, {
        indent: 2,
        lineWidth: 80,
        minContentWidth: 0
      });
    }

    if (this.color && format === 'yaml') {
      output = this._colorizeYAML(output);
    }

    return output;
  }

  private _colorizeYAML(yamlString: string): string {
    return yamlString;
  }
}

export default ConfigPrinter;
module.exports = ConfigPrinter;
