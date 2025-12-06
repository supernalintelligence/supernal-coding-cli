/**
 * Template Similarity Detector for Compliance Documents
 *
 * Detects whether compliance documents are still generic templates
 * or have been customized with project-specific content.
 *
 * Used to validate compliance coverage and identify documents
 * needing customization.
 */

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');

/**
 * Generic template indicators - phrases that suggest uncustomized content
 */
const TEMPLATE_INDICATORS = [
  // Generic implementation phrases
  'Define specific technical and organizational measures',
  'Document procedures and work instructions',
  'Implement technical controls where applicable',
  'Train personnel on procedures',
  'Monitor control effectiveness',
  'Review and update regularly',

  // Generic placeholder text
  'Related controls will be identified during implementation',
  'comp-soc-XXX: Related SOC2 controls',
  'comp-gdpr-XXX: Related GDPR requirements',
  'comp-iso27001-XXX:',

  // Generic requirements
  'Control implementation procedures',
  'Technical configuration documentation',
  'Training records',
  'Compliance verification reports',
  'Review and update records',

  // Generic best practices
  'Follow ISO 27002 implementation guidance',
  'Align with organizational risk appetite',
  'Ensure management support',
  'Document thoroughly',

  // Generic pitfalls
  'Insufficient documentation',
  'Lack of personnel awareness',
  'Inadequate testing',
  'Missing evidence',
  'Infrequent reviews',

  // Generic status checklist (all unchecked)
  '- [ ] Control requirements analyzed',
  '- [ ] Implementation plan created',
  '- [ ] Technical controls deployed',
  '- [ ] Procedures documented',
  '- [ ] Personnel trained',
  '- [ ] Control effectiveness verified',
  '- [ ] Evidence collected'
];

/**
 * Customization indicators - content suggesting real implementation
 */
const CUSTOMIZATION_INDICATORS = [
  // Specific tooling/vendors
  /AWS|Azure|GCP|Splunk|ELK|CrowdStrike|Okta|Auth0/i,
  /GitHub|GitLab|Jenkins|CircleCI|Terraform|Ansible/i,

  // Specific technical implementations
  /AES-256-GCM|RSA-3072|TLS 1\.3|OAuth 2\.0|SAML/i,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, // IP addresses
  /https?:\/\/[a-z0-9.-]+/, // URLs

  // Project-specific names
  /our organization|our company|our system/i,

  // Completed checklist items
  /- \[x\]/,

  // Specific dates or versions
  /\d{4}-\d{2}-\d{2}/, // ISO dates
  /v\d+\.\d+\.\d+/, // Versions

  // Evidence references
  /evidence:|screenshot:|log:|audit:/i,

  // Real implementation notes
  /implemented|deployed|configured|tested/i
];

/**
 * Calculate similarity score between document and generic template
 *
 * @param {string} content - Document content
 * @returns {object} Analysis result
 */
function analyzeTemplateSimilarity(content) {
  const lines = content.split('\n');
  const totalLines = lines.length;

  let templateIndicatorCount = 0;
  let customizationIndicatorCount = 0;
  const foundTemplateIndicators = [];
  const foundCustomizationIndicators = [];

  // Count template indicators
  for (const indicator of TEMPLATE_INDICATORS) {
    if (content.includes(indicator)) {
      templateIndicatorCount++;
      foundTemplateIndicators.push(`${indicator.substring(0, 50)}...`);
    }
  }

  // Count customization indicators
  for (const indicator of CUSTOMIZATION_INDICATORS) {
    const matches =
      typeof indicator === 'string'
        ? content.includes(indicator)
        : indicator.test(content);

    if (matches) {
      customizationIndicatorCount++;
      foundCustomizationIndicators.push(
        typeof indicator === 'string' ? indicator : indicator.toString()
      );
    }
  }

  // Calculate scores
  const templateScore =
    (templateIndicatorCount / TEMPLATE_INDICATORS.length) * 100;
  const customizationScore =
    (customizationIndicatorCount / CUSTOMIZATION_INDICATORS.length) * 100;

  // Determine status
  let status = 'unknown';
  let confidence = 0;

  if (templateScore > 70) {
    status = 'generic-template';
    confidence = templateScore;
  } else if (customizationScore > 30) {
    status = 'customized';
    confidence = customizationScore;
  } else if (templateScore > 40) {
    status = 'partially-customized';
    confidence = 50;
  } else {
    status = 'needs-review';
    confidence = 0;
  }

  return {
    status,
    confidence: Math.round(confidence),
    metrics: {
      totalLines,
      templateIndicatorCount,
      customizationIndicatorCount,
      templateScore: Math.round(templateScore),
      customizationScore: Math.round(customizationScore)
    },
    indicators: {
      template: foundTemplateIndicators.slice(0, 5),
      customization: foundCustomizationIndicators.slice(0, 5)
    }
  };
}

