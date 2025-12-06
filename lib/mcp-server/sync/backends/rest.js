/**
 * REST API Sync Backend
 *
 * Implements synchronization via REST API endpoints
 *
 * @module sync/backends/rest
 */

const https = require('node:https');
const http = require('node:http');
const { URL } = require('node:url');

class RestBackend {
  constructor(config) {
    this.config = config;
    this.endpoint = new URL(config.endpoint);
    this.apiKey = config.apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'SupernalCoding-MCP/1.0',
      ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      ...config.headers
    };
  }

  async initialize() {
    // Test connection
    try {
      await this.request('GET', '/health');
    } catch (error) {
      throw new Error(`Failed to connect to REST endpoint: ${error.message}`);
    }
  }

  async push(changes, force = false) {
    const response = await this.request('POST', '/sync/push', {
      changes,
      force,
      timestamp: new Date().toISOString()
    });

    return response;
  }

  async pull() {
    const response = await this.request('GET', '/sync/pull', null, {
      since: this.lastPull?.toISOString()
    });

    return response.changes || [];
  }

  async getStatus() {
    const response = await this.request('GET', '/sync/status');
    return response;
  }

  /**
   * Make HTTP request
   */
  request(method, path, body = null, query = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.endpoint);

      // Add query parameters
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });

      const protocol = url.protocol === 'https:' ? https : http;
      const options = {
        method,
        headers: this.headers
      };

      const req = protocol.request(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (_error) {
              resolve({ success: true, data });
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  async cleanup() {
    // Nothing to cleanup for REST
  }
}

module.exports = RestBackend;
