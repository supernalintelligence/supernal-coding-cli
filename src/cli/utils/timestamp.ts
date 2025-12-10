/**
 * Timestamp Utility
 * Provides consistent YYYY-MM-DD-HH-MM timestamp formatting
 * for all template creators and file naming conventions
 */

type TimestampInput = Date | string | number | null;

interface ParsedFilename {
  timestamp: string | null;
  baseName: string;
  extension: string;
  isValid: boolean;
}

/**
 * Generate standardized timestamp in YYYY-MM-DD-HH-MM format
 */
function generateTimestamp(customTimestamp: TimestampInput = null): string {
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
 */
function generateDateOnly(customTimestamp: TimestampInput = null): string {
  const now = customTimestamp ? new Date(customTimestamp) : new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Validate timestamp format against YYYY-MM-DD-HH-MM pattern
 */
function validateTimestampFormat(timestamp: string): boolean {
  const pattern = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/;
  return pattern.test(timestamp);
}

/**
 * Generate filename with proper timestamp prefix
 */
function generateTimestampedFilename(
  baseName: string,
  extension: string = 'md',
  customTimestamp: TimestampInput = null
): string {
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
 */
function parseTimestampedFilename(filename: string): ParsedFilename {
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

export {
  generateTimestamp,
  generateDateOnly,
  validateTimestampFormat,
  generateTimestampedFilename,
  parseTimestampedFilename
};

module.exports = {
  generateTimestamp,
  generateDateOnly,
  validateTimestampFormat,
  generateTimestampedFilename,
  parseTimestampedFilename
};

if (require.main === module) {
  console.log('Current timestamp:', generateTimestamp());
  console.log('Date only:', generateDateOnly());
  console.log(
    'Timestamped filename:',
    generateTimestampedFilename('test-handoff')
  );
  console.log('Validation test:', validateTimestampFormat('2025-01-20-14-30'));
}
