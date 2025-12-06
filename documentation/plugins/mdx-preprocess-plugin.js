/**
 * Docusaurus plugin to preprocess markdown content before MDX parsing
 * Escapes comparison operators and other JSX-like syntax to prevent parsing errors
 */

module.exports = function mdxPreprocessPlugin(_context, _options) {
  return {
    name: 'mdx-preprocess-plugin',

    configureWebpack(_config, _isServer, _utils) {
      return {
        module: {
          rules: [
            {
              // Target markdown files before they reach the MDX loader
              test: /\.md$/,
              // Only process files from ../docs directory
              include: /\/docs\//,
              use: [
                {
                  loader: require.resolve('./mdx-preprocess-loader.js')
                }
              ],
              // Ensure this runs before MDX loader
              enforce: 'pre'
            }
          ]
        }
      };
    }
  };
};
