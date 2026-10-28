export function TrainingVideo({
  contentRef,
  title,
  maxWidth,
}: {
  contentRef: string;
  title: string;
  maxWidth?: number;
}) {
  if (!contentRef) return null;

  let embedUrl = '';
  try {
    const url = new URL(contentRef);
    const youtubeId = url.hostname.includes('youtu.be')
      ? url.pathname.slice(1).split('/')[0]
      : url.searchParams.get('v') || url.pathname.match(/\/embed\/([^/]+)/)?.[1] || '';
    if ((url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) && youtubeId) {
      embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
    } else if (url.hostname.includes('vimeo.com')) {
      const vimeoId = url.pathname.match(/\/(\d+)/)?.[1];
      if (vimeoId) embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
    }
  } catch {
    // Relative or direct video URLs do not need conversion.
  }

  const mediaStyle = { width: '100%', height: '100%', border: 0 };

  return (
    <div
      style={{
        aspectRatio: '16 / 9',
        width: '100%',
        maxWidth,
        overflow: 'hidden',
        borderRadius: 'var(--ax-radius-lg)',
        background: '#000',
      }}
    >
      {embedUrl ? (
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={mediaStyle}
        />
      ) : (/\.(mp4|webm|ogg)(?:$|\?)/i).test(contentRef) ? (
        <video src={contentRef} title={title} controls style={mediaStyle} />
      ) : (
        <iframe src={contentRef} title={title} allowFullScreen style={mediaStyle} />
      )}
    </div>
  );
}
