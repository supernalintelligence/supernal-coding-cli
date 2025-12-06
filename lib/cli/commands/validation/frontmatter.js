#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('yaml');
const chalk = require('chalk');
const { getConfig } = require('../../../scripts/config-loader');

// Required frontmatter fields for requirements
const REQUIRED_FIELDS = {
  id: 'string',
  title: 'string',
  epic: 'string',
  category: 'string',
  hierarchy: 'string',
  priority: 'string',
  status: 'string',
  dependencies: 'array',
  assignee: 'string',
  version: 'string',
  tags: 'array',
  created: 'string',
  updated: 'string',
  reviewedBy: 'string',
  approvedBy: 'string',
  riskLevel: 'string',
  complianceStandards: 'array',
  priorityScore: 'number'
};

// Valid values for enum fields
const VALID_VALUES = {
  priority: ['Critical', 'High', 'Medium', 'Low', 'Deferred'],
  status: [
    'Draft',
    'In Review',
    'Approved',
    'In Progress',
    'Implemented',
    'Completed',
    'Blocked',
    'Cancelled'
  ],
  category: ['core', 'workflow', 'testing', 'integration', 'infrastructure'],
  hierarchy: ['system-level', 'feature-level', 'component-level', 'unit-level'],
  riskLevel: ['Critical', 'High', 'Medium', 'Low']
};

// Parse YAML frontmatter from markdown files
function parseFrontmatter(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  try {
    return yaml.parse(fmMatch[1]) || {};
  } catch (error) {
    console.warn('Failed to parse YAML frontmatter:', error.message);
    return null;
  }
}

// Check for common YAML syntax issues in raw frontmatter
function checkYAMLSyntax(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];

  const issues = [];
  const lines = fmMatch[1].split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    // Check for unquoted values containing colons
    // Match: key: value with colon, but NOT key: "value" or key: 'value'
    const colonMatch = line.match(/^(\s*)(\w+):\s+([^"'\n][^#\n]*:[^#\n]*)/);
    if (colonMatch) {
      const [, indent, key, value] = colonMatch;
      const trimmedValue = value.trim();
      // Value contains colon but isn't quoted (check it doesn't start with quote)
      if (
        trimmedValue &&
        !trimmedValue.startsWith('"') &&
        !trimmedValue.startsWith("'")
      ) {
        // Also check it doesn't end with a quote (in case of trailing spaces)
        const cleanValue = trimmedValue.replace(/\s+$/, '');
        if (!cleanValue.endsWith('"') && !cleanValue.endsWith("'")) {
          issues.push({
            line: index + 1,
            message: `Field '${key}' has unquoted value containing colon: "${cleanValue}". Should be quoted: '${key}: "${cleanValue}"'`,
            severity: 'error',
            autofix: `${indent}${key}: "${cleanValue}"`
          });
        }
      }
    }

    // Check for unquoted values with other special characters
    const specialCharsMatch = line.match(
      /^(\s*)(\w+):\s+([^"'\n-][^#\n]*[#@[\]{}|>*&!%])/
    );
    if (specialCharsMatch) {
      const [, indent, key, value] = specialCharsMatch;
      const trimmedValue = value.trim();
      if (
        trimmedValue &&
        !trimmedValue.startsWith('"') &&
        !trimmedValue.startsWith("'")
      ) {
        const cleanValue = trimmedValue.replace(/\s+$/, '');
        if (!cleanValue.endsWith('"') && !cleanValue.endsWith("'")) {
          issues.push({
            line: index + 1,
            message: `Field '${key}' contains special YAML characters and should be quoted: "${cleanValue}"`,
            severity: 'warning',
            autofix: `${indent}${key}: "${cleanValue}"`
          });
        }
      }
    }
  });

  return issues;
}

// Validate a single requirement file
function validateRequirementFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // First, check for YAML syntax issues
    const syntaxIssues = checkYAMLSyntax(content);
    if (syntaxIssues.length > 0) {
      const errors = syntaxIssues
        .filter((issue) => issue.severity === 'error')
        .map((issue) => `Line ${issue.line}: ${issue.message}`);
      const warnings = syntaxIssues
        .filter((issue) => issue.severity === 'warning')
        .map((issue) => `Line ${issue.line}: ${issue.message}`);

      // If there are syntax errors that prevent parsing, return early
      if (errors.length > 0) {
        return {
          file: filePath,
          valid: false,
          errors,
          warnings,
          syntaxIssues
        };
      }
    }

    const frontmatter = parseFrontmatter(content);

    if (!frontmatter) {
      return {
        file: filePath,
        valid: false,
        errors: ['No valid YAML frontmatter found'],
        warnings: []
      };
    }

    const errors = [];
    const warnings = [];

    // Check required fields
    for (const [field, expectedType] of Object.entries(REQUIRED_FIELDS)) {
      if (!(field in frontmatter)) {
        errors.push(`Missing required field: ${field}`);
      } else {
        // Type validation
        const value = frontmatter[field];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (actualType !== expectedType) {
          errors.push(
            `Field ${field}: expected ${expectedType}, got ${actualType}`
          );
        }
      }
    }

    // Validate enum values
    for (const [field, validValues] of Object.entries(VALID_VALUES)) {
      if (frontmatter[field] && !validValues.includes(frontmatter[field])) {
        errors.push(
          `Field ${field}: invalid value "${frontmatter[field]}". Valid values: ${validValues.join(', ')}`
        );
      }
    }

    // Additional validations
    if (frontmatter.id && !frontmatter.id.match(/^REQ-\d+$/)) {
      errors.push('ID must be in format REQ-XXX');
    }

    if (frontmatter.dependencies && !Array.isArray(frontmatter.dependencies)) {
      errors.push('Dependencies must be an array');
    }

    if (frontmatter.tags && !Array.isArray(frontmatter.tags)) {
      errors.push('Tags must be an array');
    }

    // Date format validation
    const dateFields = ['created', 'updated'];
    for (const field of dateFields) {
      if (
        frontmatter[field] &&
        !frontmatter[field].match(/^\d{4}-\d{2}-\d{2}$/)
      ) {
        warnings.push(`Field ${field}: date should be in YYYY-MM-DD format`);
      }
    }

    // Priority score validation
    if (
      frontmatter.priorityScore &&
      (frontmatter.priorityScore < 1 || frontmatter.priorityScore > 15)
    ) {
      warnings.push('Priority score should be between 1 and 15');
    }

    return {
      file: filePath,
      valid: errors.length === 0,
      errors,
      warnings,
      frontmatter,
      syntaxIssues: syntaxIssues.length > 0 ? syntaxIssues : undefined
    };
  } catch (error) {
    return {
      file: filePath,
      valid: false,
      errors: [`File read error: ${error.message}`],
      warnings: []
    };
  }
}

