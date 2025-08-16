import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Monitor, Settings, Mic, MicOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { AudioClip, AppSettings, RecordingState, PlaybackState } from '../../shared/types';
import RecorderButton from './RecorderButton';
import ClipCard from './ClipCard';
import SettingsPanel from './SettingsPanel';
import AudioTestPanel from './AudioTestPanel';
import { useTheme } from '../hooks/useTheme';
import { useAudioManager } from '../hooks/useAudioManager';

const SoundboardApp: React.FC = () => {
  const { theme, toggleTheme, systemTheme } = useTheme();
  const {
    clips,
    recordingState,
    playbackState,
    startRecording,
    stopRecording,
    playClip,
    deleteClip,
    renameClip,
    settings,
    updateSettings,
    audioDevices
  } = useAudioManager();

  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleRecordingStart = async () => {
    try {
      await startRecording();
      toast.success('Recording started');
    } catch (error) {
      toast.error('Failed to start recording');
    }
  };

  const handleRecordingStop = async () => {
    try {
      await stopRecording();
      toast.success('Recording saved');
    } catch (error) {
      toast.error('Failed to save recording');
    }
  };

  const handleClipPlay = async (clipId: string) => {
    console.log('=== CLIP BUTTON CLICKED ===');
    console.log('Clip ID:', clipId);
    console.log('Button click stack trace:', new Error().stack);
    console.log('Current time:', new Date().toISOString());
    
    try {
      await playClip(clipId);
      toast.success('Playing clip');
    } catch (error) {
      toast.error('Failed to play clip');
    }
  };

  const handleClipDelete = async (clipId: string) => {
    try {
      await deleteClip(clipId);
      toast.success('Clip deleted');
    } catch (error) {
      toast.error('Failed to delete clip');
    }
  };

  const handleClipRename = async (clipId: string, newName: string) => {
    try {
      await renameClip(clipId, newName);
      toast.success('Clip renamed');
    } catch (error) {
      toast.error('Failed to rename clip');
    }
  };

  const getThemeIcon = () => {
    if (theme === 'system') return <Monitor className="w-5 h-5" />;
    if (theme === 'dark') return <Moon className="w-5 h-5" />;
    return <Sun className="w-5 h-5" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Loading SoundBoard...
          </h2>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' || (theme === 'system' && systemTheme === 'dark')
        ? 'dark'
        : ''
    }`}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-2xl font-bold text-primary-600 dark:text-primary-400"
              >
                SoundBoard
              </motion.h1>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
                  title={`Current theme: ${theme}`}
                >
                  {getThemeIcon()}
                </button>
                
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg transition-colors duration-200 ${
                    showSettings
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Sidebar - Recorder */}
            <div className="lg:col-span-1 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card p-6"
              >
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                  Record New Clip
                </h2>
                
                <RecorderButton
                  isRecording={recordingState.isRecording}
                  duration={recordingState.duration}
                  onStart={handleRecordingStart}
                  onStop={handleRecordingStop}
                />
                
                {/* System Audio Buffer Delay Setting */}
                {settings.enableSystemAudioCapture && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      System Audio Buffer Delay: {settings.systemAudioBufferDelay}ms
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="3000"
                      step="50"
                      value={settings.systemAudioBufferDelay}
                      onChange={(e) => updateSettings({ systemAudioBufferDelay: parseInt(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>100ms</span>
                      <span>3000ms</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Adjusts how long recording continues after releasing the button
                    </p>
                  </div>
                )}
                
                {recordingState.isRecording && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 text-center"
                  >
                    <div className="flex items-center justify-center space-x-2 text-primary-600 dark:text-primary-400">
                      <Mic className="w-4 h-4 animate-pulse" />
                      <span className="text-sm font-medium">
                        Recording... {recordingState.duration.toFixed(1)}s
                      </span>
                    </div>
                  </motion.div>
                )}
              </motion.div>

              {/* Audio Test Panel */}
              <AudioTestPanel />
            </div>

            {/* Main Content - Clips Grid */}
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Audio Clips
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {clips.length} clip{clips.length !== 1 ? 's' : ''}
                </span>
              </div>

              {clips.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12"
                >
                  <MicOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No clips yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Record your first audio clip to get started
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  layout
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                >
                  <AnimatePresence>
                    {clips.map((clip) => (
                      <motion.div
                        key={clip.id}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ClipCard
                          clip={clip}
                          isPlaying={playbackState.isPlaying && playbackState.currentClipId === clip.id}
                          onPlay={handleClipPlay}
                          onDelete={handleClipDelete}
                          onRename={handleClipRename}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </div>
        </main>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <SettingsPanel
              settings={settings}
              audioDevices={audioDevices}
              onUpdateSettings={updateSettings}
              onClose={() => setShowSettings(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SoundboardApp;
