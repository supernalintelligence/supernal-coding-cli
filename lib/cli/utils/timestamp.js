#!/usr/bin/env node

/**
 * Timestamp Utility
 * Provides consistent YYYY-MM-DD-HH-MM timestamp formatting
 * for all template creators and file naming conventions
 */

/**
 * Generate standardized timestamp in YYYY-MM-DD-HH-MM format
 * @param {Date|string|number} customTimestamp - Optional custom timestamp (defaults to now)
 * @returns {string} Formatted timestamp string
 */
function generateTimestamp(customTimestamp = null) {
  const now = customTimestamp ? new Date(customTimestamp) : new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}-${hours}-${minutes}`;
}

/**
 * Generate standard date-only format (YYYY-MM-DD)
 * @param {Date|string|number} customTimestamp - Optional custom timestamp (defaults to now)
 * @returns {string} Formatted date string
 */
function generateDateOnly(customTimestamp = null) {
  const now = customTimestamp ? new Date(customTimestamp) : new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Validate timestamp format against YYYY-MM-DD-HH-MM pattern
 * @param {string} timestamp - Timestamp string to validate
 * @returns {boolean} True if valid format
 */
function validateTimestampFormat(timestamp) {
  const pattern = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/;
  return pattern.test(timestamp);
}

/**
 * Generate filename with proper timestamp prefix
 * @param {string} baseName - Base name for the file (without extension)
 * @param {string} extension - File extension (e.g., 'md', 'txt')
 * @param {Date|string|number} customTimestamp - Optional custom timestamp
 * @returns {string} Formatted filename with timestamp prefix
 */
function generateTimestampedFilename(
  baseName,
  extension = 'md',
  customTimestamp = null
) {
  const timestamp = generateTimestamp(customTimestamp);
  const sanitizedBaseName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `${timestamp}-${sanitizedBaseName}.${extension}`;
}

/**
 * Parse timestamp from a timestamped filename
 * @param {string} filename - Filename with timestamp prefix
 * @returns {object} Object with timestamp, baseName, and extension
 */
function parseTimestampedFilename(filename) {
  const timestampPattern = /^(\d{4}-\d{2}-\d{2}-\d{2}-\d{2})-(.+)\.(.+)$/;
  const match = filename.match(timestampPattern);

  if (!match) {
    return {
      timestamp: null,
      baseName: filename,
      extension: '',
      isValid: false
    };
  }

  return {
    timestamp: match[1],
    baseName: match[2],
    extension: match[3],
    isValid: true
  };
}

module.exports = {
  generateTimestamp,
  generateDateOnly,
  validateTimestampFormat,
  generateTimestampedFilename,
  parseTimestampedFilename
};

// CLI usage for testing
if (require.main === module) {
  console.log('Current timestamp:', generateTimestamp());
  console.log('Date only:', generateDateOnly());
  console.log(
    'Timestamped filename:',
    generateTimestampedFilename('test-handoff')
  );
  console.log('Validation test:', validateTimestampFormat('2025-01-20-14-30'));
}