/**
 * Validate a single compliance document
 *
 * @param {string} filePath - Path to compliance document
 * @returns {Promise<object>} Validation result
 */
async function validateComplianceDocument(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const analysis = analyzeTemplateSimilarity(content);

    // Extract metadata from frontmatter
    const idMatch = content.match(/^id:\s*(.+)$/m);
    const titleMatch = content.match(/^title:\s*(.+)$/m);

    return {
      filePath,
      id: idMatch ? idMatch[1].trim() : path.basename(filePath, '.md'),
      title: titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.md'),
      ...analysis,
      valid: true
    };
  } catch (error) {
    return {
      filePath,
      valid: false,
      error: error.message
    };
  }
}

/**
 * Validate all compliance documents in a framework
 *
 * @param {string} frameworkPath - Path to framework directory
 * @returns {Promise<object>} Framework validation results
 */
async function validateFramework(frameworkPath) {
  const framework = path.basename(frameworkPath);
  const templatesPath = path.join(frameworkPath, 'templates');

  if (!(await fs.pathExists(templatesPath))) {
    return {
      framework,
      error: 'Templates directory not found',
      documents: []
    };
  }

  const files = await fs.readdir(templatesPath);
  const mdFiles = files.filter(
    (f) => f.endsWith('.md') && f.startsWith('comp-')
  );

  const results = await Promise.all(
    mdFiles.map((file) =>
      validateComplianceDocument(path.join(templatesPath, file))
    )
  );

  // Calculate framework statistics
  const stats = {
    total: results.length,
    genericTemplate: results.filter((r) => r.status === 'generic-template')
      .length,
    partiallyCustomized: results.filter(
      (r) => r.status === 'partially-customized'
    ).length,
    customized: results.filter((r) => r.status === 'customized').length,
    needsReview: results.filter((r) => r.status === 'needs-review').length,
    avgConfidence: Math.round(
      results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length
    )
  };

  return {
    framework,
    stats,
    documents: results
  };
}

/**
 * Validate all compliance frameworks
 *
 * @param {string} complianceRoot - Root compliance directory
 * @returns {Promise<object>} Complete validation results
 */
async function validateAllFrameworks(
  complianceRoot = 'templates/compliance/frameworks'
) {
  const frameworksPath = path.resolve(complianceRoot);

  if (!(await fs.pathExists(frameworksPath))) {
    throw new Error(
      `Compliance frameworks directory not found: ${frameworksPath}`
    );
  }

  const frameworks = await fs.readdir(frameworksPath);
  const frameworkDirs = [];

  for (const fw of frameworks) {
    const fwPath = path.join(frameworksPath, fw);
    const stat = await fs.stat(fwPath);
    if (stat.isDirectory()) {
      frameworkDirs.push(fwPath);
    }
  }

  const results = await Promise.all(
    frameworkDirs.map((dir) => validateFramework(dir))
  );

  // Calculate overall statistics
  const overallStats = {
    totalFrameworks: results.length,
    totalDocuments: results.reduce((sum, r) => sum + r.stats.total, 0),
    genericTemplate: results.reduce(
      (sum, r) => sum + r.stats.genericTemplate,
      0
    ),
    partiallyCustomized: results.reduce(
      (sum, r) => sum + r.stats.partiallyCustomized,
      0
    ),
    customized: results.reduce((sum, r) => sum + r.stats.customized, 0),
    needsReview: results.reduce((sum, r) => sum + r.stats.needsReview, 0),
    customizationRate: 0
  };

  overallStats.customizationRate = Math.round(
    ((overallStats.customized + overallStats.partiallyCustomized) /
      overallStats.totalDocuments) *
      100
  );

  return {
    overall: overallStats,
    frameworks: results,
    timestamp: new Date().toISOString()
  };
}

