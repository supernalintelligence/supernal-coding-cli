// @ts-nocheck
/**
 * GitHub Issue Response Detection
 * 
 * Detects and classifies agent responses in GitHub issues.
 * 
 * Detection patterns:
 * - Code blocks (```)
 * - Implementation markers (implementation:, changes:, fixed:, etc.)
 * - Status updates (status:, in progress, working on, etc.)
 * - Substantive length (>200 chars)
 * 
 * Response types:
 * - implementation: Contains code or implementation details
 * - question: Contains questions or clarification requests
 * - status: Status updates or progress reports
 * - comment: General comments (not detected as substantive)
 */

const chalk = require('chalk');
const { execSync } = require('child_process');
const fs = require('fs');

// Detection patterns
const PATTERNS = {
  codeBlock: /```[\s\S]*?```/,
  implementationMarkers: [
    /implementation:/i,
    /changes:/i,
    /fixed:/i,
    /added:/i,
    /updated:/i,
    /removed:/i,
    /refactor:/i,
    /feature:/i,
    /bug\s*fix:/i,
    /resolved:/i,
    /completed:/i,
    /deployed:/i,
    /merged:/i,
    /##\s*implementation/i,
    /##\s*changes/i,
    /##\s*solution/i
  ],
  statusMarkers: [
    /status:/i,
    /in\s+progress/i,
    /working\s+on/i,
    /started/i,
    /wip:/i,
    /blocked:/i,
    /waiting:/i,
    /pending:/i,
    /review:/i,
    /testing:/i
  ],
  questionMarkers: [
    /\?$/m,
    /question:/i,
    /clarify/i,
    /what\s+(do|does|is|are|should)/i,
    /how\s+(do|does|can|should)/i,
    /could\s+you/i,
    /can\s+you/i
  ]
};

const SUBSTANTIVE_LENGTH = 200;

/**
 * Check for responses in GitHub issues
 */
async function checkResponses(options) {
  const { issue, since, labels, state = 'open', limit = 50, json, export: exportPath, verbose } = options;

  try {
    // Check gh CLI is available
    try {
      execSync('gh --version', { stdio: 'pipe' });
    } catch {
      console.log(chalk.red('Error: GitHub CLI (gh) is not installed or not authenticated'));
      console.log(chalk.yellow('Run: gh auth login'));
      return { success: false };
    }

    let issues = [];

    if (issue) {
      // Check specific issue
      issues = [{ number: parseInt(issue) }];
    } else {
      // Fetch issues based on filters
      issues = await fetchIssues({ since, labels, state, limit });
    }

    if (issues.length === 0) {
      console.log(chalk.yellow('No issues found matching filters'));
      return { success: true, responses: [] };
    }

    const allResponses = [];

    for (const iss of issues) {
      if (verbose) {
        console.log(chalk.blue(`\n🔍 Checking issue #${iss.number}...`));
      }

      const responses = await checkIssueResponses(iss.number, verbose);
      
      if (responses.length > 0) {
        allResponses.push({
          issue: iss.number,
          title: iss.title,
          responses
        });
      }

      // Rate limiting
      if (issues.length > 1) {
        await sleep(500);
      }
    }

    // Output results
    const result = {
      success: true,
      totalIssues: issues.length,
      issuesWithResponses: allResponses.length,
      responses: allResponses
    };

    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (exportPath) {
      fs.writeFileSync(exportPath, JSON.stringify(result, null, 2));
      console.log(chalk.green(`✅ Exported to ${exportPath}`));
    } else {
      printResults(result, verbose);
    }

    return result;

  } catch (error) {
    console.log(chalk.red('Error checking responses:', error.message));
    return { success: false, error };
  }
}

/**
 * Fetch issues from GitHub
 */
async function fetchIssues({ since, labels, state, limit }) {
  let cmd = `gh issue list --state ${state} --limit ${limit} --json number,title,updatedAt`;
  
  if (labels) {
    cmd += ` --label "${labels}"`;
  }

  try {
    const output = execSync(cmd, { encoding: 'utf8' });
    let issues = JSON.parse(output);

    // Filter by since if provided
    if (since) {
      const sinceDate = parseSince(since);
      issues = issues.filter(i => new Date(i.updatedAt) >= sinceDate);
    }

    return issues;
  } catch (error) {
    console.log(chalk.red('Error fetching issues:', error.message));
    return [];
  }
}

/**
 * Check a specific issue for responses
 */
