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
  private recordingTimeout: NodeJS.Timeout | null = null;
  private hotkeyMap = new Map<string, string>(); // hotkey -> clipId
  private playbackState: PlaybackState = {
    isPlaying: false,
    currentClipId: undefined,
    progress: 0,
    startTime: 0
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

    // Check if this is a system audio recording
    if (this.recordingStream && this.recordingStream.process) {
      console.log('Regular stopRecording called on system audio capture, redirecting...');
      return this.stopSystemAudioCapture();
    }

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
    console.log(`=== PLAY_CLIP CALLED ===`);
    console.log(`Clip ID: ${clipId}`);
    console.log(`Current playback state before:`, this.playbackState);
    
    // Safety check: if we're already playing something, stop it first
    if (this.playbackState.isPlaying) {
      console.log(`Already playing clip ${this.playbackState.currentClipId}, stopping it first`);
      this.stopPlayback();
    }
    
    // Stop current playback (in case there are any lingering processes)
    this.stopPlayback();

    const clips = this.getClips();
    const clip = clips.find(c => c.id === clipId);
    if (!clip || !fs.existsSync(clip.filePath)) {
      console.error('Clip not found or file missing:', clipId);
      return;
    }

    // Check if this is a system audio capture
    const isSystemAudio = clip.name.startsWith('System_Audio_') || clip.filePath.includes('system_audio_');
    console.log('Playing clip:', clip.name, 'isSystemAudio:', isSystemAudio, 'duration:', clip.duration);

    // Set playback state
    this.playbackState = {
      isPlaying: true,
      currentClipId: clipId,
      progress: 0,
      startTime: Date.now()
    };

    console.log(`New playback state set:`, this.playbackState);

    // Notify renderer of playback state change
    this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_STATE_CHANGED, this.playbackState);

    try {
      console.log('Playing clip:', clip.filePath);
      
      // For system audio files, use a more robust playback method
      if (isSystemAudio) {
        this.playSystemAudioClip(clip.filePath, clipId, clip.duration);
      } else {
        // Try multiple playback methods to handle Discord audio conflicts
        this.tryPlaybackMethods(clip.filePath, clipId, isSystemAudio);
      }
      
    } catch (error) {
      console.error('Failed to play clip:', error);
      this.stopPlayback();
    }
  }

  private playSystemAudioClip(filePath: string, clipId: string, duration: number): void {
    console.log('Using specialized system audio playback for:', clipId);
    
    const settings = this.getSettings();
    
    // PRIORITY 1: Use virtual audio routing if enabled (for Discord integration)
    if (settings.enableVirtualAudioRouting && settings.virtualAudioDeviceId) {
      console.log('Using virtual audio routing for system audio (Discord integration):', settings.virtualAudioDeviceId);
      this.tryVirtualAudioPlayback(filePath, clipId, settings.virtualAudioDeviceId, true);
      return;
    }
    
    // PRIORITY 2: Try PulseAudio with explicit device selection
    if (settings.outputDeviceId && settings.outputDeviceId !== 'default') {
      console.log('Using selected output device for system audio:', settings.outputDeviceId);
      const audioProcess = this.createPulseAudioProcess(filePath, settings.outputDeviceId, clipId);
      
      if (audioProcess) {
        this.currentPlayback = { audioProcess, method: 'system-audio-pulseaudio' };
        console.log('System audio playback started successfully');
        return;
      }
    }
    
    // PRIORITY 3: Use default PulseAudio
    console.log('Using default PulseAudio for system audio');
    const audioProcess = this.createPulseAudioProcess(filePath, 'default', clipId);
    
    if (audioProcess) {
      this.currentPlayback = { audioProcess, method: 'system-audio-pulseaudio' };
      console.log('System audio playback started successfully');
    } else {
      console.error('System audio playback failed, falling back to standard methods');
      this.tryPlaybackMethods(filePath, clipId, true);
    }
  }

  private createPulseAudioProcess(filePath: string, deviceId: string, clipId: string): any {
    try {
      let command = `paplay "${filePath}"`; // Default command
      
      if (deviceId === 'default') {
        command = `paplay "${filePath}"`;
      } else if (deviceId.startsWith('pulse-')) {
        const deviceNum = deviceId.replace('pulse-', '');
        // Get device name from PulseAudio
        const { execSync } = require('child_process');
        const pulseOutput = execSync('pactl list short sinks', { stdio: 'pipe' }).toString();
        const lines = pulseOutput.split('\n').filter((line: string) => line.trim());
        
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts[0] === deviceNum && parts.length >= 2) {
            const deviceName = parts[1];
            command = `paplay --device="${deviceName}" "${filePath}"`;
            break;
          }
        }
      }
      
      console.log('Executing command:', command);
      
      // Use spawn instead of exec for better process control and completion detection
      const { spawn } = require('child_process');
      const args = command.split(' ').slice(1); // Remove the command name
      const audioProcess = spawn('paplay', args);
      
      // Set up proper process monitoring
      audioProcess.on('error', (error: Error) => {
        console.error('System audio PulseAudio spawn error:', error);
        this.handlePlaybackError(error, clipId, 'system-audio-pulseaudio');
      });
      
      audioProcess.on('exit', (code: number, signal: string) => {
        console.log(`System audio PulseAudio playback exited with code: ${code}, signal: ${signal}`);
        if (code === 0) {
          console.log('System audio PulseAudio playback finished successfully');
          // Add a small buffer delay to ensure audio completes before stopping
          setTimeout(() => {
            if (this.playbackState.isPlaying && this.playbackState.currentClipId === clipId) {
              console.log('Stopping playback from spawn exit callback for clip:', clipId);
              this.stopPlayback();
            }
          }, 200); // 200ms buffer to ensure audio completion
        } else {
          console.error('System audio PulseAudio playback failed with code:', code);
          this.handlePlaybackError(new Error(`PulseAudio playback failed with code ${code}`), clipId, 'system-audio-pulseaudio');
        }
      });
      
      return audioProcess;
      
    } catch (error) {
      console.error('Error creating PulseAudio process:', error);
      return null;
    }
  }

  // REMOVED: setupSystemAudioCompletionDetection method - no more artificial completion detection
  // Audio completion is now handled entirely by the process exit event

  private tryPlaybackMethods(filePath: string, clipId: string, isSystemAudio: boolean = false): void {
    const settings = this.getSettings();
    
    // Check if virtual audio routing is enabled and a virtual device is selected
    if (settings.enableVirtualAudioRouting && settings.virtualAudioDeviceId) {
      console.log('Using virtual audio routing to device:', settings.virtualAudioDeviceId);
      this.tryVirtualAudioPlayback(filePath, clipId, settings.virtualAudioDeviceId, isSystemAudio);
      return;
    }

    // Use selected output device if specified
    if (settings.outputDeviceId && settings.outputDeviceId !== 'default') {
      console.log('Using selected output device:', settings.outputDeviceId);
      this.tryOutputDevicePlayback(filePath, clipId, settings.outputDeviceId, isSystemAudio);
      return;
    }

    // Method 1: Try play-sound with default settings
    console.log('Trying play-sound method...');
    const audioProcess = player.play(filePath, (err: Error) => {
      if (err) {
        console.log('play-sound failed, trying alternative method...');
        // Method 2: Try using aplay (ALSA) directly
        this.tryAlsaPlayback(filePath, clipId, isSystemAudio);
      } else {
        console.log('Playback finished for clip:', clipId, 'isSystemAudio:', isSystemAudio);
        this.stopPlayback();
      }
    });

    // Store reference to current playback
    this.currentPlayback = { audioProcess, method: 'play-sound' };
    
    // REMOVED: Progress interval system - let audio finish naturally
    
    // Handle play-sound errors
    if (audioProcess && audioProcess.on) {
      audioProcess.on('error', (error: Error) => {
        console.error('Play-sound process error:', error);
        this.handlePlaybackError(error, clipId, 'play-sound');
      });
    }
  }

  // REMOVED: setupPlaybackTimeout method - no more artificial timeouts

  private cleanupVirtualAudioDevices(): void {
    console.log('Cleaning up virtual audio devices...');
    
    try {
      const { execSync } = require('child_process');
      
      // Get list of all PulseAudio modules
      const modulesOutput = execSync('pactl list short modules', { stdio: 'pipe' }).toString();
      const lines = modulesOutput.split('\n').filter((line: string) => line.trim());
      
      // Find and remove our virtual audio modules
      const modulesToRemove: string[] = [];
      
      lines.forEach((line: string) => {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const moduleId = parts[0];
          const moduleName = parts[1];
          
          // Check if this is one of our virtual audio modules
          if (moduleName.includes('soundboard-output') || 
              moduleName.includes('SoundBoard-Virtual-Microphone') ||
              moduleName.includes('module-null-sink') ||
              moduleName.includes('module-virtual-source') ||
              moduleName.includes('module-loopback')) {
            modulesToRemove.push(moduleId);
          }
        }
      });
      
      // Remove the modules
      modulesToRemove.forEach(moduleId => {
        try {
          console.log(`Removing PulseAudio module ${moduleId}...`);
          execSync(`pactl unload-module ${moduleId}`, { stdio: 'pipe' });
        } catch (error) {
          console.log(`Failed to remove module ${moduleId}:`, error);
        }
      });
      
      console.log(`Cleaned up ${modulesToRemove.length} virtual audio modules`);
      
    } catch (error) {
      console.error('Error cleaning up virtual audio devices:', error);
    }
  }

  private tryAlsaPlayback(filePath: string, clipId: string, isSystemAudio: boolean = false): void {
    console.log('Trying ALSA playback method...');
    
    // Use aplay command directly to bypass Discord audio conflicts
    const audioProcess = exec(`aplay "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
      if (error) {
        console.log('ALSA playback failed, trying PulseAudio method...');
        // Method 3: Try using paplay (PulseAudio)
        this.tryPulseAudioPlayback(filePath, clipId, isSystemAudio);
      } else {
        console.log('ALSA playback finished for clip:', clipId, 'isSystemAudio:', isSystemAudio);
        this.stopPlayback();
      }
    });

    // Update current playback reference
    this.currentPlayback = { audioProcess, method: 'alsa' };
    
    // REMOVED: Timeout system - let audio finish naturally
    
    // Handle ALSA process errors
    if (audioProcess && audioProcess.on) {
      audioProcess.on('error', (error: Error) => {
        console.error('ALSA process error:', error);
        this.handlePlaybackError(error, clipId, 'alsa');
      });
    }
  }

  private tryPulseAudioPlayback(filePath: string, clipId: string, isSystemAudio: boolean = false): void {
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
        console.log('PulseAudio playback finished for clip:', clipId, 'isSystemAudio:', isSystemAudio);
        this.stopPlayback();
      }
    });

    // Update current playback reference
    this.currentPlayback = { audioProcess, method: 'pulseaudio' };
    
    // REMOVED: Timeout system - let audio finish naturally
    
    // Handle PulseAudio process errors
    if (audioProcess && audioProcess.on) {
      audioProcess.on('error', (error: Error) => {
        console.error('PulseAudio process error:', error);
        this.handlePlaybackError(error, clipId, 'pulseaudio');
      });
    }
  }

  private tryVirtualAudioPlayback(filePath: string, clipId: string, virtualDeviceId: string, isSystemAudio: boolean = false): void {
    console.log('Trying virtual audio playback method...');
    console.log('Virtual device ID:', virtualDeviceId);
    
    // Validate that the virtual device actually exists
    if (!this.isValidVirtualDevice(virtualDeviceId)) {
      console.log('Invalid virtual device ID, falling back to default...');
      this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
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
                  this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
                } else {
                  console.log('Virtual PulseAudio playback finished for clip:', clipId, 'isSystemAudio:', isSystemAudio);
                  this.stopPlayback();
                }
              });
              
              // Handle virtual PulseAudio process errors
              if (audioProcess && audioProcess.on) {
                audioProcess.on('error', (error: Error) => {
                  console.error('Virtual PulseAudio process error:', error);
                  this.handlePlaybackError(error, clipId, 'virtual-pulseaudio');
                });
              }
              break;
            }
          }
          
          if (!audioProcess) {
            console.log('Device not found, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
            return;
          }
        } catch (error) {
          console.log('Could not get device name, falling back to default...');
          this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
          return;
        }
      } else if (virtualDeviceId.startsWith('alsa-')) {
        // ALSA virtual device
        const cardId = virtualDeviceId.replace('alsa-', '');
        audioProcess = exec(`aplay -D hw:${cardId},0 "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
          if (error) {
            console.log('Virtual ALSA playback failed, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
          } else {
            console.log('Virtual ALSA playback finished for clip:', clipId, 'isSystemAudio:', isSystemAudio);
            this.stopPlayback();
          }
        });
        
        // Handle virtual ALSA process errors
        if (audioProcess && audioProcess.on) {
          audioProcess.on('error', (error: Error) => {
            console.error('Virtual ALSA process error:', error);
            this.handlePlaybackError(error, clipId, 'virtual-alsa');
          });
        }
      } else if (virtualDeviceId === 'soundboard-output') {
        // SoundBoard virtual output device
        console.log('Using SoundBoard virtual output device directly');
        
        // Use spawn instead of exec for better process control
        const { spawn } = require('child_process');
        audioProcess = spawn('paplay', ['--device=soundboard-output', filePath]);
        
        // Set up proper process monitoring for virtual audio
        audioProcess.on('error', (error: Error) => {
          console.error('SoundBoard virtual output process error:', error);
          this.handlePlaybackError(error, clipId, 'soundboard-output');
        });
        
        audioProcess.on('exit', (code: number, signal: string) => {
          console.log(`SoundBoard virtual output playback exited with code: ${code}, signal: ${signal}`);
          if (code === 0) {
            console.log('SoundBoard virtual output playback finished for clip:', clipId, 'isSystemAudio:', isSystemAudio);
            // Add a small buffer delay to ensure audio completes before stopping
            setTimeout(() => {
              this.stopPlayback();
            }, 200); // 200ms buffer to ensure audio completion
          } else {
            console.log('SoundBoard virtual output playback failed, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
          }
        });
        
        // For system audio clips, set up completion detection
        if (isSystemAudio) {
          // System audio completion detection handled by process exit event
        }
      } else if (virtualDeviceId === 'vb-cable') {
        // VB-Cable virtual device (Windows-style, but we'll try on Linux)
        audioProcess = exec(`paplay --device=VB-Audio "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
          if (error) {
            console.log('VB-Cable playback failed, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
          } else {
            console.log('VB-Cable playback finished for clip:', clipId, 'isSystemAudio:', isSystemAudio);
            this.stopPlayback();
          }
        });
        
        // Handle VB-Cable process errors
        if (audioProcess && audioProcess.on) {
          audioProcess.on('error', (error: Error) => {
            console.error('VB-Cable process error:', error);
            this.handlePlaybackError(error, clipId, 'vb-cable');
          });
        }
      } else {
        // Unknown virtual device type, fall back to default
        console.log('Unknown virtual device type, falling back to default...');
        this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
        return;
      }

      // Update current playback reference
      if (audioProcess) {
        this.currentPlayback = { audioProcess, method: 'virtual' };
        
            // REMOVED: Timeout system - let audio finish naturally
      }
    } catch (error) {
      console.log('Virtual audio playback failed, falling back to default...');
      this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
    }
  }

  private tryOutputDevicePlayback(filePath: string, clipId: string, outputDeviceId: string, isSystemAudio: boolean = false): void {
    console.log('Trying output device playback method...');
    console.log('Output device ID:', outputDeviceId);
    
    try {
      let audioProcess: any;
      
      if (outputDeviceId.startsWith('pulse-')) {
        // PulseAudio output device
        const deviceId = outputDeviceId.replace('pulse-', '');
        console.log('Using PulseAudio output device ID:', deviceId);
        
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
                  console.log('Output device PulseAudio playback failed, falling back to default...');
                  this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
                } else {
                  console.log('Output device PulseAudio playback finished for clip:', clipId, 'isSystemAudio:', isSystemAudio);
                  this.stopPlayback();
                }
              });
              
              // Handle output device PulseAudio process errors
              if (audioProcess && audioProcess.on) {
                audioProcess.on('error', (error: Error) => {
                  console.error('Output device PulseAudio process error:', error);
                  this.handlePlaybackError(error, clipId, 'output-pulseaudio');
                });
              }
              break;
            }
          }
          
          if (!audioProcess) {
            console.log('Device not found, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
            return;
          }
        } catch (error) {
          console.log('Could not get device name, falling back to default...');
          this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
          return;
        }
      } else if (outputDeviceId.startsWith('alsa-')) {
        // ALSA output device
        const cardId = outputDeviceId.replace('alsa-', '');
        audioProcess = exec(`aplay -D hw:${cardId},0 "${filePath}"`, (error: Error, stdout: string, stderr: string) => {
          if (error) {
            console.log('Output device ALSA playback failed, falling back to default...');
            this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
          } else {
            console.log('Output device ALSA playback finished for clip:', clipId, 'isSystemAudio:', isSystemAudio);
            this.stopPlayback();
          }
        });
        
        // Handle output device ALSA process errors
        if (audioProcess && audioProcess.on) {
          audioProcess.on('error', (error: Error) => {
            console.error('Output device ALSA process error:', error);
            this.handlePlaybackError(error, clipId, 'output-alsa');
          });
        }
      } else {
        // Unknown output device type, fall back to default
        console.log('Unknown output device type, falling back to default...');
        this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
        return;
      }

      // Update current playback reference
      if (audioProcess) {
        this.currentPlayback = { audioProcess, method: 'output-device' };
        
            // REMOVED: Timeout system - let audio finish naturally
      }
    } catch (error) {
      console.log('Output device playback failed, falling back to default...');
      this.tryPlaybackMethods(filePath, clipId, isSystemAudio);
    }
  }

  private stopPlayback(): void {
    console.log('Stopping playback, current state:', this.playbackState);
    
    // Stop current playback if active
    if (this.currentPlayback) {
      try {
        // Progress interval cleanup removed - no more artificial progress systems
        
        // Legacy completion timeout cleanup removed - no more artificial timeouts
        
        if (this.currentPlayback.audioProcess) {
          // Kill the audio process if it's still running
          if (this.currentPlayback.audioProcess.kill) {
            console.log(`Killing ${this.currentPlayback.method} audio process`);
            this.currentPlayback.audioProcess.kill();
          }
          
          // For exec processes, also try to kill any child processes
          if (this.currentPlayback.audioProcess.pid) {
            try {
              const { execSync } = require('child_process');
              execSync(`pkill -P ${this.currentPlayback.audioProcess.pid}`, { stdio: 'pipe' });
            } catch (error) {
              // Ignore errors when killing child processes
            }
          }
        }
      } catch (error) {
        console.error('Error stopping playback:', error);
      }
      this.currentPlayback = null;
    }

    // Reset playback state
    this.playbackState = {
      isPlaying: false,
      currentClipId: undefined,
      progress: 0,
      startTime: 0
    };

    console.log('Playback stopped, new state:', this.playbackState);

    // Notify renderer of playback state change
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
      enableAutoStart: false,
      enableSpeakerLoopback: false,
      enableHeadphoneLoopback: false
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
    if (this.isRecording) {
      console.log('System audio capture already in progress');
      return;
    }

    const settings = this.getSettings();
    console.log('System audio capture settings:', settings);
    
    if (!settings.enableSystemAudioCapture) {
      console.log('System audio capture is disabled');
      return;
    }

    // Check if virtual audio routing is enabled and warn about potential conflicts
    if (settings.enableVirtualAudioRouting) {
      console.log('⚠️  Virtual audio routing is enabled - this may affect system audio capture');
      console.log('Consider disabling virtual audio routing if you experience issues');
    }

    const inputDeviceId = settings.inputDeviceId;
    console.log('Input device ID:', inputDeviceId);
    
    if (!inputDeviceId || !inputDeviceId.startsWith('monitor-')) {
      console.log('No monitor device selected for system audio capture');
      return;
    }

    // Set recording state BEFORE starting the capture
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    
    // Notify renderer of recording state change IMMEDIATELY
    this.mainWindow?.webContents.send(IPC_CHANNELS.RECORDING_STATE_CHANGED, {
      isRecording: true,
      duration: 0,
      startTime: this.recordingStartTime
    });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentRecordingFile = path.join(this.clipsDirectory, `system_audio_${timestamp}.wav`);

    try {
      // Import execSync at the top
      const { execSync } = require('child_process');
      
      // Check if parecord is available
      try {
        execSync('parecord --version', { stdio: 'pipe' });
      } catch (error) {
        console.error('Parecord is not available. Please install PulseAudio utilities to use system audio capture.');
        this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_ERROR, {
          message: 'Parecord is not available',
          details: 'Please install PulseAudio utilities: sudo apt install pulseaudio-utils'
        });
        this.isRecording = false;
        // Notify renderer of recording state change on error
        this.mainWindow?.webContents.send(IPC_CHANNELS.RECORDING_STATE_CHANGED, {
          isRecording: false,
          duration: 0,
          startTime: undefined
        });
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
        // Notify renderer of recording state change on error
        this.mainWindow?.webContents.send(IPC_CHANNELS.RECORDING_STATE_CHANGED, {
          isRecording: false,
          duration: 0,
          startTime: undefined
        });
        return;
      }

      console.log('Using monitor source:', monitorSourceName);
      
      // Use parecord (PulseAudio native tool) instead of FFmpeg for better reliability
      const { spawn } = require('child_process');
      const parecordArgs = [
        '--format=s16le',
        '--rate=44100',
        '--channels=1',
        '--device=' + monitorSourceName,
        this.currentRecordingFile
      ];
      
      // Note: Monitor sources can be loud by default - this is normal PulseAudio behavior
      // The volume will be the same as what you hear through your speakers
      
      console.log('Running parecord with args:', parecordArgs);
      
      const audioProcess = spawn('parecord', parecordArgs);
      
      // Set up proper process monitoring
      audioProcess.on('error', (error: Error) => {
        console.error('Parecord spawn error:', error);
        this.handleSystemAudioError(error);
      });
      
      audioProcess.on('exit', (code: number, signal: string) => {
        console.log('Parecord exited with code:', code, 'signal:', signal);
        this.handleSystemAudioExit(code, signal);
      });
      
      // Set up stderr monitoring for better debugging
      audioProcess.stderr.on('data', (data: Buffer) => {
        console.log('Parecord stderr:', data.toString());
      });
      
      // Store process with PID for proper cleanup
      this.recordingStream = {
        process: audioProcess,
        pid: audioProcess.pid,
        startTime: Date.now(),
        method: 'parecord'
      };
      
      // REMOVED: Recording timeout - let recording run until manually stopped
      // This prevents artificial cutoffs and allows full control

    } catch (error) {
      console.error('Failed to start system audio capture:', error);
      this.isRecording = false;
      
      // Notify renderer of the error
      this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_ERROR, {
        message: 'System audio capture failed',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      
      // Notify renderer of recording state change on error
      this.mainWindow?.webContents.send(IPC_CHANNELS.RECORDING_STATE_CHANGED, {
        isRecording: false,
        duration: 0,
        startTime: undefined
      });
    }
  }

  private handleSystemAudioError(error: Error): void {
    console.error('System audio capture error:', error);
    this.isRecording = false;
    
    // Notify renderer of the error
    this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_ERROR, {
      message: 'System audio capture failed',
      details: error.message || 'Parecord failed to capture audio'
    });
    
    // Notify renderer of recording state change on error
    this.mainWindow?.webContents.send(IPC_CHANNELS.RECORDING_STATE_CHANGED, {
      isRecording: false,
      duration: 0,
      startTime: undefined
    });
  }

  private handleSystemAudioExit(code: number, signal: string): void {
    console.log('System audio capture exit - code:', code, 'signal:', signal);
    
    if (code === 0) {
      // Normal exit
      console.log('Parecord system audio capture finished successfully');
      this.isRecording = false;
      
      // Notify renderer of recording state change on completion
      const duration = (Date.now() - this.recordingStartTime) / 1000;
      this.mainWindow?.webContents.send(IPC_CHANNELS.RECORDING_STATE_CHANGED, {
        isRecording: false,
        duration: Math.round(duration * 100) / 100,
        startTime: undefined
      });
    } else {
      // Abnormal exit
      console.error('Parecord system audio capture failed with code:', code, 'signal:', signal);
      this.handleSystemAudioError(new Error(`Parecord exited with code ${code} and signal ${signal}`));
    }
  }

  private stopSystemAudioCapture(): AudioClip | null {
    if (!this.isRecording) {
      console.log('System audio capture not in progress');
      return null;
    }

    console.log('Stopping system audio capture...');
    
    // Add a small buffer delay to ensure clean recording completion
    // This prevents the timing mismatch between button release and actual audio stop
    const bufferDelay = 300; // 300ms buffer for clean recording completion
    
    // Don't stop immediately - add buffer delay
    setTimeout(() => {
      this.finalizeSystemAudioCapture();
    }, bufferDelay);
    
    // Return null immediately - the actual stop happens after the buffer delay
    return null;
  }

  private finalizeSystemAudioCapture(): AudioClip | null {
    if (!this.isRecording) {
      return null; // Already stopped
    }
    
    this.isRecording = false;
    const duration = (Date.now() - this.recordingStartTime) / 1000;

    if (this.recordingStream) {
      const { process, pid, method } = this.recordingStream;
      
      // Kill the main process
      if (process && !process.killed) {
        console.log(`Killing ${method || 'audio'} process...`);
        process.kill('SIGTERM');
        
        // Force kill after 1 second if still running (parecord is more responsive)
        setTimeout(() => {
          if (!process.killed) {
            console.log(`Force killing ${method || 'audio'} process...`);
            process.kill('SIGKILL');
          }
        }, 1000);
      }
      
      // Kill any child processes by PID
      if (pid) {
        try {
          const { execSync } = require('child_process');
          console.log('Killing child processes for PID:', pid);
          execSync(`pkill -P ${pid}`, { stdio: 'pipe' });
          execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
        } catch (error) {
          // Ignore errors when killing processes
          console.log('Error killing child processes:', error);
        }
      }
      
      this.recordingStream = null;
    }

    // Clear timeout (legacy cleanup)
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
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
        console.log('System audio clip saved:', clip.name);
      } else {
        console.error('System audio recording file not found:', this.currentRecordingFile);
      }
    }, 100);

    // Notify renderer of recording state change IMMEDIATELY
    this.mainWindow?.webContents.send(IPC_CHANNELS.RECORDING_STATE_CHANGED, {
      isRecording: false,
      duration: Math.round(duration * 100) / 100,
      startTime: undefined
    });

    console.log('System audio capture stopped successfully');
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

  // Add cleanup method for app shutdown
  public cleanup(): void {
    console.log('Cleaning up SoundboardApp...');
    
    // Stop any active recording
    if (this.isRecording) {
      console.log('Stopping active recording...');
      if (this.recordingStream && this.recordingStream.process) {
        // This is a system audio capture
        this.stopSystemAudioCapture();
      } else {
        // This is a regular microphone recording
        this.stopRecording();
      }
    }
    
    // Stop any active playback
    if (this.playbackState.isPlaying) {
      console.log('Stopping active playback...');
      this.stopPlayback();
    }
    
    // Clear any recording timeout (legacy cleanup)
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }
    
    // Clean up virtual audio devices
    this.cleanupVirtualAudioDevices();
    
    // Unregister all hotkeys
    this.hotkeyMap.clear();
    
    console.log('Cleanup completed');
  }

  // Add method to handle playback errors more gracefully
  private handlePlaybackError(error: Error, clipId: string, method: string): void {
    console.error(`Playback error for clip ${clipId} using ${method}:`, error);
    
    // Stop playback on error
    this.stopPlayback();
    
    // Notify renderer of the error
    this.mainWindow?.webContents.send(IPC_CHANNELS.PLAYBACK_ERROR, {
      message: `Audio playback failed using ${method}`,
      details: error.message || 'Unknown playback error occurred'
    });
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