/**
 * Display validation results
 *
 * @param {object} results - Validation results
 * @param {object} options - Display options
 */
function displayResults(results, options = {}) {
  console.log(chalk.bold('\n📊 Compliance Template Validation Results\n'));

  // Overall statistics
  console.log(chalk.bold('Overall Statistics:'));
  console.log(`  Total Frameworks: ${results.overall.totalFrameworks}`);
  console.log(`  Total Documents: ${results.overall.totalDocuments}`);
  console.log(`  Customization Rate: ${results.overall.customizationRate}%\n`);

  console.log(chalk.bold('Document Status:'));
  console.log(
    `  ${chalk.red('Generic Templates')}: ${results.overall.genericTemplate} (${Math.round((results.overall.genericTemplate / results.overall.totalDocuments) * 100)}%)`
  );
  console.log(
    `  ${chalk.yellow('Partially Customized')}: ${results.overall.partiallyCustomized} (${Math.round((results.overall.partiallyCustomized / results.overall.totalDocuments) * 100)}%)`
  );
  console.log(
    `  ${chalk.green('Customized')}: ${results.overall.customized} (${Math.round((results.overall.customized / results.overall.totalDocuments) * 100)}%)`
  );
  console.log(
    `  ${chalk.gray('Needs Review')}: ${results.overall.needsReview}\n`
  );

  // Framework breakdown
  console.log(chalk.bold('Framework Breakdown:\n'));

  for (const fw of results.frameworks) {
    const customizationRate = Math.round(
      ((fw.stats.customized + fw.stats.partiallyCustomized) / fw.stats.total) *
        100
    );

    const statusColor =
      customizationRate > 50
        ? chalk.green
        : customizationRate > 20
          ? chalk.yellow
          : chalk.red;

    console.log(`  ${chalk.bold(fw.framework)}: ${fw.stats.total} documents`);
    console.log(`    Customization: ${statusColor(`${customizationRate}%`)}`);
    console.log(
      `    Generic: ${fw.stats.genericTemplate}, Partial: ${fw.stats.partiallyCustomized}, Custom: ${fw.stats.customized}\n`
    );
  }

  // Show generic templates if requested
  if (options.showGeneric) {
    console.log(
      chalk.bold('\n🔍 Generic Templates Requiring Customization:\n')
    );

    for (const fw of results.frameworks) {
      const generic = fw.documents.filter(
        (d) => d.status === 'generic-template'
      );
      if (generic.length > 0) {
        console.log(chalk.yellow(`  ${fw.framework} (${generic.length}):`));
        generic.slice(0, options.limit || 10).forEach((doc) => {
          console.log(`    - ${doc.id}: ${doc.title}`);
        });
        if (generic.length > (options.limit || 10)) {
          console.log(
            `    ... and ${generic.length - (options.limit || 10)} more`
          );
        }
        console.log();
      }
    }
  }
}

/**
 * Save validation results to file
 *
 * @param {object} results - Validation results
 * @param {string} outputPath - Output file path
 */
async function saveResults(results, outputPath) {
  await fs.writeJson(outputPath, results, { spaces: 2 });
  console.log(chalk.green(`\n✅ Results saved to ${outputPath}`));
}

module.exports = {
  analyzeTemplateSimilarity,
  validateComplianceDocument,
  validateFramework,
  validateAllFrameworks,
  displayResults,
  saveResults,
  TEMPLATE_INDICATORS,
  CUSTOMIZATION_INDICATORS
};
