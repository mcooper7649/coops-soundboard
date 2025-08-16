import { contextBridge, ipcRenderer } from 'electron';

// Define IPC channels inline to avoid import issues
const IPC_CHANNELS = {
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
  HOTKEY_PRESSED: 'hotkey-pressed',
  
  // Auto-start service management
  INSTALL_AUTOSTART: 'install-autostart',
  UNINSTALL_AUTOSTART: 'uninstall-autostart',
  GET_AUTOSTART_STATUS: 'get-autostart-status',
  
  // System audio capture
  START_SYSTEM_AUDIO_CAPTURE: 'start-system-audio-capture',
  STOP_SYSTEM_AUDIO_CAPTURE: 'stop-system-audio-capture',
  
  // Audio loopback management
  ENABLE_SPEAKER_LOOPBACK: 'enable-speaker-loopback',
  DISABLE_SPEAKER_LOOPBACK: 'disable-speaker-loopback',
  ENABLE_HEADPHONE_LOOPBACK: 'enable-headphone-loopback',
  DISABLE_HEADPHONE_LOOPBACK: 'disable-headphone-loopback'
} as const;

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Audio recording
  startRecording: () => ipcRenderer.invoke(IPC_CHANNELS.START_RECORDING),
  stopRecording: () => ipcRenderer.invoke(IPC_CHANNELS.STOP_RECORDING),
  
  // Audio playback
  playClip: (clipId: string) => ipcRenderer.invoke(IPC_CHANNELS.PLAY_CLIP, clipId),
  stopPlayback: () => ipcRenderer.invoke(IPC_CHANNELS.STOP_PLAYBACK),
  
  // Clip management
  getClips: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CLIPS),
  saveClip: (clip: any) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_CLIP, clip),
  deleteClip: (clipId: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_CLIP, clipId),
  renameClip: (id: string, name: string) => ipcRenderer.invoke(IPC_CHANNELS.RENAME_CLIP, { id, name }),
  
  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  updateSettings: (settings: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, settings),
  getAudioDevices: () => ipcRenderer.invoke(IPC_CHANNELS.GET_AUDIO_DEVICES),
  
  // Hotkeys
  registerHotkey: (assignment: any) => ipcRenderer.invoke(IPC_CHANNELS.REGISTER_HOTKEY, assignment),
  unregisterHotkey: (clipId: string) => ipcRenderer.invoke(IPC_CHANNELS.UNREGISTER_HOTKEY, clipId),
  
  // Auto-start service management
  installAutostart: () => ipcRenderer.invoke(IPC_CHANNELS.INSTALL_AUTOSTART),
  uninstallAutostart: () => ipcRenderer.invoke(IPC_CHANNELS.UNINSTALL_AUTOSTART),
  getAutostartStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_AUTOSTART_STATUS),
  
  // System audio capture
  startSystemAudioCapture: () => ipcRenderer.invoke(IPC_CHANNELS.START_SYSTEM_AUDIO_CAPTURE),
  stopSystemAudioCapture: () => ipcRenderer.invoke(IPC_CHANNELS.STOP_SYSTEM_AUDIO_CAPTURE),
  
  // Audio loopback management
  enableSpeakerLoopback: () => ipcRenderer.invoke(IPC_CHANNELS.ENABLE_SPEAKER_LOOPBACK),
  disableSpeakerLoopback: () => ipcRenderer.invoke(IPC_CHANNELS.DISABLE_SPEAKER_LOOPBACK),
  enableHeadphoneLoopback: () => ipcRenderer.invoke(IPC_CHANNELS.ENABLE_HEADPHONE_LOOPBACK),
  disableHeadphoneLoopback: () => ipcRenderer.invoke(IPC_CHANNELS.DISABLE_HEADPHONE_LOOPBACK),
  
  // Event listeners
  onRecordingStateChanged: (callback: (state: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.RECORDING_STATE_CHANGED, (_, state) => callback(state));
  },
  
  onPlaybackStateChanged: (callback: (state: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PLAYBACK_STATE_CHANGED, (_, state) => callback(state));
  },
  
  onClipSaved: (callback: (clip: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.SAVE_CLIP, (_, clip) => callback(clip));
  },
  
  onHotkeyPressed: (callback: (clipId: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.HOTKEY_PRESSED, (_, clipId) => callback(clipId));
  },
  
  onPlaybackError: (callback: (errorData: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PLAYBACK_ERROR, (_, errorData) => callback(errorData));
  },
  
  // Remove event listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      startRecording: () => Promise<void>;
      stopRecording: () => Promise<any>;
      playClip: (clipId: string) => Promise<void>;
      stopPlayback: () => Promise<void>;
      getClips: () => Promise<any[]>;
      saveClip: (clip: any) => Promise<any>;
      deleteClip: (clipId: string) => Promise<boolean>;
      renameClip: (id: string, name: string) => Promise<any>;
      getSettings: () => Promise<any>;
      updateSettings: (settings: any) => Promise<any>;
      getAudioDevices: () => Promise<any[]>;
      registerHotkey: (assignment: any) => Promise<boolean>;
      unregisterHotkey: (clipId: string) => Promise<boolean>;
      installAutostart: () => Promise<boolean>;
      uninstallAutostart: () => Promise<boolean>;
      getAutostartStatus: () => Promise<{ isInstalled: boolean; isEnabled: boolean; isActive: boolean }>;
      startSystemAudioCapture: () => Promise<void>;
      stopSystemAudioCapture: () => Promise<any>;
      onRecordingStateChanged: (callback: (state: any) => void) => void;
      onPlaybackStateChanged: (callback: (state: any) => void) => void;
      onClipSaved: (callback: (clip: any) => void) => void;
      onHotkeyPressed: (callback: (clipId: string) => void) => void;
      onPlaybackError: (callback: (errorData: any) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