// Generate default frontmatter for a requirement
function generateDefaultFrontmatter(filePath) {
  const fileName = path.basename(filePath, '.md');
  const idMatch = fileName.match(/req-(\d+)/i);
  const id = idMatch ? `REQ-${idMatch[1].padStart(3, '0')}` : 'REQ-XXX';

  const category = path.dirname(filePath).split(path.sep).pop();

  return {
    id,
    title: 'Untitled Requirement',
    epic: 'Uncategorized',
    category,
    hierarchy: 'component-level',
    priority: 'Medium',
    status: 'Draft',
    dependencies: [],
    assignee: '',
    version: '1.0.0',
    tags: [],
    created: new Date().toISOString().split('T')[0],
    updated: new Date().toISOString().split('T')[0],
    reviewedBy: '',
    approvedBy: '',
    riskLevel: 'Medium',
    complianceStandards: [],
    priorityScore: 5
  };
}

// Fix frontmatter in a requirement file
function fixRequirementFile(filePath, dryRun = false) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let fixedContent = content;
    const fixedIssues = [];

    // First, fix YAML syntax issues
    const syntaxIssues = checkYAMLSyntax(content);
    if (syntaxIssues.length > 0) {
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const frontmatterLines = fmMatch[1].split('\n');

        // Apply autofixes from syntax checker
        syntaxIssues.forEach((issue) => {
          if (issue.autofix) {
            const lineIndex = issue.line - 1;
            if (frontmatterLines[lineIndex]) {
              frontmatterLines[lineIndex] = issue.autofix;
              fixedIssues.push(
                `Fixed line ${issue.line}: ${issue.message.split(':')[0]}`
              );
            }
          }
        });

        const newFrontmatterBlock = frontmatterLines.join('\n');
        fixedContent = content.replace(
          /^---\n[\s\S]*?\n---/,
          `---\n${newFrontmatterBlock}\n---`
        );
      }
    }

    const validation = validateRequirementFile(filePath);

    // If only syntax issues were found and fixed, save and return
    if (syntaxIssues.length > 0 && fixedIssues.length > 0) {
      if (!dryRun) {
        fs.writeFileSync(filePath, fixedContent);
      }
      return {
        file: filePath,
        fixed: true,
        message: dryRun
          ? 'Would fix YAML syntax issues'
          : 'Fixed YAML syntax issues',
        changes: fixedIssues
      };
    }

    if (validation.valid) {
      return {
        file: filePath,
        fixed: false,
        message: 'File is already valid'
      };
    }

    const frontmatter = parseFrontmatter(fixedContent);
    const defaultFrontmatter = generateDefaultFrontmatter(filePath);

    // Merge existing frontmatter with defaults
    const fixedFrontmatter = { ...defaultFrontmatter, ...frontmatter };

    // Ensure required fields are present
    for (const [field, expectedType] of Object.entries(REQUIRED_FIELDS)) {
      if (!(field in fixedFrontmatter)) {
        if (expectedType === 'array') {
          fixedFrontmatter[field] = [];
        } else if (expectedType === 'string') {
          fixedFrontmatter[field] = '';
        } else if (expectedType === 'number') {
          fixedFrontmatter[field] = 5;
        }
      }
    }

    // Fix enum values
    for (const [field, validValues] of Object.entries(VALID_VALUES)) {
      if (
        fixedFrontmatter[field] &&
        !validValues.includes(fixedFrontmatter[field])
      ) {
        fixedFrontmatter[field] = validValues[0]; // Use first valid value as default
      }
    }

    // Fix ID format
    if (fixedFrontmatter.id && !fixedFrontmatter.id.match(/^REQ-\d+$/)) {
      const idMatch = path.basename(filePath, '.md').match(/req-(\d+)/i);
      if (idMatch) {
        fixedFrontmatter.id = `REQ-${idMatch[1].padStart(3, '0')}`;
      }
    }

    // Ensure arrays are actually arrays
    if (!Array.isArray(fixedFrontmatter.dependencies)) {
      fixedFrontmatter.dependencies = [];
    }
    if (!Array.isArray(fixedFrontmatter.tags)) {
      fixedFrontmatter.tags = [];
    }
    if (!Array.isArray(fixedFrontmatter.complianceStandards)) {
      fixedFrontmatter.complianceStandards = [];
    }

    if (!dryRun) {
      // Generate new content with fixed frontmatter
      const newFrontmatter = yaml.stringify(fixedFrontmatter);
      const bodyContent = fixedContent.replace(/^---\n[\s\S]*?\n---\n/, '');
      const newContent = `---\n${newFrontmatter}---\n\n${bodyContent}`;

      fs.writeFileSync(filePath, newContent);
    }

    const changes = [
      ...fixedIssues,
      ...Object.keys(fixedFrontmatter).filter(
        (key) => !frontmatter || frontmatter[key] !== fixedFrontmatter[key]
      )
    ];

    return {
      file: filePath,
      fixed: true,
      message: dryRun ? 'Would fix frontmatter' : 'Fixed frontmatter',
      changes
    };
  } catch (error) {
    return {
      file: filePath,
      fixed: false,
      message: `Error fixing file: ${error.message}`
    };
  }
}

