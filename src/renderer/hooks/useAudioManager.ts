import { useState, useEffect, useCallback } from 'react';
import { AudioClip, AppSettings, AudioDevice, RecordingState, PlaybackState } from '../../shared/types';

declare global {
  interface Window {
    electronAPI: {
      startRecording: () => Promise<void>;
      stopRecording: () => Promise<any>;
      playClip: (clipId: string) => Promise<void>;
      stopPlayback: () => Promise<void>;
      getClips: () => Promise<AudioClip[]>;
      saveClip: (clip: any) => Promise<AudioClip>;
      deleteClip: (clipId: string) => Promise<boolean>;
      renameClip: (id: string, name: string) => Promise<AudioClip>;
      getSettings: () => Promise<AppSettings>;
      updateSettings: (settings: any) => Promise<AppSettings>;
      getAudioDevices: () => Promise<AudioDevice[]>;
      registerHotkey: (assignment: any) => Promise<boolean>;
      unregisterHotkey: (clipId: string) => Promise<boolean>;
      onRecordingStateChanged: (callback: (state: any) => void) => void;
      onPlaybackStateChanged: (callback: (state: any) => void) => void;
      onClipSaved: (callback: (clip: any) => void) => void;
      onHotkeyPressed: (callback: (clipId: string) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

export const useAudioManager = () => {
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    startTime: undefined
  });
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentClipId: undefined,
    progress: 0
  });
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'system',
    outputDeviceId: '',
    clipsDirectory: '',
    enableHotkeys: true,
    volume: 1.0
  });
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [clipsData, settingsData, devicesData] = await Promise.all([
          window.electronAPI.getClips(),
          window.electronAPI.getSettings(),
          window.electronAPI.getAudioDevices()
        ]);

        setClips(clipsData);
        setSettings(settingsData);
        setAudioDevices(devicesData);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Set up IPC event listeners
  useEffect(() => {
    const handleRecordingStateChanged = (state: RecordingState) => {
      setRecordingState(state);
    };

    const handlePlaybackStateChanged = (state: PlaybackState) => {
      setPlaybackState(state);
    };

    const handleClipSaved = (clip: AudioClip) => {
      setClips(prev => {
        const existingIndex = prev.findIndex(c => c.id === clip.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = clip;
          return updated;
        } else {
          return [...prev, clip];
        }
      });
    };

    const handleHotkeyPressed = (clipId: string) => {
      // Handle hotkey press - could show a visual indicator
      console.log('Hotkey pressed for clip:', clipId);
    };

    // Register event listeners
    window.electronAPI.onRecordingStateChanged(handleRecordingStateChanged);
    window.electronAPI.onPlaybackStateChanged(handlePlaybackStateChanged);
    window.electronAPI.onClipSaved(handleClipSaved);
    window.electronAPI.onHotkeyPressed(handleHotkeyPressed);

    // Cleanup
    return () => {
      window.electronAPI.removeAllListeners('recording-state-changed');
      window.electronAPI.removeAllListeners('playback-state-changed');
      window.electronAPI.removeAllListeners('clip-saved');
      window.electronAPI.removeAllListeners('hotkey-pressed');
    };
  }, []);

  // Audio recording functions
  const startRecording = useCallback(async () => {
    try {
      await window.electronAPI.startRecording();
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      await window.electronAPI.stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }, []);

  // Audio playback functions
  const playClip = useCallback(async (clipId: string) => {
    try {
      await window.electronAPI.playClip(clipId);
    } catch (error) {
      console.error('Failed to play clip:', error);
      throw error;
    }
  }, []);

  const stopPlayback = useCallback(async () => {
    try {
      await window.electronAPI.stopPlayback();
    } catch (error) {
      console.error('Failed to stop playback:', error);
      throw error;
    }
  }, []);

  // Clip management functions
  const saveClip = useCallback(async (clip: AudioClip) => {
    try {
      const savedClip = await window.electronAPI.saveClip(clip);
      setClips(prev => {
        const existingIndex = prev.findIndex(c => c.id === clip.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = savedClip;
          return updated;
        } else {
          return [...prev, savedClip];
        }
      });
      return savedClip;
    } catch (error) {
      console.error('Failed to save clip:', error);
      throw error;
    }
  }, []);

  const deleteClip = useCallback(async (clipId: string) => {
    try {
      const success = await window.electronAPI.deleteClip(clipId);
      if (success) {
        setClips(prev => prev.filter(c => c.id !== clipId));
      }
      return success;
    } catch (error) {
      console.error('Failed to delete clip:', error);
      throw error;
    }
  }, []);

  const renameClip = useCallback(async (clipId: string, name: string) => {
    try {
      const updatedClip = await window.electronAPI.renameClip(clipId, name);
      setClips(prev => prev.map(c => c.id === clipId ? updatedClip : c));
      return updatedClip;
    } catch (error) {
      console.error('Failed to rename clip:', error);
      throw error;
    }
  }, []);

  // Settings functions
  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    try {
      const updatedSettings = await window.electronAPI.updateSettings(newSettings);
      setSettings(updatedSettings);
      return updatedSettings;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }, []);

  // Hotkey functions
  const registerHotkey = useCallback(async (assignment: { clipId: string; key: string; modifiers: string[] }) => {
    try {
      const success = await window.electronAPI.registerHotkey(assignment);
      if (success) {
        // Update the clip with the hotkey
        setClips(prev => prev.map(c => 
          c.id === assignment.clipId 
            ? { ...c, hotkey: [...assignment.modifiers, assignment.key].join('+') }
            : c
        ));
      }
      return success;
    } catch (error) {
      console.error('Failed to register hotkey:', error);
      throw error;
    }
  }, []);

  const unregisterHotkey = useCallback(async (clipId: string) => {
    try {
      const success = await window.electronAPI.unregisterHotkey(clipId);
      if (success) {
        // Remove the hotkey from the clip
        setClips(prev => prev.map(c => 
          c.id === clipId ? { ...c, hotkey: undefined } : c
        ));
      }
      return success;
    } catch (error) {
      console.error('Failed to unregister hotkey:', error);
      throw error;
    }
  }, []);

  return {
    clips,
    recordingState,
    playbackState,
    settings,
    audioDevices,
    isLoading,
    startRecording,
    stopRecording,
    playClip,
    stopPlayback,
    saveClip,
    deleteClip,
    renameClip,
    updateSettings,
    registerHotkey,
    unregisterHotkey
  };
};
