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

// Audio playback imports
const player = require('play-sound')({});
const { exec } = require('child_process');

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
  private currentPlayback: any = null;

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
    ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
      const settings = this.getSettings();
      
      // Check actual auto-start service status if not explicitly set
      if (this.store.get('settings.enableAutoStart') === undefined) {
        try {
          const status = await this.getAutoStartStatus();
          settings.enableAutoStart = status.isInstalled && status.isEnabled;
        } catch (error) {
          console.log('Could not check auto-start status, using default:', error);
        }
      }
      
      return settings;
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

    // Handle playback errors
    ipcMain.on('playback-error', (_, errorData) => {
      this.mainWindow?.webContents.send('playback-error', errorData);
    });

    // Auto-start service management
    ipcMain.handle(IPC_CHANNELS.INSTALL_AUTOSTART, async () => {
      return await this.installAutoStart();
    });

    ipcMain.handle(IPC_CHANNELS.UNINSTALL_AUTOSTART, async () => {
      return await this.uninstallAutoStart();
    });

    ipcMain.handle(IPC_CHANNELS.GET_AUTOSTART_STATUS, async () => {
      return await this.getAutoStartStatus();
    });

    // System audio capture
    ipcMain.handle(IPC_CHANNELS.START_SYSTEM_AUDIO_CAPTURE, () => {
      this.startSystemAudioCapture();
    });

    ipcMain.handle(IPC_CHANNELS.STOP_SYSTEM_AUDIO_CAPTURE, () => {
      return this.stopSystemAudioCapture();
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
    if (!clip || !fs.existsSync(clip.filePath)) {
      console.error('Clip not found or file missing:', clipId);
      return;
    }

    this.playbackState = {
      isPlaying: true,
      currentClipId: clipId,
      progress: 0
    };

    // Notify renderer of playback state change
    this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_STATE_CHANGED, this.playbackState);

    try {
      console.log('Playing clip:', clip.filePath);
      
      // Try multiple playback methods to handle Discord audio conflicts
      this.tryPlaybackMethods(clip.filePath, clipId);
      
    } catch (error) {
      console.error('Failed to play clip:', error);
      this.stopPlayback();
    }
  }

  private tryPlaybackMethods(filePath: string, clipId: string): void {
    const settings = this.getSettings();
    
    // Check if virtual audio routing is enabled and a virtual device is selected
    if (settings.enableVirtualAudioRouting && settings.virtualAudioDeviceId) {
      console.log('Using virtual audio routing to device:', settings.virtualAudioDeviceId);
      this.tryVirtualAudioPlayback(filePath, clipId, settings.virtualAudioDeviceId);
      return;
    }

    // Use selected output device if specified
    if (settings.outputDeviceId && settings.outputDeviceId !== 'default') {
      console.log('Using selected output device:', settings.outputDeviceId);
      this.tryOutputDevicePlayback(filePath, clipId, settings.outputDeviceId);
      return;
    }

    // Method 1: Try play-sound with default settings
    console.log('Trying play-sound method...');
    const audioProcess = player.play(filePath, (err: Error) => {
      if (err) {
        console.log('play-sound failed, trying alternative method...');
        // Method 2: Try using aplay (ALSA) directly
        this.tryAlsaPlayback(filePath, clipId);
      } else {
        console.log('Playback finished for clip:', clipId);
        this.stopPlayback();
      }
    });

    // Store reference to current playback
    this.currentPlayback = { audioProcess, method: 'play-sound' };
    
    // Simulate progress updates
    const progressInterval = setInterval(() => {
      if (this.playbackState.isPlaying) {
        this.playbackState.progress += 0.1;
        if (this.playbackState.progress >= 1) {
          this.playbackState.progress = 1;
          clearInterval(progressInterval);
        }
        this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_STATE_CHANGED, this.playbackState);
      } else {
        clearInterval(progressInterval);
      }
    }, 100);
  }

  private tryAlsaPlayback(filePath: string, clipId: string): void {
    console.log('Trying ALSA playback method...');
    
    // Use aplay command directly to bypass Discord audio conflicts
    const audioProcess = exec(`aplay "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
      if (error) {
        console.log('ALSA playback failed, trying PulseAudio method...');
        // Method 3: Try using paplay (PulseAudio)
        this.tryPulseAudioPlayback(filePath, clipId);
      } else {
        console.log('ALSA playback finished for clip:', clipId);
        this.stopPlayback();
      }
    });

    // Update current playback reference
    this.currentPlayback = { audioProcess, method: 'alsa' };
  }

  private tryPulseAudioPlayback(filePath: string, clipId: string): void {
    console.log('Trying PulseAudio playback method...');
    
    // Use paplay command to play through PulseAudio
    const audioProcess = exec(`paplay "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
      if (error) {
        console.log('All playback methods failed');
        this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_ERROR, {
          message: 'All audio playback methods failed. Try closing Discord or changing audio settings.',
          details: error.message
        });
        this.stopPlayback();
      } else {
        console.log('PulseAudio playback finished for clip:', clipId);
        this.stopPlayback();
      }
    });

    // Update current playback reference
    this.currentPlayback = { audioProcess, method: 'pulseaudio' };
  }

  private tryVirtualAudioPlayback(filePath: string, clipId: string, virtualDeviceId: string): void {
    console.log('Trying virtual audio playback method...');
    console.log('Virtual device ID:', virtualDeviceId);
    
    // Validate that the virtual device actually exists
    if (!this.isValidVirtualDevice(virtualDeviceId)) {
      console.log('Invalid virtual device ID, falling back to default...');
      this.tryPlaybackMethods(filePath, clipId);
      return;
    }
    
    try {
      let audioProcess: any;
      
      if (virtualDeviceId.startsWith('pulse-')) {
        // PulseAudio virtual device - extract the actual device name
        const deviceId = virtualDeviceId.replace('pulse-', '');
        console.log('Using PulseAudio device ID:', deviceId);
        
        // Get the actual device name from pactl
        try {
          const { execSync } = require('child_process');
          const pulseOutput = execSync('pactl list short sinks', { stdio: 'pipe' }).toString();
          const lines = pulseOutput.split('\n').filter((line: string) => line.trim());
          
          for (const line of lines) {
            const parts = line.split('\t');
            if (parts[0] === deviceId && parts.length >= 2) {
              const deviceName = parts[1];
              console.log('Found device name:', deviceName);
              
              audioProcess = exec(`paplay --device="${deviceName}" "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
                if (error) {
                  console.log('Virtual PulseAudio playback failed, falling back to default...');
                  this.tryPlaybackMethods(filePath, clipId);
                } else {
                  console.log('Virtual PulseAudio playback finished for clip:', clipId);
                  this.stopPlayback();
                }
              });
              break;
            }
          }
          
          if (!audioProcess) {
            console.log('Device not found, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId);
            return;
          }
        } catch (error) {
          console.log('Could not get device name, falling back to default...');
          this.tryPlaybackMethods(filePath, clipId);
          return;
        }
      } else if (virtualDeviceId.startsWith('alsa-')) {
        // ALSA virtual device
        const cardId = virtualDeviceId.replace('alsa-', '');
        audioProcess = exec(`aplay -D hw:${cardId},0 "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
          if (error) {
            console.log('Virtual ALSA playback failed, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId);
          } else {
            console.log('Virtual ALSA playback finished for clip:', clipId);
            this.stopPlayback();
          }
        });
      } else if (virtualDeviceId === 'soundboard-output') {
        // SoundBoard virtual output device
        console.log('Using SoundBoard virtual output device directly');
        audioProcess = exec(`paplay --device=soundboard-output "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
          if (error) {
            console.log('SoundBoard virtual output playback failed, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId);
          } else {
            console.log('SoundBoard virtual output playback finished for clip:', clipId);
            this.stopPlayback();
          }
        });
      } else if (virtualDeviceId === 'vb-cable') {
        // VB-Cable virtual device (Windows-style, but we'll try on Linux)
        audioProcess = exec(`paplay --device=VB-Audio "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
          if (error) {
            console.log('VB-Cable playback failed, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId);
          } else {
            console.log('VB-Cable playback finished for clip:', clipId);
            this.stopPlayback();
          }
        });
      } else {
        // Generic virtual device - try PulseAudio first
        audioProcess = exec(`paplay --device="${virtualDeviceId}" "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
          if (error) {
            console.log('Generic virtual device playback failed, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId);
          } else {
            console.log('Generic virtual device playback finished for clip:', clipId);
            this.stopPlayback();
          }
        });
      }

      // Store reference to current playback
      this.currentPlayback = { audioProcess, method: 'virtual' };
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        if (this.playbackState.isPlaying) {
          this.playbackState.progress += 0.1;
          if (this.playbackState.progress >= 1) {
            this.playbackState.progress = 1;
            clearInterval(progressInterval);
          }
          this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_STATE_CHANGED, this.playbackState);
        } else {
          clearInterval(progressInterval);
        }
      }, 100);
      
    } catch (error) {
      console.error('Virtual audio playback failed:', error);
      // Fall back to regular playback methods
      this.tryPlaybackMethods(filePath, clipId);
    }
  }

  private tryOutputDevicePlayback(filePath: string, clipId: string, outputDeviceId: string): void {
    console.log('Trying output device playback method...');
    console.log('Output device ID:', outputDeviceId);
    
    try {
      let audioProcess: any;
      
      if (outputDeviceId.startsWith('pulse-')) {
        // PulseAudio output device - extract the actual device name
        const deviceId = outputDeviceId.replace('pulse-', '');
        console.log('Using PulseAudio device ID:', deviceId);
        
        // Get the actual device name from pactl
        try {
          const { execSync } = require('child_process');
          const pulseOutput = execSync('pactl list short sinks', { stdio: 'pipe' }).toString();
          const lines = pulseOutput.split('\n').filter((line: string) => line.trim());
          
          for (const line of lines) {
            const parts = line.split('\t');
            if (parts[0] === deviceId && parts.length >= 2) {
              const deviceName = parts[1];
              console.log('Found device name:', deviceName);
              
              audioProcess = exec(`paplay --device="${deviceName}" "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
                if (error) {
                  console.log('Output device playback failed, falling back to default...');
                  this.tryPlaybackMethods(filePath, clipId);
                } else {
                  console.log('Output device playback finished for clip:', clipId);
                  this.stopPlayback();
                }
              });
              break;
            }
          }
          
          if (!audioProcess) {
            console.log('Device not found, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId);
            return;
          }
        } catch (error) {
          console.log('Could not get device name, falling back to default...');
          this.tryPlaybackMethods(filePath, clipId);
          return;
        }
      } else if (outputDeviceId === 'soundboard-output') {
        // SoundBoard virtual output device
        console.log('Using SoundBoard virtual output device directly');
        audioProcess = exec(`paplay --device=soundboard-output "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
          if (error) {
            console.log('SoundBoard virtual output playback failed, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId);
          } else {
            console.log('SoundBoard virtual output playback finished for clip:', clipId);
            this.stopPlayback();
          }
        });
      } else if (outputDeviceId.startsWith('alsa-')) {
        // ALSA output device
        const cardId = outputDeviceId.replace('alsa-', '');
        audioProcess = exec(`aplay -D hw:${cardId},0 "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
          if (error) {
            console.log('Output device playback failed, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId);
          } else {
            console.log('Output device playback finished for clip:', clipId);
            this.stopPlayback();
          }
        });
      } else {
        // Generic output device - try PulseAudio first
        audioProcess = exec(`paplay --device="${outputDeviceId}" "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
          if (error) {
            console.log('Output device playback failed, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId);
          } else {
            console.log('Output device playback finished for clip:', clipId);
            this.stopPlayback();
          }
        });
      }

      // Store reference to current playback
      this.currentPlayback = { audioProcess, method: 'output-device' };
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        if (this.playbackState.isPlaying) {
          this.playbackState.progress += 0.1;
          if (this.playbackState.progress >= 1) {
            this.playbackState.progress = 1;
            clearInterval(progressInterval);
          }
          this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_STATE_CHANGED, this.playbackState);
        } else {
          clearInterval(progressInterval);
        }
      }, 100);
      
    } catch (error) {
      console.error('Output device playback failed:', error);
      // Fall back to regular playback methods
      this.tryPlaybackMethods(filePath, clipId);
    }
  }

  private stopPlayback(): void {
    // Stop current playback if active
    if (this.currentPlayback) {
      try {
        if (this.currentPlayback.audioProcess) {
          // Kill the audio process if it's still running
          if (this.currentPlayback.audioProcess.kill) {
            this.currentPlayback.audioProcess.kill();
          }
        }
      } catch (error) {
        console.error('Error stopping playback:', error);
      }
      this.currentPlayback = null;
    }

    this.playbackState = {
      isPlaying: false,
      currentClipId: undefined,
      progress: 0
    };

    this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_STATE_CHANGED, this.playbackState);
  }

  private getClips(): AudioClip[] {
    const clips = this.store.get('clips', []) as any[];
    // Convert createdAt strings back to Date objects
    return clips.map(clip => ({
      ...clip,
      createdAt: clip.createdAt ? new Date(clip.createdAt) : new Date()
    }));
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
      virtualAudioDeviceId: '',
      inputDeviceId: '',
      clipsDirectory: this.clipsDirectory,
      enableHotkeys: true,
      volume: 1.0,
      enableVirtualAudioRouting: false,
      enableSystemAudioCapture: false,
      enableAutoStart: false
    };

    const storedSettings = this.store.get('settings', {});
    const settings = { ...defaultSettings, ...storedSettings };

    return settings;
  }

  private async installAutoStart(): Promise<boolean> {
    try {
      const { execSync } = require('child_process');
      const scriptPath = path.join(process.cwd(), 'scripts', 'install-autostart.sh');
      
      // Check if script exists
      if (!fs.existsSync(scriptPath)) {
        console.error('Auto-start script not found:', scriptPath);
        return false;
      }

      // Make script executable and run it
      execSync(`chmod +x "${scriptPath}"`, { stdio: 'pipe' });
      execSync(`"${scriptPath}"`, { stdio: 'pipe' });
      
      // Update settings to reflect auto-start is enabled
      const currentSettings = this.getSettings();
      currentSettings.enableAutoStart = true;
      this.store.set('settings', currentSettings);
      
      return true;
    } catch (error) {
      console.error('Failed to install auto-start service:', error);
      return false;
    }
  }

  private async uninstallAutoStart(): Promise<boolean> {
    try {
      const { execSync } = require('child_process');
      const scriptPath = path.join(process.cwd(), 'scripts', 'uninstall-autostart.sh');
      
      // Check if script exists
      if (!fs.existsSync(scriptPath)) {
        console.error('Auto-start uninstall script not found:', scriptPath);
        return false;
      }

      // Make script executable and run it
      execSync(`chmod +x "${scriptPath}"`, { stdio: 'pipe' });
      execSync(`"${scriptPath}"`, { stdio: 'pipe' });
      
      // Update settings to reflect auto-start is disabled
      const currentSettings = this.getSettings();
      currentSettings.enableAutoStart = false;
      this.store.set('settings', currentSettings);
      
      return true;
    } catch (error) {
      console.error('Failed to uninstall auto-start service:', error);
      return false;
    }
  }

  private async getAutoStartStatus(): Promise<{ isInstalled: boolean; isEnabled: boolean; isActive: boolean }> {
    try {
      const { execSync } = require('child_process');
      
      // Check if service file exists
      const servicePath = path.join(os.homedir(), '.config', 'systemd', 'user', 'soundboard-audio.service');
      const isInstalled = fs.existsSync(servicePath);
      
      if (!isInstalled) {
        return { isInstalled: false, isEnabled: false, isActive: false };
      }

      // Check if service is enabled
      const isEnabled = execSync('systemctl --user is-enabled soundboard-audio.service', { stdio: 'pipe' }).toString().trim() === 'enabled';
      
      // Check if service is active
      const isActive = execSync('systemctl --user is-active soundboard-audio.service', { stdio: 'pipe' }).toString().trim() === 'active';
      
      return { isInstalled, isEnabled, isActive };
    } catch (error) {
      console.error('Failed to get auto-start status:', error);
      return { isInstalled: false, isEnabled: false, isActive: false };
    }
  }

  private startSystemAudioCapture(): void {
    if (this.isRecording) return;

    const settings = this.getSettings();
    console.log('System audio capture settings:', settings);
    
    if (!settings.enableSystemAudioCapture) {
      console.log('System audio capture is disabled');
      return;
    }

    const inputDeviceId = settings.inputDeviceId;
    console.log('Input device ID:', inputDeviceId);
    
    if (!inputDeviceId || !inputDeviceId.startsWith('monitor-')) {
      console.log('No monitor device selected for system audio capture');
      return;
    }

    this.isRecording = true;
    this.recordingStartTime = Date.now();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentRecordingFile = path.join(this.clipsDirectory, `system_audio_${timestamp}.wav`);

    try {
      // Import execSync at the top
      const { execSync } = require('child_process');
      
      // Check if ffmpeg is available
      try {
        execSync('ffmpeg -version', { stdio: 'pipe' });
      } catch (error) {
        console.error('FFmpeg is not installed. Please install ffmpeg to use system audio capture.');
        this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_ERROR, {
          message: 'FFmpeg is not installed',
          details: 'Please install ffmpeg to use system audio capture: sudo apt install ffmpeg'
        });
        this.isRecording = false;
        return;
      }

      // Extract the device ID from the monitor device ID
      const deviceId = inputDeviceId.replace('monitor-', '');
      console.log('Starting system audio capture from device ID:', deviceId);
      console.log('Original inputDeviceId:', inputDeviceId);
      console.log('Extracted deviceId:', deviceId);

      // Get the actual monitor source name from PulseAudio
      const pulseOutput = execSync('pactl list short sources', { stdio: 'pipe' }).toString();
      const lines = pulseOutput.split('\n').filter((line: string) => line.trim());
      
      let monitorSourceName = '';
      console.log('Parsing PulseAudio sources, looking for device ID:', deviceId);
      
      // Find the monitor source by matching the device ID
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const sourceId = parts[0];
          const sourceName = parts[1];
          console.log(`Source ID: ${sourceId}, Name: ${sourceName}`);
          
          // Check if this source ID matches our device ID
          if (sourceId === deviceId) {
            monitorSourceName = sourceName;
            console.log('Found monitor source:', monitorSourceName);
            break;
          }
        }
      }

      if (!monitorSourceName) {
        console.error('Could not find monitor source for device ID:', deviceId);
        console.log('Available sources:', lines);
        this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_ERROR, {
          message: 'Monitor source not found',
          details: `Could not find monitor source for device ID: ${deviceId}. Available sources: ${lines.map((l: string) => l.split('\t')[0] + ':' + l.split('\t')[1]).join(', ')}`
        });
        this.isRecording = false;
        return;
      }

      console.log('Using monitor source:', monitorSourceName);
      
      // Use ffmpeg to capture from the monitor source
      const ffmpegCommand = `ffmpeg -f pulse -i "${monitorSourceName}" -acodec pcm_s16le -ar 44100 -ac 1 -y "${this.currentRecordingFile}"`;
      
      console.log('Running ffmpeg command:', ffmpegCommand);
      
      const audioProcess = exec(ffmpegCommand, (error: Error, stdout: string, stderr: string) => {
        if (error) {
          console.error('FFmpeg system audio capture failed:', error);
          console.error('FFmpeg stderr:', stderr);
          this.isRecording = false;
          
          // Notify renderer of the error
          this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_ERROR, {
            message: 'System audio capture failed',
            details: error.message || 'FFmpeg failed to capture audio'
          });
        } else {
          console.log('FFmpeg system audio capture finished successfully');
          this.isRecording = false;
        }
      });

      // Store the recording process
      this.recordingStream = audioProcess;
      
      // Set up a timer to stop recording after a reasonable duration (e.g., 30 seconds)
      setTimeout(() => {
        if (this.isRecording) {
          console.log('Auto-stopping system audio capture after timeout');
          this.stopSystemAudioCapture();
        }
      }, 30000); // 30 seconds timeout

    } catch (error) {
      console.error('Failed to start system audio capture:', error);
      this.isRecording = false;
      
      // Notify renderer of the error
      this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_ERROR, {
        message: 'System audio capture failed',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }

    // Notify renderer of recording state change
    this.mainWindow?.webContents.send(IPC_CHANNELS.RECORDING_STATE_CHANGED, {
      isRecording: true,
      duration: 0,
      startTime: this.recordingStartTime
    });
  }

  private stopSystemAudioCapture(): AudioClip | null {
    if (!this.isRecording) return null;

    this.isRecording = false;
    const duration = (Date.now() - this.recordingStartTime) / 1000;

    if (this.recordingStream) {
      this.recordingStream.kill(); // Use kill() to stop the process
      this.recordingStream = null;
    }

    // Wait a bit for file to be written
    setTimeout(() => {
      if (fs.existsSync(this.currentRecordingFile)) {
        const clip: AudioClip = {
          id: this.generateClipId(),
          name: `System_Audio_${this.generateClipNumber()}`,
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

  private updateSettings(settings: Partial<AppSettings>): AppSettings {
    const currentSettings = this.getSettings();
    
    // Validate virtual audio device ID if it's being updated
    if (settings.virtualAudioDeviceId && !this.isValidVirtualDevice(settings.virtualAudioDeviceId)) {
      console.log('Invalid virtual audio device ID, falling back to default');
      settings.virtualAudioDeviceId = '';
    }
    
    const updatedSettings = { ...currentSettings, ...settings };
    
    this.store.set('settings', updatedSettings);
    
    if (settings.clipsDirectory) {
      this.clipsDirectory = settings.clipsDirectory;
      this.ensureClipsDirectory();
    }

    return updatedSettings;
  }

  private isValidVirtualDevice(deviceId: string): boolean {
    try {
      if (deviceId === 'soundboard-output') {
        // Check if soundboard-output exists
        const { execSync } = require('child_process');
        const pulseOutput = execSync('pactl list short sinks', { stdio: 'pipe' }).toString();
        return pulseOutput.includes('soundboard-output');
      }
      
      if (deviceId.startsWith('pulse-')) {
        // Check if PulseAudio device exists
        const { execSync } = require('child_process');
        const deviceIdNum = deviceId.replace('pulse-', '');
        const pulseOutput = execSync('pactl list short sinks', { stdio: 'pipe' }).toString();
        const lines = pulseOutput.split('\n').filter((line: string) => line.trim());
        
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts[0] === deviceIdNum && parts.length >= 2) {
            return true;
          }
        }
        return false;
      }
      
      if (deviceId.startsWith('alsa-')) {
        // Check if ALSA device exists
        const { execSync } = require('child_process');
        const cardId = deviceId.replace('alsa-', '');
        const alsaOutput = execSync('aplay -l', { stdio: 'pipe' }).toString();
        return alsaOutput.includes(`card ${cardId}:`);
      }
      
      return false;
    } catch (error) {
      console.log('Error validating virtual device:', error);
      return false;
    }
  }

  private getAudioDevices(): AudioDevice[] {
    try {
      const devices: AudioDevice[] = [];
      
      // Add default device
      devices.push({
        id: 'default',
        name: 'Default Output',
        type: 'output',
        isDefault: true
      });

      // Try to get PulseAudio sinks (including virtual ones)
      try {
        const { execSync } = require('child_process');
        const pulseOutput = execSync('pactl list short sinks', { stdio: 'pipe' }).toString();
        const lines = pulseOutput.split('\n').filter((line: string) => line.trim());
        
        lines.forEach((line: string, index: number) => {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const deviceName = parts[1];
            const deviceId = parts[0];
            
            // Skip monitor sources and other non-playback devices
            if (deviceName.toLowerCase().includes('monitor') || 
                deviceName.toLowerCase().includes('loopback')) {
              return;
            }
            
            const isVirtual = deviceName.toLowerCase().includes('virtual') || 
                             deviceName.toLowerCase().includes('null') ||
                             deviceName.toLowerCase().includes('soundboard-output');
            
            // Determine if it's headphones, speakers, or other
            let displayName = deviceName;
            if (deviceName.toLowerCase().includes('bluetooth') || deviceName.toLowerCase().includes('bluez')) {
              displayName = `🎧 ${deviceName}`;
            } else if (deviceName.toLowerCase().includes('speaker')) {
              displayName = `📺 ${deviceName}`;
            } else if (deviceName.toLowerCase().includes('hdmi')) {
              displayName = `📺 ${deviceName}`;
            } else if (isVirtual) {
              displayName = `🔌 ${deviceName}`;
            }
            
            devices.push({
              id: `pulse-${deviceId}`,
              name: displayName,
              type: isVirtual ? 'virtual' : 'output',
              isDefault: index === 0,
              isVirtual,
              description: isVirtual ? 'Virtual device for Discord integration' : undefined
            });
          }
        });
      } catch (error: any) {
        console.log('Could not get PulseAudio devices:', error.message);
      }

      // Try to get ALSA devices
      try {
        const { execSync } = require('child_process');
        const alsaOutput = execSync('aplay -l', { stdio: 'pipe' }).toString();
        const lines = alsaOutput.split('\n').filter((line: string) => line.includes('card'));
        
        lines.forEach((line: string, index: number) => {
          const match = line.match(/card (\d+): (.+?) \[(.+?)\]/);
          if (match) {
            const deviceName = `${match[2]} (${match[3]})`;
            const isVirtual = deviceName.toLowerCase().includes('virtual') || 
                             deviceName.toLowerCase().includes('null') ||
                             deviceName.toLowerCase().includes('loopback');
            
            devices.push({
              id: `alsa-${match[1]}`,
              name: deviceName,
              type: isVirtual ? 'virtual' : 'output',
              isDefault: false,
              isVirtual,
              description: isVirtual ? 'Virtual device for Discord integration' : undefined
            });
          }
        });
      } catch (error: any) {
        console.log('Could not get ALSA devices:', error.message);
      }

      // Add common virtual audio devices that users might install
      const commonVirtualDevices = [
        {
          id: 'soundboard-output',
          name: '🔌 SoundBoard Virtual Output',
          type: 'virtual' as const,
          isDefault: false,
          isVirtual: true,
          description: 'Virtual output device for Discord integration (created by setup script)'
        },
        {
          id: 'vb-cable',
          name: '🔌 VB-Cable Virtual Audio Device',
          type: 'virtual' as const,
          isDefault: false,
          isVirtual: true,
          description: 'Virtual audio cable for Discord integration (requires VB-Cable installation)'
        }
      ];

      // Only add these if they don't already exist
      commonVirtualDevices.forEach(virtualDevice => {
        if (!devices.some(d => d.id === virtualDevice.id)) {
          devices.push(virtualDevice);
        }
      });

      // Try to get PulseAudio monitor sources for system audio capture
      try {
        const { execSync } = require('child_process');
        const pulseOutput = execSync('pactl list short sources', { stdio: 'pipe' }).toString();
        const lines = pulseOutput.split('\n').filter((line: string) => line.trim());
        
        lines.forEach((line: string, index: number) => {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const deviceName = parts[1];
            const deviceId = parts[0];
            
            // Check if this is a monitor source (for system audio capture)
            if (deviceName.toLowerCase().includes('monitor')) {
              // Extract the actual source name (remove .monitor suffix)
              const sourceName = deviceName.replace('.monitor', '');
              
              // Get the description of the actual source
              let sourceDescription = '';
              try {
                const sourceDetails = execSync(`pactl list sources | grep -A 10 "Name: ${sourceName}"`, { stdio: 'pipe' }).toString();
                const descriptionMatch = sourceDetails.match(/Description: (.+)/);
                if (descriptionMatch) {
                  sourceDescription = descriptionMatch[1];
                }
              } catch (error) {
                // If we can't get the description, use the source name
                sourceDescription = sourceName;
              }
              
              devices.push({
                id: `monitor-${deviceId}`,
                name: `🎵 ${sourceDescription || sourceName} (System Audio)`,
                type: 'monitor',
                isDefault: false,
                isMonitor: true,
                description: `Capture audio from ${sourceDescription || sourceName}`
              });
            } else if (!deviceName.includes('monitor') && !deviceName.includes('sink')) {
              // This is an input source (microphone)
              let displayName = deviceName;
              if (deviceName.includes('bluetooth') || deviceName.includes('bluez')) {
                displayName = `🎧 ${deviceName}`;
              } else if (deviceName.includes('usb')) {
                displayName = `🔌 ${deviceName}`;
              } else if (deviceName.includes('built-in') || deviceName.includes('Mic')) {
                displayName = `🎤 ${deviceName}`;
              }
              
              devices.push({
                id: deviceName,
                name: displayName,
                type: 'input',
                isDefault: false,
                isMonitor: false,
                description: `Microphone input device`
              });
            }
          }
        });
      } catch (error: any) {
        console.log('Could not get PulseAudio monitor sources:', error.message);
      }

      return devices.length > 0 ? devices : [
        { id: 'default', name: 'Default Output', type: 'output', isDefault: true }
      ];
    } catch (error) {
      console.error('Error getting audio devices:', error);
      return [
        { id: 'default', name: 'Default Output', type: 'output', isDefault: true }
      ];
    }
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
