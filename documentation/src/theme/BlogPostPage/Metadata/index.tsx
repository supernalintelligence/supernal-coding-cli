import Head from '@docusaurus/Head';
import { useBlogPost } from '@docusaurus/plugin-content-blog/client';
import type { Props } from '@theme/BlogPostPage/Metadata';

export default function BlogPostPageMetadata({ children }: Props): JSX.Element {
  // Safely get blog post context
  let blogPostContext;
  try {
    blogPostContext = useBlogPost();
  } catch (_e) {
    // Not in a blog post context - render children only
    return <>{children}</>;
  }

  const { metadata, isBlogPostPage } = blogPostContext;
  const { title, description, date, tags, authors, frontMatter } = metadata;

  // Generate social card image URL
  const baseUrl = 'https://code.supernal.ai';
  const socialImage = frontMatter.image
    ? `${baseUrl}${frontMatter.image}`
    : `${baseUrl}/img/documentation.png`;

  // Build author string
  const authorNames = authors.map((author) => author.name).join(', ');

  return (
    <>
      <Head>
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:alt" content={`${title} - Supernal Coding`} />
        <meta property="og:site_name" content="Supernal Coding" />
        <meta property="article:published_time" content={date} />
        {tags.map((tag, index) => (
          <meta key={index} property="article:tag" content={tag.label} />
        ))}
        {authorNames && (
          <meta property="article:author" content={authorNames} />
        )}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={socialImage} />
        <meta name="twitter:image:alt" content={`${title} - Supernal Coding`} />
        <meta name="twitter:creator" content="@SupernalAI" />
        <meta name="twitter:site" content="@SupernalAI" />

        {/* LinkedIn */}
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Keywords for SEO */}
        {tags.length > 0 && (
          <meta
            name="keywords"
            content={tags.map((tag) => tag.label).join(', ')}
          />
        )}
      </Head>
      {children}
    </>
  );
}