// Load all requirement files
function loadAllRequirementFiles() {
  const config = getConfig();
  config.load();
  const requirementsDir = path.join(
    process.cwd(),
    config.getRequirementsDirectory()
  );
  const categories = [
    'core',
    'workflow',
    'testing',
    'integration',
    'infrastructure'
  ];
  const files = [];

  for (const category of categories) {
    const categoryDir = path.join(requirementsDir, category);
    if (!fs.existsSync(categoryDir)) continue;

    const categoryFiles = fs
      .readdirSync(categoryDir)
      .filter((f) => f.startsWith('req-') && f.endsWith('.md'))
      .map((f) => path.join(categoryDir, f));

    files.push(...categoryFiles);
  }

  return files;
}

// Validate all requirement files
function validateAllRequirements() {
  console.log(chalk.blue('🔍 Validating all requirement frontmatter...\n'));

  const files = loadAllRequirementFiles();
  const results = files.map(validateRequirementFile);

  const valid = results.filter((r) => r.valid);
  const invalid = results.filter((r) => !r.valid);

  console.log(chalk.green(`✅ ${valid.length} files have valid frontmatter`));
  console.log(chalk.red(`❌ ${invalid.length} files have issues`));

  if (invalid.length > 0) {
    console.log(`\n${chalk.yellow('Issues found:')}`);
    for (const result of invalid) {
      console.log(chalk.red(`\n📄 ${path.basename(result.file)}:`));
      for (const error of result.errors) {
        console.log(`  ❌ ${error}`);
      }
      for (const warning of result.warnings) {
        console.log(`  ⚠️  ${warning}`);
      }
    }
  }

  return { valid, invalid, total: files.length };
}

