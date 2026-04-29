declare namespace YT {
  interface PlayerState {
    UNSTARTED: -1
    ENDED: 0
    PLAYING: 1
    PAUSED: 2
    BUFFERING: 3
    CUED: 5
  }

  interface PlayerOptions {
    videoId?: string
    width?: number | string
    height?: number | string
    playerVars?: {
      autoplay?: 0 | 1
      controls?: 0 | 1 | 2
      rel?: 0 | 1
      modestbranding?: 0 | 1
      showinfo?: 0 | 1
      iv_load_policy?: 1 | 3
      [key: string]: any
    }
    events?: {
      onReady?: (event: any) => void
      onStateChange?: (event: any) => void
      onError?: (event: any) => void
    }
  }

  interface Player {
    playVideo(): void
    pauseVideo(): void
    stopVideo(): void
    seekTo(seconds: number, allowSeekAhead: boolean): void
    getCurrentTime(): number
    getDuration(): number
    getPlayerState(): number
    getVideoUrl(): string
    destroy(): void
  }

  const PlayerState: PlayerState

  class Player {
    constructor(element: HTMLElement | string, options: PlayerOptions)
  }
}

declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

export {}