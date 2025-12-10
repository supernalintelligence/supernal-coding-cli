/**
 * Git Assessment Script (Wrapper)
 *
 * This is a thin wrapper around the main GitAssessmentCommand
 * located in cli/commands/git/assessment.js
 *
 * Provides standalone access to git assessment functionality
 * while keeping the core logic in the CLI commands structure.
 */

import path from 'node:path';
import fs from 'node:fs';
const GitAssessmentCommand = require('../cli/commands/git/assessment');

interface AssessmentOptions {
  silent: boolean;
  format: string;
  score: boolean;
  recommendations: boolean;
}

interface Recommendation {
  priority: string;
  message: string;
  action?: string;
}

interface AssessmentResult {
  overallScore: number;
  recommendations: Recommendation[];
}

function getFormat(args: string[]): string {
  const formatIndex = args.indexOf('--format');
  if (formatIndex !== -1 && args[formatIndex + 1]) {
    return args[formatIndex + 1];
  }
  return 'report';
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options: AssessmentOptions = {
    silent: args.includes('--silent'),
    format: getFormat(args),
    score: args.includes('--score'),
    recommendations: args.includes('--recommendations')
  };

  try {
    const assessment = new GitAssessmentCommand();
    const result: AssessmentResult = await assessment.runAssessment(options);

    if (options.score) {
      console.log(result.overallScore);
    } else if (options.recommendations) {
      result.recommendations.forEach((rec) => {
        console.log(`[${rec.priority.toUpperCase()}] ${rec.message}`);
        if (rec.action) console.log(`Action: ${rec.action}`);
      });
    } else if (options.format === 'json') {
      if (options.silent) {
        const outputPath = path.join(process.cwd(), 'git-assessment.json');
        fs.writeFileSync(outputPath, assessment.exportJSON());
        console.log(outputPath);
      } else {
        console.log(assessment.exportJSON());
      }
    } else if (options.format === 'csv') {
      if (options.silent) {
        const outputPath = path.join(process.cwd(), 'git-assessment.csv');
        fs.writeFileSync(outputPath, assessment.exportCSV());
        console.log(outputPath);
      } else {
        console.log(assessment.exportCSV());
      }
    } else {
      if (!options.silent) {
        console.log(assessment.generateReport());
      }
    }

    process.exit(0);
  } catch (error) {
    if (!options.silent) {
      console.error('❌ Git assessment failed:', (error as Error).message);
    }
    process.exit(1);
  }
}

export { main };

if (require.main === module) {
  main();
}
