import LiveWorkflowStatus from '@site/src/components/LiveWorkflowStatus';
import SimpleMermaid from '@site/src/components/SimpleMermaid';
// Import the original mapper
import MDXComponents from '@theme-original/MDXComponents';

export default {
  // Re-use the default mapping
  ...MDXComponents,
  // Map custom components
  LiveWorkflowStatus,
  SimpleMermaid
};
