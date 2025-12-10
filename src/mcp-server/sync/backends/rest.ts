/**
 * REST API Sync Backend
 *
 * Implements synchronization via REST API endpoints
 *
 * @module sync/backends/rest
 */

import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

interface RestBackendConfig {
  endpoint: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

interface SyncChange {
  [key: string]: unknown;
}

interface PushResponse {
  success: boolean;
  [key: string]: unknown;
}

interface PullResponse {
  changes?: SyncChange[];
  [key: string]: unknown;
}

interface StatusResponse {
  connected: boolean;
  [key: string]: unknown;
}

class RestBackend {
  protected config: RestBackendConfig;
  protected endpoint: URL;
  protected apiKey: string | undefined;
  protected headers: Record<string, string>;
  protected lastPull: Date | null;

  constructor(config: RestBackendConfig) {
    this.config = config;
    this.endpoint = new URL(config.endpoint);
    this.apiKey = config.apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'SupernalCoding-MCP/1.0',
      ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      ...config.headers
    };
    this.lastPull = null;
  }

  async initialize(): Promise<void> {
    try {
      await this.request('GET', '/health');
    } catch (error) {
      throw new Error(`Failed to connect to REST endpoint: ${(error as Error).message}`);
    }
  }

  async push(changes: SyncChange[], force: boolean = false): Promise<PushResponse> {
    const response = await this.request('POST', '/sync/push', {
      changes,
      force,
      timestamp: new Date().toISOString()
    });

    return response as PushResponse;
  }

  async pull(): Promise<SyncChange[]> {
    const response = await this.request('GET', '/sync/pull', null, {
      since: this.lastPull?.toISOString()
    }) as PullResponse;

    return response.changes || [];
  }

  async getStatus(): Promise<StatusResponse> {
    const response = await this.request('GET', '/sync/status');
    return response as StatusResponse;
  }

  request(
    method: string,
    path: string,
    body: unknown = null,
    query: Record<string, string | undefined> = {}
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.endpoint);

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
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
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

  async cleanup(): Promise<void> {
    // Nothing to cleanup for REST
  }
}

export default RestBackend;
module.exports = RestBackend;
