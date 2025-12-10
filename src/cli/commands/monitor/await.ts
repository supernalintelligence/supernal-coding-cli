#!/usr/bin/env node
// @ts-nocheck

/**
 * GitHub Issue Response Awaiter - sc monitor await
 * Polls GitHub issue for responses with configurable timeout and retries
 * 
 * Usage:
 *   sc monitor await --issue 22 --interval 2m --timeout 30m --retries 3
 * 
 * Exit codes:
 *   0 - Response received
 *   1 - Timeout (max retries exhausted)
 *   2 - Error
 */

const { execSync } = require('node:child_process');
const chalk = require('chalk');

class IssueAwaiter {
  attempts: any;
  interval: any;
  issue: any;
  lastCommentId: any;
  maxRetries: any;
  timeout: any;
  constructor(options = {}) {
    this.issue = options.issue;
    this.interval = this.parseTimeMs(options.interval || '2m');
    this.timeout = this.parseTimeMs(options.timeout || '30m');
    this.maxRetries = options.retries || 3;
    this.lastCommentId = null;
    this.attempts = 0;
  }

  /**
   * Parse time string (e.g., "2m", "30m", "1h") to milliseconds
   */
  parseTimeMs(timeStr) {
    if (typeof timeStr === 'number') return timeStr;
    
    const match = timeStr.match(/^(\d+)([smh])$/);
    if (!match) {
      throw new Error(`Invalid time format: ${timeStr}. Use format: 2m, 30m, 1h`);
    }
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    const units = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000
    };
    
