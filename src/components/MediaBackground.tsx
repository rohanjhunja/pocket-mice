import { useEffect, useRef, useCallback } from 'react';

interface MediaBackgroundProps {
  media: any;
  onThemeChange: (isVideo: boolean) => void;
  onMediaInteraction?: (eventType: string) => void;
}

export function MediaBackground({ media, onThemeChange, onMediaInteraction }: MediaBackgroundProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (media?.media_type === 'video' && media.media_url?.includes('youtube.com')) {
      onThemeChange(true);
    } else {
      onThemeChange(false);
    }
  }, [media, onThemeChange]);

  // Track iframe clicks via window blur detection
  // When a user clicks into an iframe, the parent window loses focus
  useEffect(() => {
    if (!onMediaInteraction || !media) return;
    if (media.media_type !== 'video' && media.media_type !== 'simulation' && media.media_type !== 'content') return;

    const eventType = media.media_type === 'video' ? 'media_video_click' : 'media_simulation_click';

    const handleBlur = () => {
      // Only fire if focus moved to our iframe (not to another tab)
      if (document.activeElement === iframeRef.current) {
        onMediaInteraction(eventType);
        // Re-focus the parent so we can detect the next click
        setTimeout(() => {
          window.focus();
        }, 100);
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [media, onMediaInteraction]);

  if (!media) {
    return null;
  }

  let url = media.media_url;
  // POC local intercept logic
  if (url && url.toUpperCase().includes('POCKET%20MOUSE-NATURAL%20SELECTION_V2.HTML')) {
    url = '/Pocket Mouse-Natural Selection_v2.html';
  }

  if (media.media_type === 'video' || media.media_type === 'simulation' || media.media_type === 'content') {
    if (media.media_type === 'video' && url.includes('youtube.com')) {
      url += (url.includes('?') ? '&' : '?') + 'autoplay=1';
    }

    const isInteractive = media.media_type === 'simulation' || media.media_type === 'content';
    
    return (
      <div className={`absolute top-0 left-0 w-full z-0 flex items-center justify-center transition-colors duration-300 md:h-full flex-start md:items-center ${isInteractive ? 'h-full bg-white' : 'h-[50vh] bg-black'} md:bg-transparent`}>
        <iframe
          ref={iframeRef}
          src={url}
          className="w-full h-full border-none"
          allow="autoplay; fullscreen"
          allowFullScreen
          title={media.media_title}
          onLoad={() => {
            if (onMediaInteraction) {
              onMediaInteraction(media.media_type === 'video' ? 'media_video_started' : 'media_simulation_started');
            }
          }}
        />
      </div>
    );
  }

  if (media.media_type === 'image') {
    return (
      <div className="absolute top-0 left-0 w-full h-full z-0 flex items-center justify-center bg-white transition-colors duration-300">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={media.media_title}
          className="max-w-full max-h-full object-contain cursor-pointer"
          onClick={() => {
            if (onMediaInteraction) onMediaInteraction('media_image_click');
          }}
        />
      </div>
    );
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full z-0 flex items-center justify-center bg-slate-100">
      <p className="text-slate-500 font-medium">Unsupported media type: {media.media_type}</p>
    </div>
  );
}
