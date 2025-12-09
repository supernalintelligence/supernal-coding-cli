/**
 * Change Detection Module
 *
 * Provides unified hash-based change detection for:
 * - Rule changes
 * - File customizations
 * - CLI sync status
 * - Compliance validation
 * - iResource sync status
 *
 * All detectors extend FileChangeDetector base class.
 */

const { FileChangeDetector, HASH_ALGORITHM } = require('./FileChangeDetector');
const ComplianceValidator = require('./ComplianceValidator');

// Re-export classes
module.exports = {
  FileChangeDetector,
  ComplianceValidator,
  HASH_ALGORITHM
};

