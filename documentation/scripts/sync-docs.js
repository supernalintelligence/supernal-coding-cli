#!/usr/bin/env node
/**
 * Sync external documentation into Docusaurus
 * 
 * This script copies documentation from:
 * - Compliance Cards (frameworks)
 * - SOPs (Standard Operating Procedures)
 * 
 * Run: node scripts/sync-docs.js
 * Or: npm run docs:sync
 */

const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

// Paths relative to documentation directory
const DOCS_ROOT = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(DOCS_ROOT, '../..');

// Source locations
const SOURCES = {
  compliance: {
    src: path.join(MONOREPO_ROOT, 'standalone/compliance-cards/frameworks'),
    dest: path.join(DOCS_ROOT, 'docs/compliance'),
    category: 'Compliance Frameworks',
    description: 'Compliance card templates for regulatory frameworks',
  },
  sops: {
    src: path.join(MONOREPO_ROOT, 'docs/workflow/sops'),
    dest: path.join(DOCS_ROOT, 'docs/sops'),
    category: 'Standard Operating Procedures',
    description: 'AI-accelerated development workflow SOPs',
  },
  guides: {
    src: path.join(MONOREPO_ROOT, 'docs/guides'),
    dest: path.join(DOCS_ROOT, 'docs/guides'),
    category: 'Guides',
    description: 'How-to guides, tutorials, and best practices',
  },
};

/**
 * Create a category index file for Docusaurus
 */
function createCategoryIndex(destDir, category, description, items) {
  const indexContent = `---
sidebar_position: 1
title: ${category}
description: ${description}
---

# ${category}

${description}

## Available Documents

${items.map(item => `- [${item.title}](./${item.slug})`).join('\n')}
`;
  
  fs.writeFileSync(path.join(destDir, 'index.md'), indexContent);
}

/**
 * Create a _category_.json for Docusaurus sidebar
 */
function createCategoryJson(destDir, label, position) {
  const categoryJson = {
    label,
    position,
    collapsible: true,
    collapsed: true,
    link: {
      type: 'generated-index',
      description: `Browse ${label.toLowerCase()} documentation`,
    },
  };
  
  fs.writeFileSync(
    path.join(destDir, '_category_.json'),
    JSON.stringify(categoryJson, null, 2)
  );
}

/**
 * Process markdown file - add frontmatter if missing
 */
function processMarkdown(content, filename, category) {
  // Check if frontmatter exists
  if (content.startsWith('---')) {
    return content;
  }
  
  // Extract title from first heading or filename
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : filename.replace(/\.md$/, '').replace(/-/g, ' ');
  
  // Add frontmatter
  const frontmatter = `---
title: "${title}"
sidebar_label: "${title}"
---

`;
  
  return frontmatter + content;
}

/**
 * Sync compliance frameworks
 */
async function syncCompliance() {
  const { src, dest, category, description } = SOURCES.compliance;
  
  if (!fs.existsSync(src)) {
    console.log(`⚠️  Compliance source not found: ${src}`);
    return;
  }
  
  console.log(`📦 Syncing compliance frameworks from ${src}`);
  
  // Clean and recreate dest
  fs.emptyDirSync(dest);
  
  // Get all framework directories
  const frameworks = fs.readdirSync(src).filter(f => 
    fs.statSync(path.join(src, f)).isDirectory()
  );
  
  const items = [];
  let position = 2;
  
  for (const framework of frameworks) {
    const frameworkSrc = path.join(src, framework);
    const frameworkDest = path.join(dest, framework);
    
    fs.ensureDirSync(frameworkDest);
    
    // Copy all markdown files
    const mdFiles = glob.sync('**/*.md', { cwd: frameworkSrc });
    
    for (const mdFile of mdFiles) {
      const srcFile = path.join(frameworkSrc, mdFile);
      const destFile = path.join(frameworkDest, mdFile);
      
      fs.ensureDirSync(path.dirname(destFile));
      
      let content = fs.readFileSync(srcFile, 'utf8');
      content = processMarkdown(content, mdFile, framework);
      fs.writeFileSync(destFile, content);
    }
    
    // Create category for this framework
    const frameworkLabel = framework.toUpperCase().replace(/(\d+)/g, ' $1').trim();
    createCategoryJson(frameworkDest, frameworkLabel, position++);
    
    items.push({
      title: frameworkLabel,
      slug: framework,
    });
    
    console.log(`  ✓ ${frameworkLabel}`);
  }
  
  // Create main category
  createCategoryJson(dest, category, 2);
  
  console.log(`✅ Synced ${frameworks.length} compliance frameworks`);
}

/**
 * Sync SOPs
 */
