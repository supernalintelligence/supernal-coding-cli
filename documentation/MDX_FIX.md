# MDX Comparison Operator Fix

## Problem

MDX treats `<` and `>` as JSX tag delimiters, causing errors with natural documentation like:

- `<100ms` (performance metrics)
- `score > 95` (comparisons)
- `time < 1 second` (measurements)

## Solution

Automatic preprocessing via webpack loader that escapes comparison operators before MDX parsing.

## How It Works

1. **Webpack Loader** (`plugins/mdx-preprocess-loader.js`)
   - Runs BEFORE MDX parsing (enforce: 'pre')
   - Only processes files from `../docs/` directory
   - Preserves code blocks, frontmatter, and inline code
   - Escapes comparison operators in regular text

2. **Plugin Registration** (`plugins/mdx-preprocess-plugin.js`)
   - Registers the loader with Docusaurus webpack config
   - Configured in `docusaurus.config.ts`

## Result

✅ Write natural markdown: `Navigation feels fast (<100ms)`  
✅ Loader converts to: `Navigation feels fast (&lt;100ms)`  
✅ MDX parses successfully without errors

## For Contributors

Just write natural markdown - the build system handles MDX compatibility automatically. No need to remember HTML entities.
