'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface MediaBackgroundProps {
  media: any;
  stepId: string;
  onThemeChange: (isVideo: boolean) => void;
  onMediaInteraction?: (eventType: string) => void;
  onEmbedError?: (url: string) => void;
}

type EmbedState = 'checking' | 'embeddable' | 'not-embeddable';

export function MediaBackground({ media, stepId, onThemeChange, onMediaInteraction, onEmbedError }: MediaBackgroundProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [embedState, setEmbedState] = useState<EmbedState>('checking');
  const [resolvedUrl, setResolvedUrl] = useState<string>('');

  // Resolve the display URL
  const getUrl = () => {
    if (!media?.media_url) return '';
    let url = media.media_url;
    if (url.startsWith('http://')) url = url.replace('http://', 'https://');
    if (url.toUpperCase().includes('POCKET%20MOUSE-NATURAL%20SELECTION_V2.HTML')) {
      url = '/Pocket Mouse-Natural Selection_v2.html';
    }
    return url;
  };

  // Check embeddability server-side whenever step/media changes
  useEffect(() => {
    setEmbedState('checking');

    const url = getUrl();
    setResolvedUrl(url);

    if (!media || !url) return;

    // Only check iframe-based media types
    if (media.media_type !== 'video' && media.media_type !== 'simulation' && media.media_type !== 'content') {
      setEmbedState('embeddable'); // images etc don't need iframe check
      return;
    }

    // For YouTube: only /embed/ paths are embeddable
    if (url.includes('youtube.com') && !url.includes('/embed/')) {
      // Channel pages, user pages, watch pages without embed — not embeddable
      if (url.includes('/channel/') || url.includes('/user/') || url.includes('/@') || url.includes('/watch')) {
        setEmbedState('not-embeddable');
        if (onEmbedError) onEmbedError(url);
        return;
      }
    }

    // Local URLs don't need a server check
    if (url.startsWith('/')) {
      setEmbedState('embeddable');
      return;
    }

    // Server-side embed check
    fetch(`/api/check-embed?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(data => {
        if (data.embeddable) {
          setEmbedState('embeddable');
        } else {
          setEmbedState('not-embeddable');
          if (onEmbedError) onEmbedError(data.finalUrl || url);
        }
      })
      .catch(() => {
        // If the check itself fails, try embedding anyway
        setEmbedState('embeddable');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media?.media_url]);

  useEffect(() => {
    if (media?.media_type === 'video' && media.media_url?.includes('youtube.com')) {
      onThemeChange(true);
    } else {
      onThemeChange(false);
    }
  }, [media, onThemeChange]);

  // Track iframe clicks via window blur detection
  useEffect(() => {
    if (!onMediaInteraction || !media) return;
    if (media.media_type !== 'video' && media.media_type !== 'simulation' && media.media_type !== 'content') return;
    if (embedState !== 'embeddable') return;

    const eventType = media.media_type === 'video' ? 'media_video_click' : 'media_simulation_click';

    const handleBlur = () => {
      if (document.activeElement === iframeRef.current) {
        // Track the interaction — but do NOT call window.focus() here.
        // Calling window.focus() immediately after an iframe gains focus
        // steals focus back from the simulation, breaking text field input.
        onMediaInteraction(eventType);
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [media, onMediaInteraction, embedState]);

  if (!media) return null;

  const url = resolvedUrl;

  // ===== NOT EMBEDDABLE — return nothing, InstructionOverlay handles the link =====
  if (embedState === 'not-embeddable') {
    return null;
  }

  // ===== CHECKING — show loading spinner =====
  if (embedState === 'checking') {
    return (
      <div className="absolute top-0 left-0 w-full h-full z-0 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Checking resource…</span>
        </div>
      </div>
    );
  }

  // ===== EMBEDDABLE — render iframe =====
  if (media.media_type === 'video' || media.media_type === 'simulation' || media.media_type === 'content') {
    let iframeSrc = url;
    if (media.media_type === 'video' && iframeSrc.includes('youtube.com')) {
      iframeSrc += (iframeSrc.includes('?') ? '&' : '?') + 'autoplay=1';
    }
    
    if (media.media_type === 'simulation' && iframeSrc.includes('.supabase.co') && !iframeSrc.includes('/api/sim')) {
      iframeSrc = `/api/sim?url=${encodeURIComponent(iframeSrc)}`;
    }

    const isInteractive = media.media_type === 'simulation' || media.media_type === 'content';

    return (
      <div className={`absolute top-0 left-0 w-full z-0 flex items-center justify-center transition-colors duration-300 md:h-full flex-start md:items-center ${isInteractive ? 'h-full bg-white' : 'h-[50vh] bg-black'} md:bg-transparent`}>
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="w-full h-full border-none"
          allow="autoplay; fullscreen; clipboard-read; clipboard-write"
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