async function syncSOPs() {
  const { src, dest, category, description } = SOURCES.sops;
  
  if (!fs.existsSync(src)) {
    console.log(`⚠️  SOPs source not found: ${src}`);
    return;
  }
  
  console.log(`📦 Syncing SOPs from ${src}`);
  
  // Clean and recreate dest
  fs.emptyDirSync(dest);
  
  const items = [];
  let position = 2;
  
  // Copy top-level SOPs
  const topLevelMd = glob.sync('*.md', { cwd: src });
  for (const mdFile of topLevelMd) {
    const srcFile = path.join(src, mdFile);
    const destFile = path.join(dest, mdFile);
    
    let content = fs.readFileSync(srcFile, 'utf8');
    content = processMarkdown(content, mdFile, 'SOPs');
    fs.writeFileSync(destFile, content);
    
    const title = mdFile.replace(/\.md$/, '').replace(/-/g, ' ');
    items.push({ title, slug: mdFile.replace(/\.md$/, '') });
    console.log(`  ✓ ${mdFile}`);
  }
  
  // Get all subdirectories (general, phase-*, etc.)
  const subdirs = fs.readdirSync(src).filter(f => 
    fs.statSync(path.join(src, f)).isDirectory() && !f.startsWith('archived')
  );
  
  for (const subdir of subdirs) {
    const subdirSrc = path.join(src, subdir);
    const subdirDest = path.join(dest, subdir);
    
    fs.ensureDirSync(subdirDest);
    
    // Copy all markdown files
    const mdFiles = glob.sync('**/*.md', { cwd: subdirSrc });
    
    for (const mdFile of mdFiles) {
      const srcFile = path.join(subdirSrc, mdFile);
      const destFile = path.join(subdirDest, mdFile);
      
      fs.ensureDirSync(path.dirname(destFile));
      
      let content = fs.readFileSync(srcFile, 'utf8');
      content = processMarkdown(content, mdFile, subdir);
      fs.writeFileSync(destFile, content);
    }
    
    // Create category for this subdir
    const subdirLabel = subdir
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    createCategoryJson(subdirDest, subdirLabel, position++);
    
    console.log(`  ✓ ${subdirLabel} (${mdFiles.length} files)`);
  }
  
  // Create main category
  createCategoryJson(dest, category, 3);
  
  console.log(`✅ Synced SOPs`);
}

/**
 * Sync Guides
 */
async function syncGuides() {
  const { src, dest, category, description } = SOURCES.guides;
  
  if (!fs.existsSync(src)) {
    console.log(`⚠️  Guides source not found: ${src}`);
    return;
  }
  
  console.log(`📦 Syncing guides from ${src}`);
  
  // Clean and recreate dest
  fs.emptyDirSync(dest);
  
  let fileCount = 0;
  let position = 2;
  
  // Copy top-level guide files (excluding internal/maintenance docs)
  const excludePatterns = [
    'BROKEN_LINKS',     // Internal maintenance docs
    'fixing-broken',    // Internal maintenance docs
    'approval-workflow', // Internal process docs
    '.',                // Hidden files
  ];
  
  const topLevelMd = glob.sync('*.md', { cwd: src }).filter(f => 
    !excludePatterns.some(pattern => f.toLowerCase().startsWith(pattern.toLowerCase()))
  );
  
  for (const mdFile of topLevelMd) {
    const srcFile = path.join(src, mdFile);
    const destFile = path.join(dest, mdFile);
    
    let content = fs.readFileSync(srcFile, 'utf8');
    content = processMarkdown(content, mdFile, 'Guides');
    fs.writeFileSync(destFile, content);
    fileCount++;
  }
  console.log(`  ✓ ${topLevelMd.length} top-level guides`);
  
  // Get all subdirectories
  const subdirs = fs.readdirSync(src).filter(f => 
    fs.statSync(path.join(src, f)).isDirectory() && 
    !f.startsWith('.') &&
    f !== 'cli-commands'  // CLI commands are auto-generated separately
  );
  
  for (const subdir of subdirs) {
    const subdirSrc = path.join(src, subdir);
    const subdirDest = path.join(dest, subdir);
    
    fs.ensureDirSync(subdirDest);
    
    // Copy all markdown files
    const mdFiles = glob.sync('**/*.md', { cwd: subdirSrc });
    
    for (const mdFile of mdFiles) {
      const srcFile = path.join(subdirSrc, mdFile);
      const destFile = path.join(subdirDest, mdFile);
      
      fs.ensureDirSync(path.dirname(destFile));
      
      let content = fs.readFileSync(srcFile, 'utf8');
      content = processMarkdown(content, mdFile, subdir);
      fs.writeFileSync(destFile, content);
      fileCount++;
    }
    
    // Create category for this subdir
    const subdirLabel = subdir
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    createCategoryJson(subdirDest, subdirLabel, position++);
    
    console.log(`  ✓ ${subdirLabel} (${mdFiles.length} files)`);
  }
  
  // Create main category (position 1 = first in sidebar)
  createCategoryJson(dest, category, 1);
  
  console.log(`✅ Synced ${fileCount} guide files`);
}

/**
 * Main sync function
 */
async function main() {
  console.log('🔄 Syncing external documentation...\n');
  
  try {
    await syncGuides();
    console.log('');
    await syncCompliance();
    console.log('');
    await syncSOPs();
    console.log('\n✨ Documentation sync complete!');
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
}

main();

