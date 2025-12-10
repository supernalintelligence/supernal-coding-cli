#!/usr/bin/env node
// @ts-nocheck

const program = require('commander');
const LinkChecker = require('../cli/commands/docs/validate-links');
const glob = require('glob');
const fs = require('fs-extra');
const path = require('node:path');
const matter = require('gray-matter');
const chalk = require('chalk');

program
  .name('sc reference')
  .description('Validate and manage version-aware references');

program
  .command('validate [file]')
  .description('Validate path@version references')
  .option('--all', 'Validate all documents')
  .action(async (file, options) => {
    const checker = new LinkChecker();

    const files = options.all ? glob.sync('docs/**/*.md') : [file];

    console.log(chalk.cyan(`\n🔍 Validating ${files.length} files...\n`));

    for (const f of files) {
      await checker.checkFrontmatterReferences(f);
    }

    if (checker.brokenLinks.length === 0) {
      console.log(chalk.green('✓ All references are valid!\n'));
      process.exit(0);
    }

    console.log(
      chalk.red(`\n❌ Found ${checker.brokenLinks.length} issues:\n`)
    );

    for (const issue of checker.brokenLinks) {
      console.log(chalk.yellow(`File: ${issue.file}`));
      console.log(`  Field: ${issue.field}`);

      if (issue.type === 'invalid_dependency_direction') {
        console.log(chalk.red(`  Error: ${issue.message}`));
        console.log(chalk.gray(`  Suggestion: ${issue.suggestion}`));
      } else if (issue.error) {
        console.log(chalk.red(`  Error: ${issue.error}`));
      } else if (issue.warning) {
        console.log(chalk.yellow(`  Warning: ${issue.warning}`));
        if (issue.expected && issue.current) {
          console.log(
            `  Expected: ${issue.expected}, Current: ${issue.current} [${issue.severity}]`
          );
        }
      }
      console.log('');
    }

    process.exit(1);
  });

program
  .command('check [file]')
  .description('Check version mismatches only')
  .action(async (file) => {
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`File not found: ${file}`));
      process.exit(1);
    }

    const content = await fs.readFile(file, 'utf8');
    const { data: fm } = matter(content);
    const fileDir = path.dirname(file);

    const fields = [
      'dependencies',
      'compliance_requirements',
      'architecture',
      'related',
      'implements_requirements'
    ];

    let found = false;

    for (const field of fields) {
      if (!fm[field]) continue;

      let refs = fm[field];
      if (typeof refs === 'string') refs = [refs];
      if (!Array.isArray(refs)) continue;

      for (const ref of refs) {
        const atIndex = ref.lastIndexOf('@');
        if (atIndex === -1) continue;

        const refPath = ref.substring(0, atIndex);
        const expectedVersion = ref.substring(atIndex + 1);

        const absolutePath = path.resolve(fileDir, refPath);
        if (!fs.existsSync(absolutePath)) continue;

        const targetContent = await fs.readFile(absolutePath, 'utf8');
        const targetMatch = targetContent.match(/^---\s*\n([\s\S]*?)\n---/);
        if (!targetMatch) continue;

        // Simple version extraction
        const versionMatch = targetMatch[1].match(
          /version:\s*["']?([^"'\n]+)["']?/
        );
        if (!versionMatch) continue;

        const currentVersion = versionMatch[1].trim();

        if (currentVersion !== expectedVersion) {
          found = true;
          console.log(chalk.yellow(`\n⚠️  Version mismatch in ${file}`));
          console.log(`   Field: ${field}`);
          console.log(`   Path: ${refPath}`);
          console.log(
            `   Expected: ${expectedVersion}, Current: ${currentVersion}`
          );
        }
      }
    }

    if (!found) {
      console.log(chalk.green('\n✓ All versions match!\n'));
    } else {
      console.log('');
      process.exit(1);
    }
  });

