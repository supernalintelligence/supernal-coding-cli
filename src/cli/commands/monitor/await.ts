import { execSync } from 'node:child_process';
import chalk from 'chalk';

interface AwaiterOptions {
  issue: string | number;
  interval?: string | number;
  timeout?: string | number;
  retries?: number;
}

interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

interface AwaitResult {
  status: 'success' | 'timeout' | 'error';
  message?: string;
  responses?: Comment[];
  attempts?: number;
  exitCode: number;
}

class IssueAwaiter {
  protected attempts: number;
  protected interval: number;
  protected issue: string | number;
  protected lastCommentId: string | null;
  protected maxRetries: number;
  protected timeout: number;

  constructor(options: AwaiterOptions) {
    this.issue = options.issue;
    this.interval = this.parseTimeMs(options.interval || '2m');
    this.timeout = this.parseTimeMs(options.timeout || '30m');
    this.maxRetries = options.retries || 3;
    this.lastCommentId = null;
    this.attempts = 0;
  }

  parseTimeMs(timeStr: string | number): number {
    if (typeof timeStr === 'number') return timeStr;
    
    const match = timeStr.match(/^(\d+)([smh])$/);
    if (!match) {
      throw new Error(`Invalid time format: ${timeStr}. Use format: 2m, 30m, 1h`);
    }
    
    const value = parseInt(match[1], 10);
    const unit = match[2] as 's' | 'm' | 'h';
    
    const units: Record<'s' | 'm' | 'h', number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000
    };
    
    return value * units[unit];
  }

  formatTime(ms: number): string {
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

  checkGhCli(): boolean {
    try {
      execSync('gh auth status', { stdio: 'ignore' });
      return true;
    } catch (_error) {
      console.log(chalk.red('[ERROR] GitHub CLI not authenticated'));
      console.log(chalk.yellow('Run: gh auth login'));
      return false;
    }
  }

  getComments(): Comment[] {
    try {
      const output = execSync(
        `gh issue view ${this.issue} --json comments --jq '.comments[] | {id: .id, author: .author.login, body: .body, createdAt: .createdAt}'`,
        { encoding: 'utf8' }
      );
      
      if (!output.trim()) return [];
      
      const comments = output.trim().split('\n').map(line => {
        try {
          return JSON.parse(line) as Comment;
        } catch {
          return null;
        }
      }).filter((c): c is Comment => c !== null);
      
      return comments;
    } catch (error) {
      throw new Error(`Failed to fetch comments: ${(error as Error).message}`);
    }
  }

  checkForNewComments(): Comment[] | null {
    const comments = this.getComments();
    
    if (comments.length === 0) {
      return null;
    }
    
    if (this.lastCommentId === null) {
      this.lastCommentId = comments[comments.length - 1].id;
      console.log(chalk.gray(`   Tracking from comment ID: ${this.lastCommentId}`));
      return null;
    }
    
    const lastIndex = comments.findIndex(c => c.id === this.lastCommentId);
    
    if (lastIndex === -1) {
      console.log(chalk.yellow('   [WARN] Comment history changed, checking all comments'));
      return comments;
    }
    
    const newComments = comments.slice(lastIndex + 1);
    
    if (newComments.length > 0) {
      this.lastCommentId = comments[comments.length - 1].id;
      return newComments;
    }
    
    return null;
  }

  isResponse(comment: Comment): boolean {
    const hasCodeBlock = /```[\s\S]*?```/.test(comment.body);
    const hasImplementationKeywords = /(implement|fix|change|update|add|create|modify)/i.test(comment.body);
    const isFromAgent = comment.author.toLowerCase().includes('cursor') || 
                       comment.author.toLowerCase().includes('bot');
    
    return hasCodeBlock || hasImplementationKeywords || isFromAgent;
  }

  async addRePingComment(): Promise<void> {
    try {
      const message = `@cursor Awaiting response (attempt ${this.attempts}/${this.maxRetries})`;
      execSync(
        `gh issue comment ${this.issue} --body "${message}"`,
        { stdio: 'pipe' }
      );
      console.log(chalk.yellow(`   Re-pinged with comment`));
    } catch (error) {
      console.log(chalk.yellow(`   [WARN] Failed to add re-ping comment: ${(error as Error).message}`));
    }
  }

  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async await(): Promise<AwaitResult> {
    if (!this.checkGhCli()) {
      return { status: 'error', message: 'GitHub CLI not available', exitCode: 2 };
    }
    
    console.log(chalk.blue('\nAwaiting response on GitHub issue'));
    console.log(chalk.gray(`   Issue: #${this.issue}`));
    console.log(chalk.gray(`   Poll interval: ${this.formatTime(this.interval)}`));
    console.log(chalk.gray(`   Timeout: ${this.formatTime(this.timeout)}`));
    console.log(chalk.gray(`   Max retries: ${this.maxRetries}`));
    console.log('');
    
    try {
      this.checkForNewComments();
    } catch (error) {
      console.log(chalk.red(`[ERROR] ${(error as Error).message}`));
      return { status: 'error', message: (error as Error).message, exitCode: 2 };
    }
    
    while (this.attempts < this.maxRetries) {
      const attemptStartTime = Date.now();
      let pollCount = 0;
      
      console.log(chalk.cyan(`\nAttempt ${this.attempts + 1}/${this.maxRetries}`));
      
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
            process.stdout.write('\r' + ' '.repeat(80) + '\r');
            
            console.log(chalk.green(`\n[OK] New comments detected (${newComments.length})`));
            
            const responses = newComments.filter(c => this.isResponse(c));
            
            if (responses.length > 0) {
              console.log(chalk.green(`\n[OK] Response received!`));
              console.log('');
              
              responses.forEach((response, idx) => {
                console.log(chalk.cyan(`   Response ${idx + 1} from @${response.author}:`));
                console.log(chalk.gray(`   Created: ${new Date(response.createdAt).toLocaleString()}`));
                
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
          process.stdout.write('\r' + ' '.repeat(80) + '\r');
          console.log(chalk.red(`\n   [ERROR] Error checking comments: ${(error as Error).message}`));
          console.log(chalk.gray('   Retrying...'));
        }
        
        await this.sleep(this.interval);
      }
      
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      
      this.attempts++;
      console.log(chalk.yellow(`\n   Timeout reached for attempt ${this.attempts}`));
      
      if (this.attempts < this.maxRetries) {
        await this.addRePingComment();
        console.log(chalk.gray(`   Starting next attempt...\n`));
      }
    }
    
    console.log(chalk.red(`\n[ERROR] Max retries exhausted (${this.maxRetries})`));
    console.log(chalk.yellow('No response received within timeout period'));
    
    return { 
      status: 'timeout', 
      attempts: this.attempts,
      exitCode: 1 
    };
  }
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  
  const options: AwaiterOptions = {
    issue: '',
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
    console.log(chalk.red('[ERROR] --issue is required'));
    console.log(chalk.yellow('Run: sc monitor await --help'));
    return 2;
  }
  
  const awaiter = new IssueAwaiter(options);
  const result = await awaiter.await();
  
  return result.exitCode;
}

export { IssueAwaiter, main };
module.exports = { IssueAwaiter, main };

if (require.main === module) {
  main().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error(chalk.red('[FATAL]'), (error as Error).message);
    process.exit(2);
  });
}