// Fix all requirement files
function fixAllRequirements(dryRun = false) {
  console.log(
    chalk.blue(
      `🔧 ${dryRun ? 'Checking' : 'Fixing'} all requirement frontmatter...\n`
    )
  );

  const files = loadAllRequirementFiles();
  const results = files.map((file) => fixRequirementFile(file, dryRun));

  const fixed = results.filter((r) => r.fixed);
  const unchanged = results.filter((r) => !r.fixed);

  console.log(
    chalk.green(
      `✅ ${fixed.length} files ${dryRun ? 'would be fixed' : 'were fixed'}`
    )
  );
  console.log(chalk.gray(`⚪ ${unchanged.length} files are already valid`));

  if (fixed.length > 0) {
    console.log(`\n${chalk.yellow(`${dryRun ? 'Would fix' : 'Fixed'}:`)}`);
    for (const result of fixed) {
      console.log(chalk.green(`\n📄 ${path.basename(result.file)}:`));
      console.log(`  ${result.message}`);
      if (result.changes && result.changes.length > 0) {
        console.log(`  Changes: ${result.changes.join(', ')}`);
      }
    }
  }

  return { fixed, unchanged, total: files.length };
}

// Show frontmatter schema
function showSchema() {
  console.log(chalk.blue('📋 Requirement Frontmatter Schema\n'));

  console.log(chalk.bold('Required Fields:'));
  for (const [field, type] of Object.entries(REQUIRED_FIELDS)) {
    console.log(`  ${field}: ${type}`);
  }

  console.log(chalk.bold('\nValid Values:'));
  for (const [field, values] of Object.entries(VALID_VALUES)) {
    console.log(`  ${field}: ${values.join(' | ')}`);
  }

  console.log(chalk.bold('\nField Descriptions:'));
  const descriptions = {
    id: 'Unique identifier in format REQ-XXX',
    title: 'Human-readable title',
    epic: 'Epic this requirement belongs to',
    category: 'Requirement category',
    hierarchy: 'Hierarchy level',
    priority: 'Priority level',
    status: 'Current status',
    dependencies: 'Array of requirement IDs this depends on',
    assignee: 'Person assigned to this requirement',
    version: 'Version number',
    tags: 'Array of tags for categorization',
    created: 'Creation date (YYYY-MM-DD)',
    updated: 'Last update date (YYYY-MM-DD)',
    reviewedBy: 'Person who reviewed this',
    approvedBy: 'Person who approved this',
    riskLevel: 'Risk assessment level',
    complianceStandards: 'Array of compliance standards',
    priorityScore: 'Numeric priority score (1-15)'
  };

  for (const [field, description] of Object.entries(descriptions)) {
    console.log(`  ${field}: ${description}`);
  }
}

async function main(action) {
  const command = action || process.argv[2];

  switch (command) {
    case 'validate':
      validateAllRequirements();
      break;

    case 'fix':
      fixAllRequirements(false);
      break;

    case 'check':
      fixAllRequirements(true);
      break;

    case 'schema':
      showSchema();
      break;

    default:
      console.log(chalk.blue('🔍 Frontmatter Validation System'));
      console.log(`Usage: ${chalk.cyan('sc frontmatter <command>')}`);
      console.log('');
      console.log('Available Commands:');
      console.log(
        `  ${chalk.green('validate')}  Validate all requirement frontmatter`
      );
      console.log(
        `  ${chalk.green('check')}     Check what would be fixed (dry run)`
      );
      console.log(`  ${chalk.green('fix')}       Fix all frontmatter issues`);
      console.log(`  ${chalk.green('schema')}    Show frontmatter schema`);
  }
}

// Export for use in other modules
module.exports = {
  validateRequirementFile,
  fixRequirementFile,
  validateAllRequirements,
  fixAllRequirements,
  showSchema,
  checkYAMLSyntax,
  REQUIRED_FIELDS,
  VALID_VALUES
};

// Run if called directly
if (require.main === module) {
  main();
}
