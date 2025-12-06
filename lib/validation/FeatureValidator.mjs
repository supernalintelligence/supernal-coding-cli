/**
 * ES Module wrapper for FeatureValidator
 * Allows Next.js to import the CommonJS module properly
 */

import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const FeatureValidator = require('./FeatureValidator.js');

export default FeatureValidator;
