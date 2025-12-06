import { useBlogPost } from '@docusaurus/plugin-content-blog/client';
import ShareButtons from '@site/src/components/ShareButtons';
import OriginalBlogPostItem from '@theme-original/BlogPostItem';

export default function BlogPostItem(props) {
  // useBlogPost() can throw outside of BlogPostProvider (e.g., on tag pages)
  let blogPostContext;
  try {
    blogPostContext = useBlogPost();
  } catch (_e) {
    // Not in a blog post context (e.g., tag page preview)
    return <OriginalBlogPostItem {...props} />;
  }

  const { metadata, isBlogPostPage } = blogPostContext;

  return (
    <>
      <OriginalBlogPostItem {...props} />

      {/* Show floating share button on full blog post page */}
      {isBlogPostPage && metadata.frontMatter.shareBlurbs && (
        <ShareButtons
          title={metadata.title}
          description={metadata.description || ''}
          url={
            typeof window !== 'undefined'
              ? window.location.href
              : metadata.permalink
          }
          shareBlurbs={metadata.frontMatter.shareBlurbs}
          floating={true}
        />
      )}
    </>
  );
}
