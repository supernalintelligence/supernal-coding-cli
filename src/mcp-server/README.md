# Supernal Coding MCP Server

Model Context Protocol server implementation for Supernal Coding, providing programmatic access to requirements, kanban, validation, git operations, and higher-level system synchronization.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Claude Code / MCP Client                │
│              (Uses MCP Protocol over stdio)              │
└────────────────────────┬─────────────────────────────────┘
                         │ MCP Protocol (JSON-RPC)
┌────────────────────────┴─────────────────────────────────┐
│              Supernal Coding MCP Server                  │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Tool Managers                       │   │
│  │  • RequirementsManager                          │   │
│  │  • KanbanManager                                │   │
│  │  • ValidationManager                            │   │
│  │  • GitManager                                   │   │
│  │  • AgentManager                                 │   │
│  │  • RulesManager                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Synchronization Layer                  │   │
│  │  • SyncManager (Bidirectional sync)             │   │
│  │  • Conflict Resolution                          │   │
│  │  • Change Detection                             │   │
│  └────────────┬────────────────────────────────────┘   │
└───────────────┼──────────────────────────────────────────┘
                │
    ┌───────────┴──────────┬──────────────┬──────────────┐
    │                      │              │              │
┌───┴────┐          ┌─────┴─────┐  ┌─────┴─────┐  ┌────┴────┐
│  REST  │          │  GraphQL  │  │ WebSocket │  │ Custom  │
│ Backend│          │  Backend  │  │  Backend  │  │ Backend │
└───┬────┘          └─────┬─────┘  └─────┬─────┘  └────┬────┘
    │                     │              │              │
    └─────────────────────┴──────────────┴──────────────┘
                          │
              ┌───────────┴───────────┐
              │  Higher-Level System  │
              │  (API, Database, etc) │
              └───────────────────────┘
```

## Features

### 1. MCP Tools

Expose Supernal Coding functionality as MCP tools:

- **Requirements**: `sc_req_list`, `sc_req_read`, `sc_req_validate`, `sc_req_new`
- **Kanban**: `sc_kanban_list`, `sc_kanban_move`
- **Git**: `sc_git_status`, `sc_git_validate`
- **Agent**: `sc_agent_handoff`, `sc_agent_status`
- **Validation**: `sc_validate_all`
- **Rules**: `sc_rules_active`
- **Sync**: `sc_sync_status`, `sc_sync_push`, `sc_sync_pull`

### 2. MCP Resources

Provide access to data structures:

- `requirements://list` - All requirements
- `kanban://boards` - All kanban boards
- `rules://active` - Active cursor rules
- `config://current` - Current configuration
- `sync://status` - Synchronization status

### 3. Bidirectional Sync

Synchronize with higher-level systems:

- **Multiple Backends**: REST, GraphQL, WebSocket, Custom
- **Conflict Resolution**: Manual, local, remote, latest timestamp
- **Auto-Sync**: Configurable automatic synchronization
- **Webhooks**: Event notifications
- **Filtering**: Selective sync of components

## Installation

### 1. Install Package

```bash
npm install supernal-code
```

### 2. Configure MCP Server

Create `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "supernal-coding": {
      "command": "node",
      "args": ["node_modules/supernal-code/lib/mcp-server/index.js"],
      "cwd": "${workspaceFolder}",
      "env": {
        "SUPERNAL_SYNC_API_KEY": "${env:SUPERNAL_SYNC_API_KEY}"
      }
    }
  }
}
```

### 3. Configure Synchronization (Optional)

Edit `supernal.yaml`:

```yaml
[sync]
enabled = true
backend = "rest"
endpoint = "https://api.example.com/supernal"
apiKey = "${env:SUPERNAL_SYNC_API_KEY}"
autoSync = true
syncInterval = 60000
conflictResolution = "manual"
```

## Usage

### From Claude Code

#### List Requirements

```
Use sc_req_list to show all critical requirements
```

#### Read Specific Requirement

```
Use sc_req_read with id="REQ-037"
```

#### Validate Changes

```
Use sc_git_validate to check current changes
```

#### Create Handoff

```
Use sc_agent_handoff with title="feature-complete"
and completed=["Implemented auth", "Added tests"]
and remaining=["Documentation", "Review"]
```

### Programmatically

```javascript
const SupernalCodingServer = require('supernal-code/lib/mcp-server');

const server = new SupernalCodingServer({
  projectRoot: '/path/to/project',
});

await server.start();
```

## Synchronization Backends

### REST Backend

Default HTTP/HTTPS backend.

**Required Endpoints:**

- `POST /sync/push` - Receive local changes
- `GET /sync/pull` - Send remote changes
- `GET /sync/status` - Status check
- `GET /health` - Health check

