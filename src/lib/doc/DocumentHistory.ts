const { execSync } = require('node:child_process');
const chalk = require('chalk');
const fs = require('node:fs');

class DocumentHistory {
  async show(file, options) {
    // Validate file exists
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`File not found: ${file}`));
      process.exit(1);
    }

    const commits = this.getCommits(file, options);

    if (commits.length === 0) {
      console.log(chalk.yellow('No git history for this file'));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(commits, null, 2));
    } else {
      this.displayTable(commits, file);
    }
  }

  getCommits(file, options) {
    let cmd = `git log --follow --format="%H|%ai|%an|%ae|%s|%G?"`;

    if (options.since) cmd += ` --since="${options.since}"`;
    if (options.author) cmd += ` --author="${options.author}"`;
    if (options.limit) cmd += ` -n ${options.limit}`;

    cmd += ` -- "${file}"`;

    try {
      const result = execSync(cmd, { encoding: 'utf8' });
      const lines = result.trim().split('\n').filter(Boolean);

      let commits = lines.map((line) => {
        const [hash, date, author, email, subject, sigStatus] = line.split('|');
        return {
          hash,
          date: date.split(' ')[0],
          author,
          email,
          subject,
          signed: sigStatus === 'G' || sigStatus === 'U'
        };
      });

      if (options.signedOnly) {
        commits = commits.filter((c) => c.signed);
      }

      return commits;
    } catch (_e) {
      return [];
    }
  }

  displayTable(commits, file) {
    console.log(chalk.bold(`\nCHANGE HISTORY: ${file}\n`));
    console.log('─'.repeat(80));
    console.log(
      chalk.gray('Date'.padEnd(12)) +
        chalk.gray('Author'.padEnd(20)) +
        chalk.gray('Sig'.padEnd(6)) +
        chalk.gray('Subject')
    );
    console.log('─'.repeat(80));

    for (const c of commits) {
      const sigIcon = c.signed ? chalk.green('✓') : chalk.gray('✗');
      console.log(
        chalk.white(c.date.padEnd(12)) +
          chalk.cyan(c.author.substring(0, 18).padEnd(20)) +
          sigIcon.padEnd(6) +
          chalk.white(c.subject.substring(0, 40))
      );
    }
    console.log('─'.repeat(80));
    console.log(chalk.gray(`${commits.length} commits shown`));
  }
}

module.exports = DocumentHistory;
