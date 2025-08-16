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
      installAutostart: () => Promise<boolean>;
      uninstallAutostart: () => Promise<boolean>;
      getAutostartStatus: () => Promise<{ isInstalled: boolean; isEnabled: boolean; isActive: boolean }>;
      startSystemAudioCapture: () => Promise<void>;
      stopSystemAudioCapture: () => Promise<any>;
      enableSpeakerLoopback: () => Promise<boolean>;
      disableSpeakerLoopback: () => Promise<boolean>;
      enableHeadphoneLoopback: () => Promise<boolean>;
      disableHeadphoneLoopback: () => Promise<boolean>;
      onRecordingStateChanged: (callback: (state: any) => void) => void;
      onPlaybackStateChanged: (callback: (state: any) => void) => void;
      onClipSaved: (callback: (clip: any) => void) => void;
      onHotkeyPressed: (callback: (clipId: string) => void) => void;
      onPlaybackError: (callback: (errorData: any) => void) => void;
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
    virtualAudioDeviceId: '',
    inputDeviceId: '',
    clipsDirectory: '',
    enableHotkeys: false, // DISABLE HOTKEYS BY DEFAULT TO FIX AUTO-PLAY BUG
    volume: 1.0,
    enableVirtualAudioRouting: false,
    enableSystemAudioCapture: false,
    enableAutoStart: false,
    enableSpeakerLoopback: true,
    enableHeadphoneLoopback: true
  });
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

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

  // Set up IPC event listeners - ONLY ONCE
  useEffect(() => {
    console.log('=== SETTING UP EVENT LISTENERS ===');
    console.log('Time:', new Date().toISOString());
    console.log('Stack trace:', new Error().stack);
    
    const handleRecordingStateChanged = (state: RecordingState) => {
      setRecordingState(state);
    };

    const handlePlaybackStateChanged = (state: PlaybackState) => {
      console.log('=== PLAYBACK STATE CHANGED ===');
      console.log('New state:', state);
      console.log('Time:', new Date().toISOString());
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
      console.log('=== HOTKEY PRESSED ===');
      console.log('Clip ID:', clipId);
      console.log('Hotkeys enabled:', settings.enableHotkeys);
      console.log('Stack trace:', new Error().stack);
      console.log('Time:', new Date().toISOString());
      
      // Only process hotkeys if they're enabled
      if (settings.enableHotkeys) {
        console.log('Processing hotkey for clip:', clipId);
        // Could add visual indicator here
      } else {
        console.log('Hotkeys disabled, ignoring hotkey press');
      }
    };

    const handlePlaybackError = (errorData: any) => {
      console.error('Playback error:', errorData);
      setPlaybackError(errorData.message || 'Audio playback failed');
      // Clear error after 5 seconds
      setTimeout(() => setPlaybackError(null), 5000);
    };

    // Register event listeners
    window.electronAPI.onRecordingStateChanged(handleRecordingStateChanged);
    window.electronAPI.onPlaybackStateChanged(handlePlaybackStateChanged);
    window.electronAPI.onClipSaved(handleClipSaved);
    window.electronAPI.onHotkeyPressed(handleHotkeyPressed);
    
    // Listen for playback errors
    window.electronAPI.onPlaybackError(handlePlaybackError);

    // Cleanup
    return () => {
      console.log('=== CLEANING UP EVENT LISTENERS ===');
      window.electronAPI.removeAllListeners('recording-state-changed');
      window.electronAPI.removeAllListeners('playback-state-changed');
      window.electronAPI.removeAllListeners('clip-saved');
      window.electronAPI.removeAllListeners('hotkey-pressed');
      window.electronAPI.removeAllListeners('playback-error');
    };
  }, []); // Empty dependency array - runs only once

  // Audio recording functions
  const startRecording = useCallback(async () => {
    try {
      // Check if system audio capture is enabled
      if (settings.enableSystemAudioCapture && settings.inputDeviceId) {
        // Use system audio capture
        await window.electronAPI.startSystemAudioCapture();
      } else {
        // Use regular microphone recording
        await window.electronAPI.startRecording();
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, [settings.enableSystemAudioCapture, settings.inputDeviceId]);

  const stopRecording = useCallback(async () => {
    try {
      // Check if system audio capture is enabled
      if (settings.enableSystemAudioCapture && settings.inputDeviceId) {
        // Use system audio capture stop
        await window.electronAPI.stopSystemAudioCapture();
      } else {
        // Use regular microphone recording stop
        await window.electronAPI.stopRecording();
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }, [settings.enableSystemAudioCapture, settings.inputDeviceId]);

  // Audio playback functions
  const playClip = useCallback(async (clipId: string) => {
    console.log('=== RENDERER PLAY_CLIP CALLED ===');
    console.log('Clip ID:', clipId);
    console.log('Caller stack trace:', new Error().stack);
    console.log('Current clips state:', clips.length, 'clips loaded');
    
    try {
      await window.electronAPI.playClip(clipId);
    } catch (error) {
      console.error('Failed to play clip:', error);
      throw error;
    }
  }, [clips.length]);

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

  // Loopback management functions
  const enableSpeakerLoopback = useCallback(async () => {
    try {
      const success = await window.electronAPI.enableSpeakerLoopback();
      if (success) {
        setSettings(prev => ({ ...prev, enableSpeakerLoopback: true }));
      }
      return success;
    } catch (error) {
      console.error('Failed to enable speaker loopback:', error);
      throw error;
    }
  }, []);

  const disableSpeakerLoopback = useCallback(async () => {
    try {
      const success = await window.electronAPI.disableSpeakerLoopback();
      if (success) {
        setSettings(prev => ({ ...prev, enableSpeakerLoopback: false }));
      }
      return success;
    } catch (error) {
      console.error('Failed to disable speaker loopback:', error);
      throw error;
    }
  }, []);

  const enableHeadphoneLoopback = useCallback(async () => {
    try {
      const success = await window.electronAPI.enableHeadphoneLoopback();
      if (success) {
        setSettings(prev => ({ ...prev, enableHeadphoneLoopback: true }));
      }
      return success;
    } catch (error) {
      console.error('Failed to enable headphone loopback:', error);
      throw error;
    }
  }, []);

  const disableHeadphoneLoopback = useCallback(async () => {
    try {
      const success = await window.electronAPI.disableHeadphoneLoopback();
      if (success) {
        setSettings(prev => ({ ...prev, enableHeadphoneLoopback: false }));
      }
      return success;
    } catch (error) {
      console.error('Failed to disable headphone loopback:', error);
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
    playbackError,
    startRecording,
    stopRecording,
    playClip,
    stopPlayback,
    saveClip,
    deleteClip,
    renameClip,
    updateSettings,
    registerHotkey,
    unregisterHotkey,
    enableSpeakerLoopback,
    disableSpeakerLoopback,
    enableHeadphoneLoopback,
    disableHeadphoneLoopback
  };
};
