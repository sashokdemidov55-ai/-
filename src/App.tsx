/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Film,
  FolderOpen,
  Maximize,
  Minimize,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';

export const DEFAULT_VIDEO_URL =
  '/assets/aistudio/YouCut_20261101_180209530_796e8c06.mp4';

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
}

const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export function VideoPlayer({ videoUrl, title }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimerRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.85);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [isLooping, setIsLooping] = useState(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  }, []);

  const scheduleHideControls = useCallback(() => {
    clearHideTimer();
    setShowControls(true);
    if (isPlaying) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 2600);
    }
  }, [clearHideTimer, isPlaying]);

  // Automatically start playback when component mounts or videoUrl changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHasError(false);
    setAutoplayBlocked(false);
    setIsBuffering(true);
    setCurrentTime(0);
    setDuration(0);
    setBufferedEnd(0);
    setDimensions(null);

    // Muted playback guarantees browser autoplay on initial screen open
    video.muted = true;
    setIsMuted(true);
    video.playbackRate = playbackRate;
    video.load();

    const attemptAutoplay = async () => {
      try {
        await video.play();
        setIsPlaying(true);
        setAutoplayBlocked(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        // Fallback: ensure muted and retry once
        video.muted = true;
        setIsMuted(true);
        try {
          await video.play();
          setIsPlaying(true);
          setAutoplayBlocked(false);
        } catch {
          setIsPlaying(false);
          setAutoplayBlocked(true);
          setShowControls(true);
        }
      }
    };

    void attemptAutoplay();

    return () => {
      clearHideTimer();
    };
  }, [videoUrl, clearHideTimer]);

  // Keep playbackRate synced
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Sync fullscreen state with browser events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video || hasError) return;

    if (video.paused || video.ended) {
      try {
        await video.play();
        setIsPlaying(true);
        setAutoplayBlocked(false);
        scheduleHideControls();
      } catch {
        setIsPlaying(false);
      }
    } else {
      video.pause();
      setIsPlaying(false);
      setShowControls(true);
      clearHideTimer();
    }
  }, [hasError, scheduleHideControls, clearHideTimer]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && video.volume === 0) {
      video.volume = 0.85;
      setVolume(0.85);
    }
    scheduleHideControls();
  }, [isMuted, scheduleHideControls]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const nextVolume = parseFloat(e.target.value);
    video.volume = nextVolume;
    setVolume(nextVolume);
    const shouldMute = nextVolume === 0;
    video.muted = shouldMute;
    setIsMuted(shouldMute);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = parseFloat(e.target.value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, []);

  const handleRestart = useCallback(async () => {
    const video = videoRef.current;
    if (!video || hasError) return;
    video.currentTime = 0;
    setCurrentTime(0);
    try {
      await video.play();
      setIsPlaying(true);
    } catch {
      // Ignore if blocked
    }
    scheduleHideControls();
  }, [hasError, scheduleHideControls]);

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate((prev) => {
      const idx = PLAYBACK_RATES.indexOf(prev as (typeof PLAYBACK_RATES)[number]);
      return PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    });
    scheduleHideControls();
  }, [scheduleHideControls]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen unavailable in restricted environments
    }
  }, []);

  const handleRetry = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setHasError(false);
    setIsBuffering(true);
    video.load();
    void video.play().catch(() => {});
  }, []);

  // Keyboard shortcuts when player or document is focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Space' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        void togglePlay();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        void toggleFullscreen();
      } else if (e.key === 'ArrowRight' && videoRef.current) {
        e.preventDefault();
        videoRef.current.currentTime = Math.min(
          duration,
          videoRef.current.currentTime + 5
        );
        scheduleHideControls();
      } else if (e.key === 'ArrowLeft' && videoRef.current) {
        e.preventDefault();
        videoRef.current.currentTime = Math.max(
          0,
          videoRef.current.currentTime - 5
        );
        scheduleHideControls();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute, toggleFullscreen, duration, scheduleHideControls]);

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;
  const controlsVisible = showControls || !isPlaying || autoplayBlocked;

  return (
    <div className="w-full flex flex-col gap-4">
      <div
        ref={containerRef}
        onMouseMove={scheduleHideControls}
        onMouseLeave={() => {
          if (isPlaying) setShowControls(false);
        }}
        className={`relative w-full bg-black overflow-hidden border border-zinc-800/80 select-none group ${
          isFullscreen ? 'rounded-none h-screen flex items-center justify-center' : 'rounded-2xl'
        }`}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          muted={isMuted}
          loop={isLooping}
          playsInline
          preload="auto"
          onClick={() => void togglePlay()}
          onLoadedMetadata={(e) => {
            const vid = e.currentTarget;
            setDuration(vid.duration || 0);
            if (vid.videoWidth && vid.videoHeight) {
              setDimensions({ width: vid.videoWidth, height: vid.videoHeight });
            }
          }}
          onCanPlay={() => setIsBuffering(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsPlaying(true);
            setIsBuffering(false);
            setAutoplayBlocked(false);
            scheduleHideControls();
          }}
          onPause={() => {
            setIsPlaying(false);
            setShowControls(true);
            clearHideTimer();
          }}
          onEnded={() => {
            if (!isLooping) {
              setIsPlaying(false);
              setShowControls(true);
            }
          }}
          onTimeUpdate={(e) => {
            const vid = e.currentTarget;
            setCurrentTime(vid.currentTime);
            if (vid.buffered.length > 0) {
              setBufferedEnd(vid.buffered.end(vid.buffered.length - 1));
            }
          }}
          onError={() => {
            setHasError(true);
            setIsBuffering(false);
            setIsPlaying(false);
          }}
          className={`w-full block cursor-pointer object-contain bg-black ${
            isFullscreen ? 'max-h-screen h-full' : 'aspect-video max-h-[76vh]'
          }`}
        />

        {/* Quick unmute affordance when autoplaying muted */}
        {!hasError && isMuted && isPlaying && (
          <button
            type="button"
            onClick={toggleMute}
            aria-label="Увімкнути звук"
            className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-950/85 hover:bg-zinc-900 text-zinc-100 border border-zinc-700/80 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B705] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <VolumeX className="w-4 h-4 text-[#F2B705]" />
            <span>Увімкнути звук</span>
          </button>
        )}

        {/* Center play button when paused or autoplay blocked by browser */}
        {!hasError && (!isPlaying || autoplayBlocked) && !isBuffering && (
          <button
            type="button"
            onClick={() => void togglePlay()}
            aria-label="Відтворити відео"
            className="absolute inset-0 z-10 m-auto w-16 h-16 rounded-2xl bg-black/75 hover:bg-[#F2B705] text-white hover:text-black border border-white/15 flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B705] cursor-pointer"
          >
            <Play className="w-7 h-7 fill-current ml-0.5" />
          </button>
        )}

        {/* Loading indicator */}
        {!hasError && isBuffering && (
          <div
            aria-label="Завантаження відео"
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <div className="w-10 h-10 rounded-full border-2 border-zinc-700 border-t-[#F2B705] animate-spin" />
          </div>
        )}

        {/* Error fallback */}
        {hasError && (
          <div className="absolute inset-0 z-30 bg-zinc-950/95 flex flex-col items-center justify-center p-6 text-center gap-4">
            <Film className="w-10 h-10 text-zinc-500" />
            <div className="space-y-1 max-w-md">
              <p className="font-display text-lg font-semibold text-zinc-100">
                Не вдалося відтворити відеофайл
              </p>
              <p className="text-sm text-zinc-400">
                Перевірте доступність ресурсу або виберіть інший відеофайл.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2 rounded-lg bg-[#F2B705] hover:bg-[#e0a804] text-black text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B705] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Спробувати знову
            </button>
          </div>
        )}

        {/* Bottom control bar with measured contrast scrim */}
        {!hasError && (
          <div
            className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-12 pb-3 px-4 transition-opacity duration-200 ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Interactive timeline scrubber */}
            <div className="relative w-full h-5 flex items-center group/scrubber mb-1.5">
              <div className="w-full h-1.5 bg-zinc-800/90 rounded-full overflow-hidden relative">
                <div
                  className="absolute inset-y-0 left-0 bg-zinc-600/60"
                  style={{ width: `${bufferedPercent}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-[#F2B705]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <input
                type="range"
                aria-label="Позиція відтворення"
                min={0}
                max={duration || 0}
                step={0.05}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => void togglePlay()}
                  aria-label={isPlaying ? 'Пауза' : 'Відтворити'}
                  title={isPlaying ? 'Пауза (Space)' : 'Відтворити (Space)'}
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-100 hover:bg-white/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B705] shrink-0 cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleRestart()}
                  aria-label="Спочатку"
                  title="Спочатку"
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B705] shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Увімкнути звук' : 'Вимкнути звук'}
                    title={isMuted ? 'Увімкнути звук (M)' : 'Вимкнути звук (M)'}
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B705] shrink-0 cursor-pointer"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-[#F2B705]" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>

                  <input
                    type="range"
                    aria-label="Гучність"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="hidden sm:block w-20 accent-[#F2B705] cursor-pointer h-1.5"
                  />
                </div>

                <span className="ml-2 text-xs font-mono tabular-nums text-zinc-300 whitespace-nowrap shrink-0">
                  {formatTime(currentTime)} <span className="text-zinc-500">/</span>{' '}
                  {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={cyclePlaybackRate}
                  aria-label="Швидкість відтворення"
                  title="Швидкість відтворення"
                  className="h-10 px-3 rounded-lg flex items-center justify-center text-xs font-mono tabular-nums text-zinc-200 hover:text-white hover:bg-white/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B705] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {playbackRate}×
                </button>

                <button
                  type="button"
                  onClick={() => setIsLooping((prev) => !prev)}
                  aria-label={isLooping ? 'Вимкнути повтор' : 'Увімкнути повтор'}
                  aria-pressed={isLooping}
                  title="Повтор відео"
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B705] shrink-0 cursor-pointer ${
                    isLooping
                      ? 'text-[#F2B705] bg-white/10'
                      : 'text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Repeat className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  aria-label={isFullscreen ? 'Вийти з повноекранного режиму' : 'На весь екран'}
                  title={isFullscreen ? 'Вийти з повноекранного режиму (F)' : 'На весь екран (F)'}
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B705] shrink-0 cursor-pointer"
                >
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4" />
                  ) : (
                    <Maximize className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clean unboxed metadata strip below video frame */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 text-xs text-zinc-400">
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span className="text-zinc-200 font-medium truncate">
            {title || 'YouCut_20261101_180209530_796e8c06.mp4'}
          </span>
          {dimensions && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums whitespace-nowrap">
                {dimensions.width}×{dimensions.height}
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">
            {isPlaying ? 'Відтворення' : 'Пауза'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-zinc-500 whitespace-nowrap">
          <span>Space — пауза</span>
          <span aria-hidden="true">·</span>
          <span>M — звук</span>
          <span aria-hidden="true">·</span>
          <span>F — повний екран</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [videoUrl, setVideoUrl] = useState<string>(DEFAULT_VIDEO_URL);
  const [videoTitle, setVideoTitle] = useState<string>(
    'YouCut_20261101_180209530_796e8c06.mp4'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;
    setVideoUrl(nextUrl);
    setVideoTitle(file.name);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col">
      {/* Minimal 3-zone top bar */}
      <header className="w-full border-b border-zinc-900">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-semibold tracking-tight text-white whitespace-nowrap shrink-0">
            Screenroom
          </span>

          <p className="hidden sm:block text-xs text-zinc-400 truncate">
            Автоматичний запуск відео на головному екрані
          </p>

          <div className="flex items-center gap-3 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B705] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#F2B705]" />
              <span>Відкрити файл</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main cinema stage */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6">
        <div className="w-full max-w-6xl">
          <VideoPlayer videoUrl={videoUrl} title={videoTitle} />
        </div>
      </main>
    </div>
  );
}