async function checkIssueResponses(issueNumber, verbose) {
  try {
    const cmd = `gh issue view ${issueNumber} --json comments,title`;
    const output = execSync(cmd, { encoding: 'utf8' });
    const issue = JSON.parse(output);

    const responses = [];

    for (const comment of issue.comments || []) {
      const analysis = analyzeComment(comment);
      
      if (analysis.detected) {
        responses.push({
          ...analysis,
          commentId: comment.id,
          user: comment.author?.login || 'unknown',
          created_at: comment.createdAt,
          html_url: comment.url
        });
      }
    }

    if (verbose && responses.length === 0) {
      console.log(chalk.gray(`   No substantive responses found`));
    }

    return responses;
  } catch (error) {
    if (verbose) {
      console.log(chalk.red(`   Error: ${error.message}`));
    }
    return [];
  }
}

/**
 * Analyze a comment for response patterns
 */
function analyzeComment(comment) {
  const body = comment.body || '';
  
  const hasCode = PATTERNS.codeBlock.test(body);
  const hasImplementationMarker = PATTERNS.implementationMarkers.some(p => p.test(body));
  const hasStatus = PATTERNS.statusMarkers.some(p => p.test(body));
  const hasQuestion = PATTERNS.questionMarkers.some(p => p.test(body));
  const isSubstantive = body.length >= SUBSTANTIVE_LENGTH;

  // Determine if this is a detected response
  const detected = hasCode || hasImplementationMarker || (hasStatus && isSubstantive) || (hasQuestion && isSubstantive);

  // Classify response type
  let responseType = 'comment';
  if (hasCode || hasImplementationMarker) {
    responseType = 'implementation';
  } else if (hasQuestion) {
    responseType = 'question';
  } else if (hasStatus && isSubstantive) {
    responseType = 'status';
  }

  return {
    detected,
    hasCode,
    hasImplementationMarker,
    hasQuestion,
    hasStatus,
    isSubstantive,
    length: body.length,
    responseType
  };
}

/**
 * Print results to console
 */
function printResults(result, verbose) {
  console.log(chalk.blue(`\n📊 Response Detection Results`));
  console.log(chalk.gray(`   Checked ${result.totalIssues} issue(s)`));
  console.log(chalk.gray(`   Found responses in ${result.issuesWithResponses} issue(s)`));

  if (result.responses.length === 0) {
    console.log(chalk.yellow('\n   No substantive responses detected'));
    return;
  }

  console.log(chalk.green('\n✅ Responses found:\n'));

  for (const issueResult of result.responses) {
    console.log(chalk.cyan(`   Issue #${issueResult.issue}: ${issueResult.title || ''}`));
    
    for (const resp of issueResult.responses) {
      const icon = getTypeIcon(resp.responseType);
      console.log(chalk.white(`\n   ${icon} ${resp.responseType.toUpperCase()} by @${resp.user}`));
      console.log(chalk.gray(`      ID: ${resp.commentId}`));
      console.log(chalk.gray(`      Created: ${resp.created_at}`));
      
      if (resp.html_url) {
        console.log(chalk.gray(`      URL: ${resp.html_url}`));
      }

      if (verbose) {
        if (resp.hasCode) console.log(chalk.green(`      ✓ Contains code blocks`));
        if (resp.hasImplementationMarker) console.log(chalk.green(`      ✓ Has implementation markers`));
        if (resp.hasStatus) console.log(chalk.green(`      ✓ Has status markers`));
        if (resp.hasQuestion) console.log(chalk.yellow(`      ✓ Contains questions`));
        console.log(chalk.gray(`      Length: ${resp.length} chars`));
      }
    }
    console.log('');
  }
}

/**
 * Get icon for response type
 */
function getTypeIcon(type) {
  switch (type) {
    case 'implementation': return '💻';
    case 'question': return '❓';
    case 'status': return '📊';
    default: return '💬';
  }
}

/**
 * Parse since time string (e.g., "1h", "2d", "30m")
 */
function parseSince(since) {
  const match = since.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new Error(`Invalid since format: ${since}. Use format like 1h, 2d, 30m`);
  }

  const [, num, unit] = match;
  const now = new Date();
  
  switch (unit) {
    case 'm':
      return new Date(now - parseInt(num) * 60 * 1000);
    case 'h':
      return new Date(now - parseInt(num) * 60 * 60 * 1000);
    case 'd':
      return new Date(now - parseInt(num) * 24 * 60 * 60 * 1000);
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  checkResponses,
  analyzeComment,
  PATTERNS,
  SUBSTANTIVE_LENGTH
};

