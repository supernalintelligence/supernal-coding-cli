#!/usr/bin/env node
// @ts-nocheck

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const yaml = require('js-yaml');

class PhaseManager {
  projectRoot: any;
  requirementsPath: any;
  templatesPath: any;
  constructor() {
    this.projectRoot = process.cwd();
    this.requirementsPath = path.join(
      this.projectRoot,
      'supernal-coding',
      'requirements'
    );
    this.templatesPath = path.join(
      this.projectRoot,
      'supernal-coding',
      'templates'
    );
  }

  async getAllRequirements() {
    const requirements = [];

    async function scanDir(dir) {
      if (!(await fs.pathExists(dir))) return;

      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          await scanDir(fullPath);
        } else if (item.name.endsWith('.md') && item.name.includes('req-')) {
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (frontmatterMatch) {
              const frontmatter = yaml.load(frontmatterMatch[1]);
              requirements.push({
                ...frontmatter,
                filePath: fullPath,
                fileName: item.name
              });
            }
          } catch (error) {
            console.warn(
              chalk.yellow(`⚠️ Could not parse ${item.name}: ${error.message}`)
            );
          }
        }
      }
    }

    await scanDir(this.requirementsPath);
    return requirements;
  }

  async showPhaseStatus() {
    console.log(chalk.blue.bold('\n📊 Phase Status Dashboard\n'));

    const requirements = await this.getAllRequirements();
    const phases = [
      'discovery',
      'foundation',
      'implementation',
      'integration',
      'release'
    ];
    const phaseStats = {};

    // Initialize phase stats
    phases.forEach((phase) => {
      phaseStats[phase] = {
        total: 0,
        pending: 0,
        inProgress: 0,
        done: 0,
        blocked: 0,
        requirements: []
      };
    });

    // Count requirements by phase
    requirements.forEach((req) => {
      const phase = req.phase || 'foundation'; // default phase
      const status = req.status || 'Draft';

      if (phaseStats[phase]) {
        phaseStats[phase].total++;
        phaseStats[phase].requirements.push(req);

        if (
          status.toLowerCase().includes('done') ||
          status.toLowerCase().includes('complete')
        ) {
          phaseStats[phase].done++;
        } else if (
          status.toLowerCase().includes('progress') ||
          status.toLowerCase().includes('active')
        ) {
          phaseStats[phase].inProgress++;
        } else if (req.blockedBy && req.blockedBy.length > 0) {
          phaseStats[phase].blocked++;
        } else {
          phaseStats[phase].pending++;
        }
      }
    });

    // Display phase table
    console.log('| Phase | Total | Done | In Progress | Pending | Blocked |');
    console.log('|-------|-------|------|-------------|---------|---------|');

    phases.forEach((phase) => {
      const stats = phaseStats[phase];
      const phaseName = phase.charAt(0).toUpperCase() + phase.slice(1);
      console.log(
        `| ${phaseName.padEnd(13)} | ${stats.total.toString().padEnd(5)} | ${stats.done.toString().padEnd(4)} | ${stats.inProgress.toString().padEnd(11)} | ${stats.pending.toString().padEnd(7)} | ${stats.blocked.toString().padEnd(7)} |`
      );
    });

    console.log('\n');
  }

  async showPhaseRequirements(phaseName) {
    console.log(
      chalk.blue.bold(
        `\n📋 Requirements in ${phaseName.charAt(0).toUpperCase() + phaseName.slice(1)} Phase\n`
      )
    );

    const requirements = await this.getAllRequirements();
    const phaseReqs = requirements.filter(
      (req) => (req.phase || 'foundation') === phaseName
    );

    if (phaseReqs.length === 0) {
      console.log(chalk.gray('No requirements found in this phase.'));
      return;
    }

    phaseReqs.forEach((req) => {
      const statusIcon = this.getStatusIcon(req.status);
      const blockedIcon =
        req.blockedBy && req.blockedBy.length > 0 ? ' 🚫' : '';
      console.log(`${statusIcon} ${req.id}: ${req.title}${blockedIcon}`);

      if (req.dependencies && req.dependencies.length > 0) {
        console.log(
          chalk.gray(`   Dependencies: ${req.dependencies.join(', ')}`)
        );
      }

      if (req.blockedBy && req.blockedBy.length > 0) {
        console.log(chalk.red(`   Blocked by: ${req.blockedBy.join(', ')}`));
      }
    });

    console.log('\n');
  }

  async moveRequirement(reqId, targetPhase) {
    const requirements = await this.getAllRequirements();
    const req = requirements.find((r) => r.id === reqId);

    if (!req) {
      console.log(chalk.red(`❌ Requirement ${reqId} not found`));
      return;
    }

    const validPhases = [
      'discovery',
      'foundation',
      'implementation',
      'integration',
      'release'
    ];
    if (!validPhases.includes(targetPhase)) {
      console.log(
        chalk.red(
          `❌ Invalid phase: ${targetPhase}. Valid phases: ${validPhases.join(', ')}`
        )
      );
      return;
    }

    // Update the requirement file
    const content = await fs.readFile(req.filePath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (frontmatterMatch) {
      const frontmatter = yaml.load(frontmatterMatch[1]);
      const oldPhase = frontmatter.phase || 'foundation';

      // Update phase
      frontmatter.phase = targetPhase;
      frontmatter.updated = new Date().toISOString().split('T')[0];

      // Update phase history
      if (!frontmatter.phaseHistory) {
        frontmatter.phaseHistory = [];
      }
      frontmatter.phaseHistory.push({
        phase: targetPhase,
        date: new Date().toISOString().split('T')[0],
        from: oldPhase,
        by: 'system'
      });

      // Reconstruct the file
      const newFrontmatter = yaml.dump(frontmatter);
      const bodyContent = content.replace(/^---\n[\s\S]*?\n---/, '');
      const newContent = `---\n${newFrontmatter}---${bodyContent}`;

      await fs.writeFile(req.filePath, newContent);

      console.log(
        chalk.green(
          `✅ Moved ${reqId} from ${oldPhase} to ${targetPhase} phase`
        )
      );
    }
  }

  async generatePhaseMap(epicName) {
    console.log(
      chalk.blue.bold(`\n🗺️ Generating Phase Map for Epic: ${epicName}\n`)
    );

    const requirements = await this.getAllRequirements();
    const epicReqs = requirements.filter((req) =>
      req.epic?.toLowerCase().includes(epicName.toLowerCase())
    );

    if (epicReqs.length === 0) {
      console.log(
        chalk.yellow(`⚠️ No requirements found for epic: ${epicName}`)
      );
      return;
    }

    // Load phase map template
    const templatePath = path.join(this.templatesPath, 'phase-map-template.md');
    let template = '';

    if (await fs.pathExists(templatePath)) {
      template = await fs.readFile(templatePath, 'utf8');
    } else {
      console.log(
        chalk.yellow('⚠️ Phase map template not found, creating basic map')
      );
      template = this.getBasicPhaseMapTemplate();
    }

    // Group requirements by phase
    const phases = [
      'discovery',
      'foundation',
      'implementation',
      'integration',
      'release'
    ];
    const phaseGroups = {};

    phases.forEach((phase) => {
      phaseGroups[phase] = epicReqs.filter(
        (req) => (req.phase || 'foundation') === phase
      );
    });

    // Generate phase map content
    let phaseMapContent = template
      .replace(/{{project-name}}/g, epicName)
      .replace(/{{epic-name}}/g, epicName)
      .replace(/{{date}}/g, new Date().toISOString().split('T')[0]);

    // Replace requirement placeholders for each phase
    phases.forEach((phase) => {
      const reqs = phaseGroups[phase];
      let reqList = '';

      reqs.forEach((req) => {
        const statusIcon = this.getStatusIcon(req.status);
        reqList += `- ${statusIcon} ${req.id}: ${req.title} (${req.status || 'Draft'})\n`;
      });

      if (reqList === '') {
        reqList = '- No requirements in this phase yet\n';
      }

      // Replace in template (this is a simplified replacement)
      const phaseSection = new RegExp(
        `(### ${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase[\\s\\S]*?Requirements in this phase\\*\\*:)([\\s\\S]*?)(?=###|$)`,
        'i'
      );
      phaseMapContent = phaseMapContent.replace(
        phaseSection,
        `$1\n${reqList}\n`
      );
    });

    // Save phase map
    const outputPath = path.join(
      this.projectRoot,
      'supernal-coding',
      'workflow-diagrams',
      `${epicName.toLowerCase().replace(/\s+/g, '-')}-phase-map.md`
    );
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, phaseMapContent);

    console.log(chalk.green(`✅ Phase map generated: ${outputPath}`));
  }

  getStatusIcon(status) {
    if (!status) return '⏳';
    const s = status.toLowerCase();
    if (s.includes('done') || s.includes('complete')) return '✅';
    if (s.includes('progress') || s.includes('active')) return '🔄';
    if (s.includes('blocked')) return '🚫';
    if (s.includes('review')) return '👀';
    return '⏳';
  }

  getBasicPhaseMapTemplate() {
    return `# Phase Map: {{project-name}}

**Created**: {{date}}
**Epic**: {{epic-name}}

## Phase Overview

### Discovery Phase
**Requirements in this phase**:
- REQ-XXX: Placeholder

### Foundation Phase
**Requirements in this phase**:
- REQ-XXX: Placeholder

### Implementation Phase
**Requirements in this phase**:
- REQ-XXX: Placeholder

### Integration Phase
**Requirements in this phase**:
- REQ-XXX: Placeholder

### Release Phase
**Requirements in this phase**:
- REQ-XXX: Placeholder
`;
  }
}