program
  .command('impact <file>')
  .description('Show what depends on this file')
  .option('--cascade', 'Show cascade impact')
  .action(async (file, options) => {
    const allDocs = glob.sync('docs/**/*.md');
    const directRefs = [];
    const cascadeRefs = new Map();

    console.log(chalk.cyan(`\n📊 Impact Analysis: ${file}\n`));

    for (const doc of allDocs) {
      const content = await fs.readFile(doc, 'utf8');
      const { data: fm } = matter(content);

      const fields = [
        'dependencies',
        'compliance_requirements',
        'architecture',
        'related',
        'implements_requirements'
      ];

      for (const field of fields) {
        if (!fm[field]) continue;

        let refs = fm[field];
        if (typeof refs === 'string') refs = [refs];
        if (!Array.isArray(refs)) continue;

        for (const ref of refs) {
          const atIndex = ref.lastIndexOf('@');
          const refPath = atIndex === -1 ? ref : ref.substring(0, atIndex);
          const version = atIndex === -1 ? null : ref.substring(atIndex + 1);

          const absolutePath = path.resolve(path.dirname(doc), refPath);
          const normalizedTarget = path.normalize(file);
          const normalizedRef = path.normalize(absolutePath);

          if (normalizedRef === normalizedTarget) {
            directRefs.push({ doc, field, version });
          }
        }
      }
    }

    console.log(chalk.bold(`Direct References (${directRefs.length}):`));
    if (directRefs.length === 0) {
      console.log(chalk.gray('  (none)\n'));
    } else {
      for (const { doc, field, version } of directRefs) {
        console.log(`  ${chalk.cyan(doc)}`);
        console.log(`    Field: ${field}, Version: ${version || 'latest'}`);
      }
      console.log('');
    }

    if (options.cascade && directRefs.length > 0) {
      console.log(chalk.bold('Cascade Impact:'));

      for (const { doc } of directRefs) {
        // Find what depends on this direct ref
        for (const cascadeDoc of allDocs) {
          const content = await fs.readFile(cascadeDoc, 'utf8');
          const { data: fm } = matter(content);

          const fields = [
            'dependencies',
            'compliance_requirements',
            'architecture',
            'related',
            'implements_requirements'
          ];

          for (const field of fields) {
            if (!fm[field]) continue;

            let refs = fm[field];
            if (typeof refs === 'string') refs = [refs];
            if (!Array.isArray(refs)) continue;

            for (const ref of refs) {
              const atIndex = ref.lastIndexOf('@');
              const refPath = atIndex === -1 ? ref : ref.substring(0, atIndex);

              const absolutePath = path.resolve(
                path.dirname(cascadeDoc),
                refPath
              );
              const normalizedCascade = path.normalize(absolutePath);
              const normalizedDirect = path.normalize(doc);

              if (normalizedCascade === normalizedDirect) {
                if (!cascadeRefs.has(cascadeDoc)) {
                  cascadeRefs.set(cascadeDoc, []);
                }
                cascadeRefs.get(cascadeDoc).push({ via: doc, field });
              }
            }
          }
        }
      }

      if (cascadeRefs.size === 0) {
        console.log(chalk.gray('  (none)\n'));
      } else {
        for (const [doc, viaList] of cascadeRefs) {
          console.log(`  ${chalk.cyan(doc)}`);
          for (const { via, field } of viaList) {
            console.log(chalk.gray(`    via ${via} (${field})`));
          }
        }
        console.log('');
      }
    }
  });

program
  .command('update <file>')
  .description('Update a reference version in a document')
  .requiredOption('--path <path>', 'Path to update')
  .requiredOption('--to-version <version>', 'New version')
  .action(async (file, options) => {
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`File not found: ${file}`));
      process.exit(1);
    }

    const content = await fs.readFile(file, 'utf8');
    const { data: fm, content: body } = matter(content);

    const fields = [
      'dependencies',
      'compliance_requirements',
      'architecture',
      'related',
      'implements_requirements'
    ];

    let updated = false;

    for (const field of fields) {
      if (!fm[field]) continue;

      if (Array.isArray(fm[field])) {
        fm[field] = fm[field].map((ref) => {
          const atIndex = ref.lastIndexOf('@');
          const refPath = atIndex === -1 ? ref : ref.substring(0, atIndex);

          if (refPath === options.path) {
            updated = true;
            return `${refPath}@${options.toVersion}`;
          }
          return ref;
        });
      }
    }

    if (!updated) {
      console.error(chalk.yellow(`\nReference not found: ${options.path}\n`));
      process.exit(1);
    }

    fm.updated = new Date().toISOString().split('T')[0];

    const updatedContent = matter.stringify(body, fm);
    await fs.writeFile(file, updatedContent);

    console.log(chalk.green(`\n✓ Updated: ${file}`));
    console.log(`  ${options.path}: → ${options.toVersion}\n`);
  });

program.parse(process.argv);
