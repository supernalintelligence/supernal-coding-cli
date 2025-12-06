#!/usr/bin/env node

/**
 * Unified Template Validator
 *
 * Consolidates all validation logic into a single system that reads .template.md files
 * as the source of truth for:
 * - Frontmatter requirements
 * - Section structure
 * - Naming patterns
 * - Template hint detection
 *
 * Replaces: naming-validator, schema-validator, doc-validator, template-validator,
 * and portions of ValidationManager
 */

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const matter = require('gray-matter');

// Import YAML syntax checker
const { checkYAMLSyntax } = require('../cli/commands/validation/frontmatter');

class TemplateValidator {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;
  }

  /**
   * Find applicable .template.md file for a document
   * Searches: current dir → parent dir (one level only)
   * Falls back to centralized templates/ directory
   */
  findTemplate(filePath) {
    let dir = path.dirname(filePath);

    // Check current directory
    let templatePath = path.join(dir, '.template.md');
    if (fs.existsSync(templatePath)) {
      if (this.verbose) {
        console.log(chalk.gray(`Using template: ${templatePath}`));
      }
      return templatePath;
    }

    // Check parent directory (one level up only)
    dir = path.dirname(dir);
    templatePath = path.join(dir, '.template.md');
    if (fs.existsSync(templatePath)) {
      if (this.verbose) {
        console.log(chalk.gray(`Using parent template: ${templatePath}`));
      }
      return templatePath;
    }

    // Try to infer from path and check centralized templates
    const relativePath = path.relative(this.projectRoot, filePath);

    // Map common paths to centralized templates
    const pathMappings = [
      {
        pattern: /^docs\/planning/,
        template: 'templates/planning/documentation/.template.md',
      },
      {
        pattern: /^requirements/,
        template: 'templates/requirements/.template.md',
      },
      { pattern: /^evidence/, template: 'templates/evidence/.template.md' },
      { pattern: /^docs\/epics/, template: 'templates/epics/.template.md' },
      // SOPs
      {
        pattern: /^docs\/workflow\/sops/,
        template: 'templates/docs/sops/.template.md',
      },
      // Architecture document templates
      {
        pattern: /^docs\/architecture\/system/,
        template: 'templates/docs/architecture/system.template.md',
      },
      {
        pattern: /^docs\/architecture\/components/,
        template: 'templates/docs/architecture/component.template.md',
      },
      {
        pattern: /^docs\/architecture\/decisions/,
        template: 'templates/docs/architecture/decision.template.md',
      },
      {
        pattern: /^docs\/architecture\/patterns/,
        template: 'templates/docs/architecture/pattern.template.md',
      },
    ];

    for (const mapping of pathMappings) {
      if (mapping.pattern.test(relativePath)) {
        const centralizedPath = path.join(this.projectRoot, mapping.template);
        if (fs.existsSync(centralizedPath)) {
          if (this.verbose) {
            console.log(
              chalk.gray(`Using centralized template: ${centralizedPath}`)
            );
          }
          return centralizedPath;
        }
      }
    }

    return null;
  }

  /**
   * Parse a .template.md file and extract validation rules
   * Returns: { namingPattern, requiredFields, requiredSections, templateHints }
   */
  parseTemplate(templatePath) {
    try {
      const { data: frontmatter, content: body } = matter.read(templatePath);

      return {
        namingPattern: frontmatter._naming_pattern || null,
        templateOrigin: frontmatter._template_origin || templatePath,
        requiredFields: Object.keys(frontmatter).filter(
          (k) => !k.startsWith('_')
        ),
        requiredSections: this.extractSections(body),
        templateHints: this.extractHints(body),
      };
    } catch (error) {
      if (this.verbose) {
        console.warn(
          chalk.yellow(
            `Warning: Could not parse template ${templatePath}: ${error.message}`
          )
        );
      }
      return null;
    }
  }

  /**
   * Extract section headings from markdown content
   */
  extractSections(content) {
    const matches = content.match(/^## (.+)$/gm) || [];
    return matches.map((m) => m.replace('## ', '').trim());
  }

  /**
   * Extract template hints/placeholders from markdown
   */
  extractHints(_content) {
    const hints = [
      '[Title]',
      '[Description]',
      'TODO:',
      'FIXME:',
      'XXX',
      /\{\{.*?\}\}/, // Handlebars
      /\[.*?\](?!\()/, // Brackets not followed by ( - avoid markdown links
    ];

    return hints;
  }

  /**
   * Validate filename against template naming pattern
   */
  validateFilename(filePath) {
    const filename = path.basename(filePath);

    // Skip non-markdown files
    if (!filename.endsWith('.md')) {
      return { valid: true };
    }

    // Skip special files
    if (
      ['README.md', '.template.md', 'CHANGELOG.md', 'LICENSE.md'].includes(
        filename
      )
    ) {
      return { valid: true };
    }

    const templatePath = this.findTemplate(filePath);
    if (!templatePath) {
      return { valid: true, message: 'No template found' };
    }

    const templateRules = this.parseTemplate(templatePath);
    if (!templateRules || !templateRules.namingPattern) {
      return { valid: true, message: 'No naming pattern in template' };
    }

    const pattern = new RegExp(templateRules.namingPattern);

    if (!pattern.test(filename)) {
      return {
        valid: false,
        severity: 'error',
        message: `Filename doesn't match pattern: ${templateRules.namingPattern}`,
        actual: filename,
        expected: templateRules.namingPattern,
        template: templatePath,
      };
    }

    return { valid: true };
  }

  /**
   * Validate document structure against template
   */
  async validateStructure(filePath) {
    const templatePath = this.findTemplate(filePath);
    if (!templatePath) {
      return {
        valid: true,
        message: 'No template found - skipping validation',
        warnings: [],
      };
    }

    const templateRules = this.parseTemplate(templatePath);
    if (!templateRules) {
      return {
        valid: true,
        message: 'Could not parse template',
        warnings: [],
      };
    }

    // First check YAML syntax before attempting to parse
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const syntaxIssues = checkYAMLSyntax(rawContent);

    if (syntaxIssues.length > 0) {
      const syntaxErrors = syntaxIssues
        .filter((issue) => issue.severity === 'error')
        .map((issue) => ({
          type: 'yaml_syntax_error',
          line: issue.line,
          message: issue.message,
        }));

      const syntaxWarnings = syntaxIssues
        .filter((issue) => issue.severity === 'warning')
        .map((issue) => ({
          type: 'yaml_syntax_warning',
          line: issue.line,
          message: issue.message,
        }));

      if (syntaxErrors.length > 0) {
        return {
          valid: false,
          errors: syntaxErrors,
          warnings: syntaxWarnings,
        };
      }
    }

    // Parse document
    let document;
    try {
      document = matter.read(filePath);
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to parse document: ${error.message}`],
        warnings: [],
      };
    }

    // Check for validation bypass markers BEFORE checking frontmatter
    // This allows HTML comments to bypass even when frontmatter is missing
    const bypassMarkers = this.checkBypassMarkers(
      document.data,
      document.content
    );
    if (bypassMarkers.skipAll) {
      return {
        valid: true,
        message: 'Validation bypassed (skip_validation: true)',
        warnings: [],
        bypassed: { skipAll: true },
      };
    }

    // Check if document has frontmatter at all (empty object if missing)
    const hasFrontmatter =
      document.data && Object.keys(document.data).length > 0;

    if (!hasFrontmatter) {
      // No frontmatter present - this is an error UNLESS bypassed
      if (!bypassMarkers.skipFrontmatter) {
        return {
          valid: false,
          errors: [
            {
              type: 'missing_frontmatter_block',
              message:
                'Document is missing frontmatter block entirely (expected --- at top of file)',
            },
          ],
          warnings: [],
        };
      } else {
        // Frontmatter validation bypassed, but still need to check sections if not also bypassed
        if (bypassMarkers.skipSections) {
          return {
            valid: true,
            message: 'Validation bypassed (frontmatter and sections)',
            bypassed: bypassMarkers,
            warnings: [],
          };
        }
        // Continue to section validation below with empty frontmatter
        document.data = {}; // Ensure data exists as empty object
      }
    }

    const errors = [];
    const warnings = [];

    // Validate frontmatter: all template keys (except _*) are required
    if (!bypassMarkers.skipFrontmatter && hasFrontmatter) {
      for (const key of templateRules.requiredFields) {
        if (!(key in document.data)) {
          errors.push({
            type: 'missing_frontmatter',
            field: key,
            message: `Missing required frontmatter field: ${key}`,
          });
        }
      }
    }

    // Validate sections: all template headings are required
    if (!bypassMarkers.skipSections) {
      const documentSections = this.extractSections(document.content);

      for (const section of templateRules.requiredSections) {
        if (!documentSections.includes(section)) {
          errors.push({
            type: 'missing_section',
            section,
            message: `Missing required section: ## ${section}`,
          });
        }
      }
    }

    // Validate filename/ID/title consistency
    if (!bypassMarkers.skipConsistency) {
      const consistencyErrors = this.validateConsistency(
        filePath,
        document.data,
        document.content
      );
      errors.push(...consistencyErrors);
    }

    // Check for leftover template hints
    const fileContent = document.content;
    const hints = [
      '[Title]',
      '[Description]',
      'TODO:',
      'FIXME:',
      'XXX',
      'REQ-XXX',
    ];

    for (const hint of hints) {
      if (fileContent.includes(hint)) {
        warnings.push({
          type: 'template_hint',
          hint,
          message: `Leftover template hint detected: "${hint}"`,
        });
      }
    }

    // Check for handlebars placeholders
    const handlebarsMatches = fileContent.match(/\{\{.*?\}\}/g) || [];
    if (handlebarsMatches.length > 0) {
      warnings.push({
        type: 'template_hint',
        hint: handlebarsMatches[0],
        message: `Handlebars placeholder found: ${handlebarsMatches[0]}`,
        count: handlebarsMatches.length,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      template: templatePath,
      bypassed: bypassMarkers,
    };
  }

  /**
   * Check for validation bypass markers in content only (when frontmatter is missing)
   */
  checkContentBypassMarkers(content) {
    const markers = {
      skipAll: false,
      skipFrontmatter: false,
      skipSections: false,
      skipConsistency: false,
    };

    // Check content markers (HTML comments)
    if (content.includes('<!-- skip-validation -->')) {
      markers.skipAll = true;
    }
    if (content.includes('<!-- skip-frontmatter -->'))
      markers.skipFrontmatter = true;
    if (content.includes('<!-- skip-sections -->')) markers.skipSections = true;
    if (content.includes('<!-- skip-consistency -->'))
      markers.skipConsistency = true;

    return markers;
  }

  /**
   * Check for validation bypass markers
   */
  checkBypassMarkers(frontmatter, content) {
    const markers = {
      skipAll: false,
      skipFrontmatter: false,
      skipSections: false,
      skipConsistency: false,
    };

    // Check frontmatter markers
    if (
      frontmatter.skip_validation === true ||
      frontmatter.skip_validation === 'true'
    ) {
      markers.skipAll = true;
      return markers;
    }

    if (frontmatter.skip_frontmatter_validation) markers.skipFrontmatter = true;
    if (frontmatter.skip_section_validation) markers.skipSections = true;
    if (frontmatter.skip_consistency_validation) markers.skipConsistency = true;

    // Check content markers (HTML comments)
    if (content.includes('<!-- skip-validation -->')) {
      markers.skipAll = true;
    }
    if (content.includes('<!-- skip-frontmatter -->'))
      markers.skipFrontmatter = true;
    if (content.includes('<!-- skip-sections -->')) markers.skipSections = true;
    if (content.includes('<!-- skip-consistency -->'))
      markers.skipConsistency = true;

    return markers;
  }

  /**
   * Validate consistency between filename, frontmatter ID/title, and content title
   */
  validateConsistency(filePath, frontmatter, content) {
    const errors = [];
    const filename = path.basename(filePath, '.md');

    // Guard against missing frontmatter
    if (!frontmatter || typeof frontmatter !== 'object') {
      return { errors, warnings: [] };
    }

    // For requirements: validate ID consistency
    if (frontmatter.id?.startsWith('REQ-')) {
      const expectedIdFromFilename = this.extractIdFromFilename(filename);

      if (expectedIdFromFilename) {
        const normalizedFileId = expectedIdFromFilename
          .toUpperCase()
          .replace(/-/g, '-');
        const normalizedFrontmatterId = frontmatter.id
          .toUpperCase()
          .replace(/_/g, '-');

        if (normalizedFileId !== normalizedFrontmatterId) {
          errors.push({
            type: 'id_mismatch',
            field: 'id',
            message: `Frontmatter ID "${frontmatter.id}" doesn't match filename "${filename}" (expected: ${expectedIdFromFilename})`,
            actual: frontmatter.id,
            expected: expectedIdFromFilename,
          });
        }
      }
    }

    // For all documents: validate title consistency
    if (frontmatter.title) {
      const contentTitle = this.extractContentTitle(content);

      if (contentTitle) {
        // Normalize both titles for comparison (remove common prefixes like "Requirement:")
        const normalizedContentTitle = contentTitle
          .replace(/^(Requirement|REQ-\w+-\d+):\s*/i, '')
          .trim()
          .toLowerCase();
        const normalizedFrontmatterTitle = frontmatter.title
          .trim()
          .toLowerCase();

        if (normalizedContentTitle !== normalizedFrontmatterTitle) {
          errors.push({
            type: 'title_mismatch',
            field: 'title',
            message: `Content title "${contentTitle}" doesn't match frontmatter title "${frontmatter.title}"`,
            actual: contentTitle,
            expected: frontmatter.title,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Extract ID from requirement filename (e.g., "req-auth-001" → "REQ-AUTH-001")
   */
  extractIdFromFilename(filename) {
    const match = filename.match(/^req-([a-z0-9]+)-(\d{3})/i);
    if (match) {
      const domain = match[1].toUpperCase();
      const number = match[2];
      return `REQ-${domain}-${number}`;
    }
    return null;
  }

  /**
   * Extract the first heading from content
   */
  extractContentTitle(content) {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }

  /**
   * Validate a single file (filename + structure)
   */
  async validateFile(filePath) {
    const filenameResult = this.validateFilename(filePath);
    const structureResult = await this.validateStructure(filePath);

    // Check if validation was bypassed
    if (
      structureResult.bypassed === true ||
      structureResult.bypassed?.skipAll
    ) {
      return {
        file: filePath,
        valid: true,
        errors: [],
        warnings: [],
        template: structureResult.template,
        bypassed: structureResult.bypassed,
        message: structureResult.message,
      };
    }

    // Validate consistency (if not bypassed)
    const _consistencyResult = this.validateConsistency(
      filePath,
      structureResult.frontmatter
    );

    // Validate cross-references (if not bypassed)
    const referencesResult = this.validateCrossReferences(
      filePath,
      structureResult.frontmatter || {}
    );

    const allErrors = [
      ...(filenameResult.valid ? [] : [filenameResult]),
      ...(structureResult.errors || []),
      ...(referencesResult.errors || []),
    ];

    const allWarnings = [...(structureResult.warnings || [])];

    return {
      file: filePath,
      valid:
        filenameResult.valid && structureResult.valid && referencesResult.valid,
      errors: allErrors,
      warnings: allWarnings,
      template: structureResult.template || filenameResult.template,
      bypassed: structureResult.bypassed,
    };
  }

  /**
   * Validate multiple files
   */
  async validateFiles(filePaths) {
    const results = [];
    for (const filePath of filePaths) {
      const result = await this.validateFile(filePath);
      results.push(result);
    }
    return results;
  }

  /**
   * Validate directory (recursive)
   */
  async validateDirectory(directoryPath, options = {}) {
    const { pattern = /\.md$/, recursive = true } = options;

    const files = [];

    const scanDir = async (dir) => {
      const entries = await fs.readdir(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          // Skip node_modules, .git, etc.
          if (
            !['node_modules', '.git', 'build', 'dist', '.next'].includes(entry)
          ) {
            if (recursive) {
              await scanDir(fullPath);
            }
          }
        } else if (pattern.test(entry)) {
          // Skip .template.md files
          if (entry !== '.template.md') {
            files.push(fullPath);
          }
        }
      }
    };

    await scanDir(directoryPath);
    return this.validateFiles(files);
  }

  /**
   * Format validation results for display
   */
  formatResults(results, options = {}) {
    const { showValid = false, verbose = this.verbose } = options;

    const invalidResults = results.filter((r) => !r.valid);
    const validResults = results.filter((r) => r.valid);
    const bypassedResults = results.filter(
      (r) => r.bypassed === true || r.bypassed?.skipAll
    );
    const totalWarnings = results.reduce(
      (sum, r) => sum + (r.warnings?.length || 0),
      0
    );

    let output = '';

    // Summary
    if (invalidResults.length > 0) {
      output += chalk.red(
        `\n❌ Validation Failed: ${invalidResults.length}/${results.length} files have issues\n`
      );
      output += chalk.red(`${'='.repeat(70)}\n\n`);

      invalidResults.forEach((result) => {
        const relativePath = path.relative(this.projectRoot, result.file);
        output += chalk.red(`📄 ${relativePath}\n`);

        if (result.template) {
          output += chalk.gray(
            `   Template: ${path.relative(this.projectRoot, result.template)}\n`
          );
        }

        (result.errors || []).forEach((error) => {
          if (typeof error === 'string') {
            output += chalk.red(`   • ${error}\n`);
          } else if (error.message) {
            output += chalk.red(`   • ${error.message}\n`);
            if (verbose && error.actual) {
              output += chalk.gray(`     Actual: ${error.actual}\n`);
            }
            if (verbose && error.expected) {
              output += chalk.gray(`     Expected: ${error.expected}\n`);
            }
          }
        });

        output += '\n';
      });
    } else {
      output += chalk.green(
        `\n✅ All ${results.length} files validated successfully\n\n`
      );
    }

    // Show bypassed files
    if (bypassedResults.length > 0 && verbose) {
      output += chalk.yellow(
        `⚠️  ${bypassedResults.length} files bypassed validation:\n`
      );
      bypassedResults.forEach((result) => {
        const relativePath = path.relative(this.projectRoot, result.file);
        output += chalk.yellow(`📄 ${relativePath}\n`);

        if (result.bypassed === true || result.bypassed?.skipAll) {
          output += chalk.gray(`   • All validation bypassed\n`);
        } else {
          const bypasses = [];
          if (result.bypassed?.skipFrontmatter) bypasses.push('frontmatter');
          if (result.bypassed?.skipSections) bypasses.push('sections');
          if (result.bypassed?.skipConsistency) bypasses.push('consistency');
          output += chalk.gray(`   • Bypassed: ${bypasses.join(', ')}\n`);
        }
      });
      output += '\n';
    }

    // Warnings
    if (totalWarnings > 0) {
      output += chalk.yellow(`⚠️  ${totalWarnings} warnings:\n`);
      results.forEach((result) => {
        if (result.warnings && result.warnings.length > 0) {
          const relativePath = path.relative(this.projectRoot, result.file);
          output += chalk.yellow(`📄 ${relativePath}:\n`);
          result.warnings.forEach((warning) => {
            output += chalk.yellow(`   • ${warning.message}\n`);
          });
        }
      });
      output += '\n';
    }

    // Valid files list (if requested)
    if (showValid && validResults.length > 0) {
      output += chalk.green(`✅ Valid files (${validResults.length}):\n`);
      validResults.forEach((result) => {
        output += chalk.green(
          `   • ${path.relative(this.projectRoot, result.file)}\n`
        );
      });
      output += '\n';
    }

    return output;
  }

  /**
   * Get validation summary statistics
   */
  getSummary(results) {
    return {
      total: results.length,
      valid: results.filter((r) => r.valid).length,
      invalid: results.filter((r) => !r.valid).length,
      warnings: results.reduce((sum, r) => sum + (r.warnings?.length || 0), 0),
      errors: results.reduce((sum, r) => sum + (r.errors?.length || 0), 0),
    };
  }

  /**
   * Check if validation should block operations (e.g., git commit)
   */
  shouldBlock(results) {
    return results.some((r) => !r.valid);
  }

  /**
   * Suggest fixes for validation issues
   */
  suggestFixes(result) {
    const suggestions = [];

    if (!result.valid) {
      const filename = path.basename(result.file);
      const _dir = path.dirname(result.file);

      // Filename fixes
      const filenameError = result.errors.find(
        (e) => e.severity === 'error' && e.expected
      );
      if (filenameError) {
        suggestions.push({
          type: 'filename',
          message: `Rename file to match pattern: ${filenameError.expected}`,
          action: 'rename',
          current: filename,
          suggested: this.suggestFilename(filename, filenameError.expected),
        });
      }

      // Frontmatter fixes
      const missingFields = result.errors.filter(
        (e) => e.type === 'missing_frontmatter'
      );
      if (missingFields.length > 0) {
        suggestions.push({
          type: 'frontmatter',
          message: `Add missing frontmatter fields: ${missingFields.map((f) => f.field).join(', ')}`,
          action: 'add_frontmatter',
          fields: missingFields.map((f) => ({
            name: f.field,
            value: this.getDefaultValue(f.field),
          })),
        });
      }

      // Section fixes
      const missingSections = result.errors.filter(
        (e) => e.type === 'missing_section'
      );
      if (missingSections.length > 0) {
        suggestions.push({
          type: 'sections',
          message: `Add missing sections: ${missingSections.map((s) => s.section).join(', ')}`,
          action: 'add_sections',
          sections: missingSections.map((s) => s.section),
        });
      }

      // Template hint fixes
      const hintWarnings = result.warnings?.filter(
        (w) => w.type === 'template_hint'
      );
      if (hintWarnings && hintWarnings.length > 0) {
        suggestions.push({
          type: 'template_hints',
          message: `Remove or replace template placeholders`,
          action: 'remove_hints',
          hints: hintWarnings.map((w) => w.hint),
        });
      }
    }

    return suggestions;
  }

  /**
   * Suggest a proper filename based on pattern
   */
  suggestFilename(currentName, pattern) {
    // For date-based patterns
    if (pattern.includes('\\d{4}-\\d{2}-\\d{2}')) {
      const today = new Date().toISOString().split('T')[0];
      const description = currentName
        .replace(/\.md$/, '')
        .replace(/^.*?-/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      return `${today}-${description}.md`;
    }

    // For req-domain-number patterns
    if (pattern.includes('req-[a-z0-9]+-\\d{3}')) {
      const match = currentName.match(/req-([a-z0-9]+)-(\d+)/i);
      if (match) {
        const domain = match[1].toLowerCase();
        const number = match[2].padStart(3, '0');
        const description = currentName
          .replace(/req-[a-z0-9]+-\d+/i, '')
          .replace(/^-/, '')
          .replace(/\.md$/, '')
          .toLowerCase();
        return `req-${domain}-${number}${description ? `-${description}` : ''}.md`;
      }
    }

    return currentName;
  }

  /**
   * Get default value for a frontmatter field
   */
  getDefaultValue(fieldName) {
    const defaults = {
      status: 'active',
      priority: 'medium',
      assignee: '',
      epic: '',
      spawned_requirements: [],
      started: new Date().toISOString().split('T')[0],
      created: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString().split('T')[0],
      dependencies: [],
      tags: [],
      category: 'core',
      hierarchy: 'feature-level',
      riskLevel: 'Medium',
      version: '1.0.0',
      complianceStandards: [],
      priorityScore: 50,
      reviewedBy: '',
      approvedBy: '',
    };

    return defaults[fieldName] !== undefined ? defaults[fieldName] : '';
  }

  /**
   * Apply auto-fix to a file
   */
  async applyFix(filePath, suggestion) {
    try {
      if (suggestion.action === 'rename') {
        const dir = path.dirname(filePath);
        const newPath = path.join(dir, suggestion.suggested);
        await fs.rename(filePath, newPath);
        return {
          success: true,
          message: `Renamed: ${suggestion.current} → ${suggestion.suggested}`,
          newPath,
        };
      }

      if (suggestion.action === 'add_frontmatter') {
        const { data: frontmatter, content: body } = matter.read(filePath);

        // Add missing fields
        for (const field of suggestion.fields) {
          if (!(field.name in frontmatter)) {
            frontmatter[field.name] = field.value;
          }
        }

        const newContent = matter.stringify(body, frontmatter);
        await fs.writeFile(filePath, newContent);

        return {
          success: true,
          message: `Added frontmatter fields: ${suggestion.fields.map((f) => f.name).join(', ')}`,
        };
      }

      if (suggestion.action === 'add_sections') {
        let content = await fs.readFile(filePath, 'utf8');

        // Add missing sections at the end
        for (const section of suggestion.sections) {
          if (!content.includes(`## ${section}`)) {
            content += `\n\n## ${section}\n\n[Add content here]\n`;
          }
        }

        await fs.writeFile(filePath, content);

        return {
          success: true,
          message: `Added sections: ${suggestion.sections.join(', ')}`,
        };
      }

      if (suggestion.action === 'remove_hints') {
        let content = await fs.readFile(filePath, 'utf8');

        // Remove common template hints
        for (const hint of suggestion.hints) {
          content = content.replace(new RegExp(hint, 'g'), '');
        }

        await fs.writeFile(filePath, content);

        return {
          success: true,
          message: `Removed template hints: ${suggestion.hints.join(', ')}`,
        };
      }

      return {
        success: false,
        message: `Unknown fix action: ${suggestion.action}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to apply fix: ${error.message}`,
        error,
      };
    }
  }

  /**
   * Validate cross-references in frontmatter (requirements, tasks, etc.)
   * @param {string} filePath - Path to the file being validated
   * @param {object} frontmatter - Parsed frontmatter
   * @returns {{valid: boolean, errors: Array}}
   */
  validateCrossReferences(filePath, frontmatter) {
    const errors = [];
    const baseDir = path.dirname(filePath);

    // Fields that should contain relative file paths
    const referenceFields = [
      'requirements',
      'tasks',
      'dependencies',
      'related_docs',
    ];

    for (const field of referenceFields) {
      if (!frontmatter[field]) continue;

      const refs = Array.isArray(frontmatter[field])
        ? frontmatter[field]
        : [frontmatter[field]];

      for (const ref of refs) {
        if (typeof ref !== 'string') continue;

        // Skip empty strings
        if (ref.trim() === '') continue;

        // Check if it's a relative path (should start with ./ or ../)
        if (!ref.startsWith('./') && !ref.startsWith('../')) {
          errors.push({
            type: 'invalid_reference_format',
            field,
            value: ref,
            message: `Reference '${ref}' in '${field}' must be a relative path (start with ./ or ../)`,
            fix: `Update to relative path, e.g., './${field}/${ref}.md'`,
          });
          continue;
        }

        // Resolve the absolute path
        const refPath = path.resolve(baseDir, ref);

        // Check if file exists
        if (!fs.existsSync(refPath)) {
          errors.push({
            type: 'broken_reference',
            field,
            value: ref,
            resolvedPath: refPath,
            message: `Referenced file not found: ${ref}`,
            fix: `Create the file at ${refPath} or fix the reference`,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate and optionally fix a file
   */
  async validateAndFix(filePath, options = {}) {
    const { autoFix = false, _ } = options;

    // First validation
    const result = await this.validateFile(filePath);

    if (result.valid && !result.warnings?.length) {
      return {
        file: filePath,
        valid: true,
        fixed: false,
        message: 'File is valid',
      };
    }

    // Get fix suggestions
    const suggestions = this.suggestFixes(result);

    if (!autoFix || suggestions.length === 0) {
      return {
        ...result,
        suggestions,
        fixed: false,
      };
    }

    // Apply fixes
    const appliedFixes = [];
    let currentPath = filePath;

    for (const suggestion of suggestions) {
      const fixResult = await this.applyFix(currentPath, suggestion);

      if (fixResult.success) {
        appliedFixes.push({
          type: suggestion.type,
          message: fixResult.message,
        });

        // Update path if renamed
        if (fixResult.newPath) {
          currentPath = fixResult.newPath;
        }
      }
    }

    // Re-validate after fixes
    const finalResult = await this.validateFile(currentPath);

    return {
      file: filePath,
      newPath: currentPath !== filePath ? currentPath : undefined,
      originalResult: result,
      finalResult,
      fixed: appliedFixes.length > 0,
      appliedFixes,
      remainingIssues:
        finalResult.errors?.length || finalResult.warnings?.length || 0,
    };
  }

  /**
   * Validate and fix multiple files
   */
  async validateAndFixDirectory(directoryPath, options = {}) {
    const results = await this.validateDirectory(directoryPath, options);

    if (!options.autoFix) {
      return results.map((result) => ({
        ...result,
        suggestions: this.suggestFixes(result),
      }));
    }

    const fixResults = [];

    for (const result of results) {
      if (!result.valid) {
        const fixResult = await this.validateAndFix(result.file, {
          autoFix: true,
        });
        fixResults.push(fixResult);
      } else {
        fixResults.push({
          file: result.file,
          valid: true,
          fixed: false,
        });
      }
    }

    return fixResults;
  }
}

module.exports = { TemplateValidator };
