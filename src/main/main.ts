import { app, BrowserWindow, ipcMain, globalShortcut, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import Store from 'electron-store';
import { AudioClip, AudioDevice, AppSettings, IPC_CHANNELS, RecordingState, PlaybackState } from '../shared/types';

// Type the store properly
interface StoreSchema {
  clipsDirectory?: string;
  clips?: AudioClip[];
  settings?: Partial<AppSettings>;
}

// Audio recording imports
const mic = require('mic');
const wav = require('wav');

class SoundboardApp {
  private mainWindow: BrowserWindow | null = null;
  private store: any;
  private clipsDirectory: string;
  private isRecording = false;
  private recordingStream: any = null;
  private recordingStartTime: number = 0;
  private currentRecordingFile: string = '';
  private hotkeyMap = new Map<string, string>(); // hotkey -> clipId
  private playbackState: PlaybackState = {
    isPlaying: false,
    currentClipId: undefined,
    progress: 0
  };

  constructor() {
    this.store = new Store();
    this.clipsDirectory = this.getClipsDirectory();
    this.ensureClipsDirectory();
    this.loadHotkeys();
  }

  private getClipsDirectory(): string {
    const userClipsDir = this.store.get('clipsDirectory') as string;
    if (userClipsDir && fs.existsSync(userClipsDir)) {
      return userClipsDir;
    }
    
    const defaultDir = path.join(os.homedir(), 'Documents', 'SoundboardApp', 'clips');
    this.store.set('clipsDirectory', defaultDir);
    return defaultDir;
  }

  private ensureClipsDirectory(): void {
    if (!fs.existsSync(this.clipsDirectory)) {
      fs.mkdirSync(this.clipsDirectory, { recursive: true });
    }
  }

  private loadHotkeys(): void {
    const clips = this.store.get('clips', []) as AudioClip[];
    clips.forEach(clip => {
      if (clip.hotkey) {
        this.hotkeyMap.set(clip.hotkey, clip.id);
      }
    });
  }

  public createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(process.cwd(), 'dist', 'main', 'main', 'preload.js')
      },
      titleBarStyle: 'default',
      show: false,
      icon: path.join(process.cwd(), 'src', 'assets', 'icon.png')
    });

    // Load the renderer
    const rendererPath = path.join(process.cwd(), 'dist', 'renderer', 'index.html');
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadFile(rendererPath);
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(rendererPath);
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  public setupIPC(): void {
    // Audio recording
    ipcMain.handle(IPC_CHANNELS.START_RECORDING, () => {
      this.startRecording();
    });

    ipcMain.handle(IPC_CHANNELS.STOP_RECORDING, () => {
      return this.stopRecording();
    });

    // Audio playback
    ipcMain.handle(IPC_CHANNELS.PLAY_CLIP, (_, clipId: string) => {
      this.playClip(clipId);
    });

    ipcMain.handle(IPC_CHANNELS.STOP_PLAYBACK, () => {
      this.stopPlayback();
    });

    // Clip management
    ipcMain.handle(IPC_CHANNELS.GET_CLIPS, () => {
      return this.getClips();
    });

    ipcMain.handle(IPC_CHANNELS.SAVE_CLIP, (_, clip: AudioClip) => {
      return this.saveClip(clip);
    });

    ipcMain.handle(IPC_CHANNELS.DELETE_CLIP, (_, clipId: string) => {
      return this.deleteClip(clipId);
    });

    ipcMain.handle(IPC_CHANNELS.RENAME_CLIP, (_, { id, name }: { id: string; name: string }) => {
      return this.renameClip(id, name);
    });

    // Settings
    ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
      return this.getSettings();
    });

    ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, (_, settings: Partial<AppSettings>) => {
      return this.updateSettings(settings);
    });

    ipcMain.handle(IPC_CHANNELS.GET_AUDIO_DEVICES, () => {
      return this.getAudioDevices();
    });

    // Hotkeys
    ipcMain.handle(IPC_CHANNELS.REGISTER_HOTKEY, (_, assignment: { clipId: string; key: string; modifiers: string[] }) => {
      return this.registerHotkey(assignment);
    });

    ipcMain.handle(IPC_CHANNELS.UNREGISTER_HOTKEY, (_, clipId: string) => {
      return this.unregisterHotkey(clipId);
    });
  }

  private startRecording(): void {
    if (this.isRecording) return;

    this.isRecording = true;
    this.recordingStartTime = Date.now();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentRecordingFile = path.join(this.clipsDirectory, `clip_${timestamp}.wav`);

    const micInstance = mic({
      rate: '44100',
      channels: '1',
      debug: false,
      exitOnSilence: 6
    });

    const micInputStream = micInstance.getAudioStream();
    const outputFileStream = new wav.FileWriter(this.currentRecordingFile, {
      channels: 1,
      sampleRate: 44100,
      bitDepth: 16
    });

    micInputStream.pipe(outputFileStream);
    micInputStream.on('data', () => {
      // Data is being recorded
    });

    micInputStream.on('error', (err: Error) => {
      console.error('Error recording audio:', err);
      this.isRecording = false;
    });

    micInstance.start();
    this.recordingStream = micInstance;

    // Notify renderer of recording state change
    this.mainWindow?.webContents.send(IPC_CHANNELS.RECORDING_STATE_CHANGED, {
      isRecording: true,
      duration: 0,
      startTime: this.recordingStartTime
    });
  }

  private stopRecording(): AudioClip | null {
    if (!this.isRecording) return null;

    this.isRecording = false;
    const duration = (Date.now() - this.recordingStartTime) / 1000;

    if (this.recordingStream) {
      this.recordingStream.stop();
      this.recordingStream = null;
    }

    // Wait a bit for file to be written
    setTimeout(() => {
      if (fs.existsSync(this.currentRecordingFile)) {
        const clip: AudioClip = {
          id: this.generateClipId(),
          name: `Clip_${this.generateClipNumber()}`,
          filePath: this.currentRecordingFile,
          duration: Math.round(duration * 100) / 100,
          createdAt: new Date()
        };

        this.saveClip(clip);
        
        // Notify renderer of new clip
        this.mainWindow?.webContents.send(IPC_CHANNELS.SAVE_CLIP, clip);
      }
    }, 100);

    // Notify renderer of recording state change
    this.mainWindow?.webContents.send(IPC_CHANNELS.RECORDING_STATE_CHANGED, {
      isRecording: false,
      duration: Math.round(duration * 100) / 100,
      startTime: undefined
    });

    return null;
  }

  private generateClipId(): string {
    return `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateClipNumber(): string {
    const clips = this.getClips();
    return (clips.length + 1).toString().padStart(2, '0');
  }

  private playClip(clipId: string): void {
    // Stop current playback
    this.stopPlayback();

    const clips = this.getClips();
    const clip = clips.find(c => c.id === clipId);
    if (!clip || !fs.existsSync(clip.filePath)) return;

    this.playbackState = {
      isPlaying: true,
      currentClipId: clipId,
      progress: 0
    };

    // Notify renderer of playback state change
    this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_STATE_CHANGED, this.playbackState);

    // In a real implementation, you would use a proper audio library like node-speaker
    // For now, we'll simulate playback
    setTimeout(() => {
      this.stopPlayback();
    }, clip.duration * 1000);
  }

  private stopPlayback(): void {
    this.playbackState = {
      isPlaying: false,
      currentClipId: undefined,
      progress: 0
    };

    this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_STATE_CHANGED, this.playbackState);
  }

  private getClips(): AudioClip[] {
    return this.store.get('clips', []) as AudioClip[];
  }

  private saveClip(clip: AudioClip): AudioClip {
    const clips = this.getClips();
    const existingIndex = clips.findIndex(c => c.id === clip.id);
    
    if (existingIndex >= 0) {
      clips[existingIndex] = clip;
    } else {
      clips.push(clip);
    }

    this.store.set('clips', clips);
    return clip;
  }

  private deleteClip(clipId: string): boolean {
    const clips = this.getClips();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return false;

    // Remove from filesystem
    if (fs.existsSync(clip.filePath)) {
      fs.unlinkSync(clip.filePath);
    }

    // Remove hotkey if assigned
    if (clip.hotkey) {
      this.unregisterHotkey(clipId);
    }

    // Remove from storage
    const updatedClips = clips.filter(c => c.id !== clipId);
    this.store.set('clips', updatedClips);

    return true;
  }

  private renameClip(id: string, name: string): AudioClip | null {
    const clips = this.getClips();
    const clipIndex = clips.findIndex(c => c.id === id);
    if (clipIndex === -1) return null;

    clips[clipIndex].name = name;
    this.store.set('clips', clips);
    return clips[clipIndex];
  }

  private getSettings(): AppSettings {
    const defaultSettings: AppSettings = {
      theme: 'system',
      outputDeviceId: '',
      clipsDirectory: this.clipsDirectory,
      enableHotkeys: true,
      volume: 1.0
    };

    return { ...defaultSettings, ...this.store.get('settings', {}) };
  }

  private updateSettings(settings: Partial<AppSettings>): AppSettings {
    const currentSettings = this.getSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    
    this.store.set('settings', updatedSettings);
    
    if (settings.clipsDirectory) {
      this.clipsDirectory = settings.clipsDirectory;
      this.ensureClipsDirectory();
    }

    return updatedSettings;
  }

  private getAudioDevices(): AudioDevice[] {
    // In a real implementation, you would use a library like node-speaker or similar
    // to get actual audio devices. For now, return mock devices.
    return [
      { id: 'default', name: 'Default Output', type: 'output', isDefault: true },
      { id: 'vb-cable', name: 'VB-Cable Virtual Audio', type: 'output', isDefault: false },
      { id: 'blackhole', name: 'BlackHole 2ch', type: 'output', isDefault: false }
    ];
  }

  private registerHotkey(assignment: { clipId: string; key: string; modifiers: string[] }): boolean {
    const { clipId, key, modifiers } = assignment;
    const hotkeyString = [...modifiers, key].join('+');
    
    // Unregister existing hotkey for this clip
    this.unregisterHotkey(clipId);
    
    // Unregister existing hotkey if it conflicts
    if (this.hotkeyMap.has(hotkeyString)) {
      const existingClipId = this.hotkeyMap.get(hotkeyString);
      if (existingClipId) {
        this.unregisterHotkey(existingClipId);
      }
    }

    // Register new hotkey
    try {
      const success = globalShortcut.register(hotkeyString, () => {
        this.playClip(clipId);
      });

      if (success) {
        this.hotkeyMap.set(hotkeyString, clipId);
        
        // Update clip with hotkey
        const clips = this.getClips();
        const clipIndex = clips.findIndex(c => c.id === clipId);
        if (clipIndex >= 0) {
          clips[clipIndex].hotkey = hotkeyString;
          this.store.set('clips', clips);
        }

        return true;
      }
    } catch (error) {
      console.error('Failed to register hotkey:', error);
    }

    return false;
  }

  private unregisterHotkey(clipId: string): boolean {
    const clips = this.getClips();
    const clip = clips.find(c => c.id === clipId);
    if (!clip?.hotkey) return false;

    const hotkeyString = clip.hotkey;
    
    // Unregister from Electron
    globalShortcut.unregister(hotkeyString);
    
    // Remove from hotkey map
    this.hotkeyMap.delete(hotkeyString);
    
    // Remove from clip
    const clipIndex = clips.findIndex(c => c.id === clipId);
    if (clipIndex >= 0) {
      clips[clipIndex].hotkey = undefined;
      this.store.set('clips', clips);
    }

    return true;
  }

  public setupGlobalShortcuts(): void {
    // Register any existing hotkeys on startup
    const clips = this.getClips();
    clips.forEach(clip => {
      if (clip.hotkey) {
        this.registerHotkey({
          clipId: clip.id,
          key: clip.hotkey.split('+').pop() || '',
          modifiers: clip.hotkey.split('+').slice(0, -1)
        });
      }
    });
  }

  public cleanup(): void {
    // Unregister all hotkeys
    globalShortcut.unregisterAll();
    
    // Stop recording if active
    if (this.isRecording) {
      this.stopRecording();
    }
  }
}

// App lifecycle
const soundboardApp = new SoundboardApp();

app.whenReady().then(() => {
  soundboardApp.createWindow();
  soundboardApp.setupIPC();
  soundboardApp.setupGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      soundboardApp.createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  soundboardApp.cleanup();
});

app.on('before-quit', () => {
  soundboardApp.cleanup();
});