/**
 * CLI interface
 */
async function handlePhaseCommand(...args) {
  const manager = new PhaseManager();
  const subCommand = args[0] || 'status';

  try {
    switch (subCommand) {
      case 'status':
        await manager.showPhaseStatus();
        break;

      case 'show': {
        const phaseName = args[1];
        if (!phaseName) {
          console.log(chalk.red('❌ Usage: sc phase show <phase_name>'));
          console.log(
            chalk.gray(
              'Valid phases: discovery, foundation, implementation, integration, release'
            )
          );
          return;
        }
        await manager.showPhaseRequirements(phaseName);
        break;
      }

      case 'move': {
        const reqId = args[1];
        const targetPhase = args[2];
        if (!reqId || !targetPhase) {
          console.log(
            chalk.red('❌ Usage: sc phase move <req_id> <target_phase>')
          );
          return;
        }
        await manager.moveRequirement(reqId, targetPhase);
        break;
      }

      case 'map': {
        const epicName = args[1];
        if (!epicName) {
          console.log(chalk.red('❌ Usage: sc phase map <epic_name>'));
          return;
        }
        await manager.generatePhaseMap(epicName);
        break;
      }

      case 'help':
        showPhaseHelp();
        break;

      default:
        console.log(chalk.red(`❌ Unknown phase command: ${subCommand}`));
        showPhaseHelp();
        break;
    }
  } catch (error) {
    console.error(chalk.red(`❌ Phase error: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  }
}

function showPhaseHelp() {
  console.log(chalk.blue.bold('\n📊 Phase Management Commands\n'));
  console.log('Usage: sc phase <command> [options]\n');
  console.log('Commands:');
  console.log('  status              Show phase status dashboard');
  console.log('  show <phase>        Show requirements in specific phase');
  console.log('  move <req> <phase>  Move requirement to different phase');
  console.log('  map <epic>          Generate phase map for epic');
  console.log('  help                Show this help message\n');
  console.log(
    'Phases: discovery, foundation, implementation, integration, release\n'
  );
  console.log('Examples:');
  console.log('  sc phase status');
  console.log('  sc phase show foundation');
  console.log('  sc phase move REQ-001 implementation');
  console.log('  sc phase map user-management');
}

module.exports = { handlePhaseCommand, PhaseManager };
