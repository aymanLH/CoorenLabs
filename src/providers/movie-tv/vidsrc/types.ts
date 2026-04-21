export interface VidsrcSource {
  url: string;
  isM3u8: boolean;
  type: string;
}

export interface VidsrcSubtitle {
  url: string;
  lang: string;
  default: boolean;
}

export interface VidsrcResult {
  sources: VidsrcSource[];
  subtitles: VidsrcSubtitle[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}

export interface VidsrcServer {
  id: string;
  name: string;
  hash: string;
}
