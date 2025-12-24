
export enum GameState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR'
}

export type Location = 'livingRoom' | 'kitchen' | 'outside' | 'bedroom';
export type Theme = 'normal' | 'christmas' | 'halloween' | 'v0';

export interface GrandpaState {
  isBlinking: boolean;
  mouthOpen: number; // 0 to 1
  isPoked: boolean;
  currentMood: 'happy' | 'grumpy' | 'sleepy' | 'surprised';
  location: Location;
  theme: Theme;
  isPlayingWithHorse?: boolean;
  isPhoneRinging?: boolean;
  isHandRaised?: boolean;
  isPhoneActive?: boolean;
  isLanternOn?: boolean;
  isSleeping?: boolean;
}