**Configuration:**

```toml
[sync]
backend = "rest"
endpoint = "https://api.example.com/supernal"
apiKey = "your-api-key"
```

### GraphQL Backend

For GraphQL APIs.

**Required:**

- Queries: `pullChanges`, `getSyncStatus`
- Mutations: `pushChanges`

**Configuration:**

```toml
[sync]
backend = "graphql"
endpoint = "https://api.example.com/graphql"
```

### WebSocket Backend

For real-time bidirectional sync.

**Configuration:**

```toml
[sync]
backend = "websocket"
endpoint = "wss://api.example.com/sync"
```

### Custom Backend

Implement your own:

```javascript
// custom-backend.js
class CustomBackend {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    // Setup connection
  }

  async push(changes, force) {
    // Push changes to remote
    return { success: true, pushed: changes.length };
  }

  async pull() {
    // Pull changes from remote
    return [];
  }

  async getStatus() {
    // Get sync status
    return { connected: true };
  }

  async cleanup() {
    // Cleanup resources
  }
}

module.exports = CustomBackend;
```

**Configuration:**

```toml
[sync]
backend = "custom"

[sync.custom]
backendPath = "./custom-backend.js"
```

## Conflict Resolution

### Manual (Default)

Sync stops on conflicts, requires user intervention:

```toml
conflictResolution = "manual"
```

### Local Priority

Always keep local changes:

```toml
conflictResolution = "local"
```

### Remote Priority

Always accept remote changes:

```toml
conflictResolution = "remote"
```

### Latest Timestamp

Keep most recent:

```toml
conflictResolution = "latest"
```

## Events

The sync manager emits events:

```javascript
server.syncManager.on('syncStarted', () => {
  console.log('Sync started');
});

server.syncManager.on('syncCompleted', (result) => {
  console.log('Sync completed:', result);
});

server.syncManager.on('conflictDetected', (conflict) => {
  console.log('Conflict:', conflict);
});

server.syncManager.on('error', (error) => {
  console.error('Sync error:', error);
});
```

## Security

### API Keys

Use environment variables:

```bash
export SUPERNAL_SYNC_API_KEY="your-api-key"
```

```toml
[sync]
apiKey = "${env:SUPERNAL_SYNC_API_KEY}"
```

### HTTPS Only

Always use HTTPS for remote endpoints:

```toml
[sync]
endpoint = "https://api.example.com"  # Not http://
```

### Consent Management

Respect privacy settings:

```toml
[rules]
default_consent_mode = "ai_agent_deny"
skip_prompts_non_interactive = true
```

## Debugging

### Enable Verbose Logging

```toml
[development]
verbose_output = true
debug_mode = true
log_level = "debug"
```

### Check MCP Connection

```bash
# Test MCP server directly
node node_modules/supernal-code/lib/mcp-server/index.js

# Check Claude Code logs
# Claude Code -> Developer -> Show Logs
```

### Monitor Sync Activity

```
Use sc_sync_status to check sync state
```

## Performance

### Caching

The server caches frequently accessed data:

- Requirements list
- Kanban boards
- Active rules

### Batch Operations

Use resources for bulk access:

```
Access requirements://list instead of multiple sc_req_read calls
```

### Sync Optimization

```toml
[sync]
# Reduce sync frequency
syncInterval = 300000  # 5 minutes

# Filter what to sync
[sync.filters]
includeRequirements = true
includeKanban = true
includeRules = false  # Don't sync rules
```

## Contributing

### Adding New Tools

1. Create manager in `tools/`:

```javascript
// tools/my-manager.js
class MyManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  async myOperation(params) {
    // Implementation
  }
}

module.exports = MyManager;
```

2. Register in `index.js`:

```javascript
const MyManager = require('./tools/my-manager');

// In constructor:
this.myManager = new MyManager(this.projectRoot);

// In setupHandlers:
{
  name: 'sc_my_operation',
  description: 'My operation',
  inputSchema: { /* ... */ }
}

// In CallToolRequestSchema handler:
case 'sc_my_operation':
  result = await this.myManager.myOperation(args);
  break;
```

### Adding New Sync Backends

1. Create backend in `sync/backends/`:

```javascript
// sync/backends/my-backend.js
class MyBackend {
  // Implement required methods
}

module.exports = MyBackend;
```

2. Register in `sync/manager.js`:

```javascript
case 'my-backend':
  const MyBackend = require('./backends/my-backend');
  this.backend = new MyBackend(this.config);
  break;
```

## License

See LICENSE file in the root of the repository.

## Support

- Documentation: https://code.supernal.ai
- Issues: https://github.com/supernalintelligence/supernal-coding/issues
- Email: support@supernal.ai
