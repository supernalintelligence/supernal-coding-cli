/**
 * Type definitions for requirement parsing
 * @module requirements/types
 */

/**
 * @typedef {'Low' | 'Medium' | 'High' | 'Critical'} Priority
 */

/**
 * @typedef {'discovery' | 'foundation' | 'implementation' | 'integration' | 'release'} Phase
 */

/**
 * @typedef {'evidence' | 'problem' | 'story' | 'functional-requirement' | 'technical-requirement' | 'component' | 'architecture' | 'test' | 'monitoring' | 'verification' | 'compliance' | 'kanban'} RequirementType
 */

/**
 * @typedef {Object} Requirement
 * @property {string} id - Unique identifier
 * @property {string} title - Requirement title
 * @property {string} [description] - Brief description
 * @property {string} category - Category/folder name
 * @property {Priority} priority - Priority level
 * @property {number} priorityScore - Numeric priority score
 * @property {string} status - Current status
 * @property {Phase} phase - Development phase
 * @property {string} pattern - Pattern type (e.g., 'feature', 'bugfix')
 * @property {RequirementType} type - Requirement type
 * @property {string} filePath - Path to the requirement file
 * @property {string[]} [dependencies] - IDs of dependent requirements
 * @property {string} [epic] - Epic this requirement belongs to
 * @property {string} [assignee] - Assigned person
 * @property {string} [version] - Version
 * @property {string[]} [tags] - Tags
 * @property {string} [created] - Creation date
 * @property {string} [updated] - Last update date
 * @property {string} [reviewedBy] - Reviewer
 * @property {string} [approvedBy] - Approver
 * @property {'Low' | 'Medium' | 'High'} [riskLevel] - Risk level
 * @property {string[]} [complianceStandards] - Compliance standards
 */

/**
 * @typedef {Object} PhaseStats
 * @property {number} total - Total count
 * @property {number} completed - Completed count
 * @property {number} inProgress - In-progress count
 * @property {number} pending - Pending count
 * @property {number} progress - Progress percentage
 */

/**
 * @typedef {Object} PhasesData
 * @property {Object.<RequirementType, Requirement[]>} groups - Requirements grouped by type
 * @property {Object.<RequirementType, PhaseStats>} stats - Statistics by type
 * @property {number} totalRequirements - Total requirement count
 */

module.exports = {
  // Type definitions are exported for documentation purposes
  // Actual types are available via JSDoc comments
};
