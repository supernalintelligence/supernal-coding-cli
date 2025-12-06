/**
 * Webpack loader to preprocess markdown before MDX parsing
 * Escapes comparison operators in text content while preserving code blocks
 * Converts HTML <pre><code> blocks to markdown code blocks
 */

/**
 * Convert HTML <pre><code> blocks to markdown code fences
 * This handles GitHub-generated content (like dependabot PRs) that use HTML code blocks
 */
function convertHtmlCodeBlocks(source) {
  // Match <pre lang="..."><code>...</code></pre> patterns (multiline)
  // The lang attribute may or may not be present
  const htmlCodeBlockPattern =
    /<pre(?:\s+lang="([^"]*)")?>\s*<code>([\s\S]*?)<\/code>\s*<\/pre>/gi;

  return source.replace(htmlCodeBlockPattern, (_match, lang, code) => {
    // Decode HTML entities in the code content
    const decodedCode = code
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    const language = lang || '';
    return `\n\`\`\`${language}\n${decodedCode}\n\`\`\`\n`;
  });
}

module.exports = function mdxPreprocessLoader(source) {
  // First, convert HTML code blocks to markdown code blocks
  // This must happen before line-by-line processing
  source = convertHtmlCodeBlocks(source);

  // Track if we're inside a code block
  const lines = source.split('\n');
  const result = [];
  let inCodeBlock = false;
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle frontmatter
    if (i === 0 && line.trim() === '---') {
      inFrontmatter = true;
      result.push(line);
      continue;
    }

    if (inFrontmatter && line.trim() === '---') {
      inFrontmatter = false;
      result.push(line);
      continue;
    }

    if (inFrontmatter) {
      result.push(line);
      continue;
    }

    // Handle code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }

    // Don't process code blocks or indented code
    if (inCodeBlock || line.startsWith('    ') || line.startsWith('\t')) {
      result.push(line);
      continue;
    }

    // Don't escape {{}} in JSX component props (e.g., <Component prop={{}} />)
    // Only escape template syntax in regular text
    const hasJSXComponent = line.match(/<\w+[^>]*\/?>/) !== null;

    if (!hasJSXComponent) {
      // Escape template syntax {{...}} outside of code blocks and JSX
      // This prevents MDX from trying to parse it as JSX expressions
      line = line.replace(/\{\{/g, '\\{\\{').replace(/\}\}/g, '\\}\\}');
    }

    // Escape comparison operators in regular text
    // Be careful not to break actual HTML tags
    line = line
      // Pattern: (<number - e.g., (<100ms)
      .replace(/\(<(\d)/g, '(&lt;$1')
      // Pattern: space<number or start<number (not HTML tags)
      .replace(/([^\w<]|^)<(\d)/g, '$1&lt;$2')
      // Pattern: space>number or start>number
      .replace(/([^\w>]|^)>(\s*\d)/g, '$1&gt;$2')
      // Pattern: word < number (e.g., "time < 1")
      .replace(/(\w+)\s+<\s+(\d)/g, '$1 &lt; $2')
      // Pattern: word > number (e.g., "score > 95")
      .replace(/(\w+)\s+>\s+(\d)/g, '$1 &gt; $2');

    result.push(line);
  }

  return result.join('\n');
};