    return value * units[unit];
  }

  /**
   * Format milliseconds to human-readable time
   */
  formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Check if GitHub CLI is available and authenticated
   */
  checkGhCli() {
    try {
      execSync('gh auth status', { stdio: 'ignore' });
      return true;
    } catch (_error) {
      console.log(chalk.red('❌ GitHub CLI not authenticated'));
      console.log(chalk.yellow('💡 Run: gh auth login'));
      return false;
    }
  }

  /**
   * Get all comments for the issue
   */
  getComments() {
    try {
      const output = execSync(
        `gh issue view ${this.issue} --json comments --jq '.comments[] | {id: .id, author: .author.login, body: .body, createdAt: .createdAt}'`,
        { encoding: 'utf8' }
      );
      
      if (!output.trim()) return [];
      
      const comments = output.trim().split('\n').map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      return comments;
    } catch (error) {
      throw new Error(`Failed to fetch comments: ${error.message}`);
    }
  }

  /**
   * Check for new comments since last check
   */
  checkForNewComments() {
    const comments = this.getComments();
    
    if (comments.length === 0) {
      return null;
    }
    
    // First run - store the most recent comment ID
    if (this.lastCommentId === null) {
      this.lastCommentId = comments[comments.length - 1].id;
      console.log(chalk.gray(`   Tracking from comment ID: ${this.lastCommentId}`));
      return null;
    }
    
    // Find new comments after the last tracked comment
    const lastIndex = comments.findIndex(c => c.id === this.lastCommentId);
    
    if (lastIndex === -1) {
      // Last comment ID not found - assume all are new
      console.log(chalk.yellow('   ⚠️  Comment history changed, checking all comments'));
      return comments;
    }
    
    const newComments = comments.slice(lastIndex + 1);
    
    if (newComments.length > 0) {
      // Update last comment ID
      this.lastCommentId = comments[comments.length - 1].id;
      return newComments;
    }
    
    return null;
  }

  /**
   * Detect if a comment is a response from Cursor or relevant party
   */
  isResponse(comment) {
    // Check if comment contains code blocks (typical of Cursor responses)
    const hasCodeBlock = /```[\s\S]*?```/.test(comment.body);
    
    // Check if comment mentions implementation or changes
    const hasImplementationKeywords = /(implement|fix|change|update|add|create|modify)/i.test(comment.body);
    
    // Check if it's from an agent/bot or specific user
    const isFromAgent = comment.author.toLowerCase().includes('cursor') || 
                       comment.author.toLowerCase().includes('bot');
    
    return hasCodeBlock || hasImplementationKeywords || isFromAgent;
  }

  /**
   * Add a re-ping comment to the issue
   */
  async addRePingComment() {
    try {
      const message = `@cursor Awaiting response (attempt ${this.attempts}/${this.maxRetries})`;
      execSync(
        `gh issue comment ${this.issue} --body "${message}"`,
        { stdio: 'pipe' }
      );
      console.log(chalk.yellow(`   📌 Re-pinged with comment`));
    } catch (error) {
      console.log(chalk.yellow(`   ⚠️  Failed to add re-ping comment: ${error.message}`));
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main await loop
   */
  async await() {
    if (!this.checkGhCli()) {
      return { status: 'error', message: 'GitHub CLI not available', exitCode: 2 };
    }
    
    console.log(chalk.blue('\n🔍 Awaiting response on GitHub issue'));
    console.log(chalk.gray(`   Issue: #${this.issue}`));
    console.log(chalk.gray(`   Poll interval: ${this.formatTime(this.interval)}`));
    console.log(chalk.gray(`   Timeout: ${this.formatTime(this.timeout)}`));
    console.log(chalk.gray(`   Max retries: ${this.maxRetries}`));
    console.log('');
    
    // Initialize by getting current comments
    try {
      this.checkForNewComments();
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
      return { status: 'error', message: error.message, exitCode: 2 };
    }
    
    while (this.attempts < this.maxRetries) {
      const attemptStartTime = Date.now();
      let pollCount = 0;
      
      console.log(chalk.cyan(`\n📊 Attempt ${this.attempts + 1}/${this.maxRetries}`));
      
      while (Date.now() - attemptStartTime < this.timeout) {
        const elapsed = Date.now() - attemptStartTime;
        const remaining = this.timeout - elapsed;
        
        pollCount++;
        process.stdout.write(
          chalk.gray(`\r   Polling... (${pollCount} checks, ${this.formatTime(remaining)} remaining)`)
        );
        
        try {
          const newComments = this.checkForNewComments();
          
          if (newComments && newComments.length > 0) {
            process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
            
            console.log(chalk.green(`\n✅ New comments detected (${newComments.length})`));
            
            // Check if any comment is a valid response
            const responses = newComments.filter(c => this.isResponse(c));
            
            if (responses.length > 0) {
              console.log(chalk.green(`\n🎉 Response received!`));
              console.log('');
              
              responses.forEach((response, idx) => {
                console.log(chalk.cyan(`   Response ${idx + 1} from @${response.author}:`));
                console.log(chalk.gray(`   Created: ${new Date(response.createdAt).toLocaleString()}`));
                
                // Show preview of response (first 200 chars)
                const preview = response.body.substring(0, 200).replace(/\n/g, ' ');
                console.log(chalk.white(`   Preview: ${preview}${response.body.length > 200 ? '...' : ''}`));
                console.log('');
              });
              
              return { 
                status: 'success', 
                responses, 
                attempts: this.attempts + 1,
                exitCode: 0 
              };
            } else {
              console.log(chalk.yellow('   Comments detected but not identified as responses'));
              console.log(chalk.gray('   Continuing to await...'));
            }
          }
        } catch (error) {
          process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
          console.log(chalk.red(`\n   ❌ Error checking comments: ${error.message}`));
          console.log(chalk.gray('   Retrying...'));
        }
        
        await this.sleep(this.interval);
      }
      
      // Timeout for this attempt
      process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
      
      this.attempts++;
      console.log(chalk.yellow(`\n   ⏰ Timeout reached for attempt ${this.attempts}`));
      
      if (this.attempts < this.maxRetries) {
        await this.addRePingComment();
        console.log(chalk.gray(`   Starting next attempt...\n`));
      }
    }
    
    // Max retries exhausted
    console.log(chalk.red(`\n❌ Max retries exhausted (${this.maxRetries})`));
    console.log(chalk.yellow('💡 No response received within timeout period'));
    
    return { 
      status: 'timeout', 
      attempts: this.attempts,
      exitCode: 1 
    };
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const options = {
    issue: null,
    interval: '2m',
    timeout: '30m',
    retries: 3
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--issue' && args[i + 1]) {
      options.issue = args[++i];
    } else if (arg === '--interval' && args[i + 1]) {
      options.interval = args[++i];
    } else if (arg === '--timeout' && args[i + 1]) {
      options.timeout = args[++i];
    } else if (arg === '--retries' && args[i + 1]) {
      options.retries = parseInt(args[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      console.log(chalk.blue('sc monitor await - Await GitHub issue responses'));
      console.log('');
      console.log(chalk.cyan('Usage:'));
      console.log('  sc monitor await --issue <number> [options]');
      console.log('');
      console.log(chalk.cyan('Options:'));
      console.log('  --issue <number>    GitHub issue number (required)');
      console.log('  --interval <time>   Polling interval (default: 2m)');
      console.log('  --timeout <time>    Timeout per attempt (default: 30m)');
      console.log('  --retries <number>  Max retry attempts (default: 3)');
      console.log('');
      console.log(chalk.cyan('Time format:'));
      console.log('  2m  - 2 minutes');
      console.log('  30m - 30 minutes');
      console.log('  1h  - 1 hour');
      console.log('');
      console.log(chalk.cyan('Exit codes:'));
      console.log('  0 - Response received');
      console.log('  1 - Timeout (max retries exhausted)');
      console.log('  2 - Error');
      console.log('');
      console.log(chalk.cyan('Examples:'));
      console.log('  sc monitor await --issue 22');
      console.log('  sc monitor await --issue 22 --interval 1m --timeout 15m');
      console.log('  sc monitor await --issue 22 --retries 5');
      console.log('');
      return 0;
    }
  }
  
  if (!options.issue) {
    console.log(chalk.red('❌ Error: --issue is required'));
    console.log(chalk.yellow('💡 Run: sc monitor await --help'));
    return 2;
  }
  
  const awaiter = new IssueAwaiter(options);
  const result = await awaiter.await();
  
  return result.exitCode;
}

// Export for testing and module usage
module.exports = { IssueAwaiter, main };

// Run if called directly
if (require.main === module) {
  main().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error(chalk.red('❌ Fatal error:'), error.message);
    process.exit(2);
  });
}
