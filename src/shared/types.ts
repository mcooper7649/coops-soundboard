export interface AudioClip {
  id: string;
  name: string;
  filePath: string;
  duration: number;
  createdAt: Date;
  hotkey?: string;
}

export interface PlaybackError {
  message: string;
  details?: string;
}

export interface AudioDevice {
  id: string;
  name: string;
  type: 'input' | 'output' | 'virtual';
  isDefault: boolean;
  isVirtual?: boolean;
  description?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  outputDeviceId: string;
  virtualAudioDeviceId: string; // New field for virtual audio routing
  clipsDirectory: string;
  enableHotkeys: boolean;
  volume: number;
  enableVirtualAudioRouting: boolean; // New field to enable/disable virtual routing
}

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  startTime?: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentClipId?: string;
  progress: number;
}

export interface HotkeyAssignment {
  clipId: string;
  key: string;
  modifiers: string[];
}

// IPC Channel names
export const IPC_CHANNELS = {
  // Audio recording
  START_RECORDING: 'start-recording',
  STOP_RECORDING: 'stop-recording',
  RECORDING_STATE_CHANGED: 'recording-state-changed',
  
  // Audio playback
  PLAY_CLIP: 'play-clip',
  STOP_PLAYBACK: 'stop-playback',
  PLAYBACK_STATE_CHANGED: 'playback-state-changed',
  PLAYBACK_ERROR: 'playback-error',
  
  // Clip management
  GET_CLIPS: 'get-clips',
  SAVE_CLIP: 'save-clip',
  DELETE_CLIP: 'delete-clip',
  RENAME_CLIP: 'rename-clip',
  
  // Settings
  GET_SETTINGS: 'get-settings',
  UPDATE_SETTINGS: 'update-settings',
  GET_AUDIO_DEVICES: 'get-audio-devices',
  
  // Hotkeys
  REGISTER_HOTKEY: 'register-hotkey',
  UNREGISTER_HOTKEY: 'unregister-hotkey',
  HOTKEY_PRESSED: 'hotkey-pressed'
} as const;

// Event types for IPC
export type IpcEventMap = {
  [IPC_CHANNELS.START_RECORDING]: void;
  [IPC_CHANNELS.STOP_RECORDING]: void;
  [IPC_CHANNELS.RECORDING_STATE_CHANGED]: RecordingState;
  [IPC_CHANNELS.PLAY_CLIP]: string;
  [IPC_CHANNELS.STOP_PLAYBACK]: void;
  [IPC_CHANNELS.PLAYBACK_STATE_CHANGED]: PlaybackState;
  [IPC_CHANNELS.PLAYBACK_ERROR]: PlaybackError;
  [IPC_CHANNELS.GET_CLIPS]: AudioClip[];
  [IPC_CHANNELS.SAVE_CLIP]: AudioClip;
  [IPC_CHANNELS.DELETE_CLIP]: string;
  [IPC_CHANNELS.RENAME_CLIP]: { id: string; name: string };
  [IPC_CHANNELS.GET_SETTINGS]: AppSettings;
  [IPC_CHANNELS.UPDATE_SETTINGS]: Partial<AppSettings>;
  [IPC_CHANNELS.GET_AUDIO_DEVICES]: AudioDevice[];
  [IPC_CHANNELS.REGISTER_HOTKEY]: HotkeyAssignment;
  [IPC_CHANNELS.UNREGISTER_HOTKEY]: string;
  [IPC_CHANNELS.HOTKEY_PRESSED]: string;
};
