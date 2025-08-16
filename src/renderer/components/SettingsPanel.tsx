import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, Folder, Keyboard, Palette } from 'lucide-react';
import { AppSettings, AudioDevice } from '../../shared/types';

interface SettingsPanelProps {
  settings: AppSettings;
  audioDevices: AudioDevice[];
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  audioDevices,
  onUpdateSettings,
  onClose
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<'general' | 'audio' | 'hotkeys'>('general');

  const handleSettingChange = async (key: keyof AppSettings, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    
    // Handle loopback settings immediately
    if (key === 'enableSpeakerLoopback') {
      try {
        if (value) {
          await (window as any).electronAPI.enableSpeakerLoopback();
        } else {
          await (window as any).electronAPI.disableSpeakerLoopback();
        }
      } catch (error) {
        console.error('Failed to toggle speaker loopback:', error);
        // Revert the setting if it failed
        setLocalSettings(prev => ({ ...prev, [key]: !value }));
        return;
      }
    }
    
    if (key === 'enableHeadphoneLoopback') {
      try {
        if (value) {
          await (window as any).electronAPI.enableHeadphoneLoopback();
        } else {
          await (window as any).electronAPI.disableHeadphoneLoopback();
        }
      } catch (error) {
        console.error('Failed to toggle headphone loopback:', error);
        // Revert the setting if it failed
        setLocalSettings(prev => ({ ...prev, [key]: !value }));
        return;
      }
    }
    
    onUpdateSettings(newSettings);
  };

  const handleSave = () => {
    onUpdateSettings(localSettings);
    onClose();
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    onClose();
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Palette },
    { id: 'audio', label: 'Audio', icon: Volume2 },
    { id: 'hotkeys', label: 'Hotkeys', icon: Keyboard }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center space-x-2 px-6 py-3 text-sm font-medium transition-colors
                  ${isActive
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Theme Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Theme
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'light', label: 'Light', icon: '☀️' },
                      { value: 'dark', label: 'Dark', icon: '🌙' },
                      { value: 'system', label: 'System', icon: '🖥️' }
                    ].map((theme) => (
                      <button
                        key={theme.value}
                        onClick={() => handleSettingChange('theme', theme.value)}
                        className={`
                          p-3 rounded-lg border-2 transition-all duration-200 text-center
                          ${localSettings.theme === theme.value
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                          }
                        `}
                      >
                        <div className="text-2xl mb-1">{theme.icon}</div>
                        <div className="text-sm font-medium">{theme.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume Control */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Master Volume: {Math.round(localSettings.volume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={localSettings.volume}
                    onChange={(e) => handleSettingChange('volume', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                {/* Clips Directory */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Clips Directory
                  </label>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Folder className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {localSettings.clipsDirectory}
                      </span>
                    </div>
                    <button className="btn-secondary text-sm">
                      Change
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'audio' && (
              <motion.div
                key="audio"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Virtual Audio Routing Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Virtual Audio Routing
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Route audio to virtual devices for Discord integration instead of speakers
                    </p>
                  </div>
                  <button
                    onClick={() => handleSettingChange('enableVirtualAudioRouting', !localSettings.enableVirtualAudioRouting)}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${localSettings.enableVirtualAudioRouting
                        ? 'bg-primary-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                      }
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${localSettings.enableVirtualAudioRouting ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>

                {/* Virtual Audio Device Selection */}
                {localSettings.enableVirtualAudioRouting && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Virtual Audio Device
                    </label>
                    <select
                      value={localSettings.virtualAudioDeviceId}
                      onChange={(e) => handleSettingChange('virtualAudioDeviceId', e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select virtual audio device</option>
                      {audioDevices
                        .filter(device => device.type === 'virtual' || device.isVirtual)
                        .map(device => (
                          <option key={device.id} value={device.id}>
                            {device.name} {device.isDefault ? '(Default)' : ''}
                          </option>
                        ))
                      }
                    </select>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Choose a virtual audio device that Discord can use as a microphone input. 
                      You may need to install VB-Cable or similar software.
                    </p>
                    
                    {/* Virtual Device Info */}
                    {localSettings.virtualAudioDeviceId && (
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                          Setup Instructions:
                        </h4>
                        <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                          <li>1. In Discord, go to User Settings → Voice & Video</li>
                          <li>2. Set "Input Device" to the selected virtual device</li>
                          <li>3. Test your microphone to ensure it's working</li>
                          <li>4. Audio clips will now play through Discord</li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}

                {/* Auto-Start Service Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Auto-Start Virtual Audio
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Automatically restore virtual audio devices on system boot
                    </p>
                  </div>
                  <button
                    onClick={() => handleSettingChange('enableAutoStart', !localSettings.enableAutoStart)}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${localSettings.enableAutoStart
                        ? 'bg-primary-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                      }
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${localSettings.enableAutoStart ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>

                {/* Auto-Start Status and Controls */}
                {localSettings.enableAutoStart && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">
                      Auto-Start Service Status:
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-800 dark:text-green-200">Service Status:</span>
                        <span className="text-sm font-medium text-green-900 dark:text-green-100">
                          {localSettings.enableAutoStart ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={async () => {
                            try {
                              const success = await (window as any).electronAPI.installAutostart();
                              if (success) {
                                // Update local state
                                setLocalSettings(prev => ({ ...prev, enableAutoStart: true }));
                              }
                            } catch (error) {
                              console.error('Failed to install auto-start:', error);
                            }
                          }}
                          className="btn-primary text-xs px-3 py-1"
                        >
                          Install Service
                        </button>
                        <button 
                          onClick={async () => {
                            try {
                              const success = await (window as any).electronAPI.uninstallAutostart();
                              if (success) {
                                // Update local state
                                setLocalSettings(prev => ({ ...prev, enableAutoStart: false }));
                              }
                            } catch (error) {
                                console.error('Failed to uninstall auto-start:', error);
                            }
                          }}
                          className="btn-secondary text-xs px-3 py-1"
                        >
                          Remove Service
                        </button>
                        <button 
                          onClick={async () => {
                            try {
                              const status = await (window as any).electronAPI.getAutostartStatus();
                              console.log('Auto-start status:', status);
                              // You could show this in a toast or update the UI
                            } catch (error) {
                              console.error('Failed to get auto-start status:', error);
                            }
                          }}
                          className="btn-secondary text-xs px-3 py-1"
                        >
                          Check Status
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* System Audio Capture Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable System Audio Capture
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Record audio from applications like Spotify, YouTube, or Discord
                    </p>
                  </div>
                  <button
                    onClick={() => handleSettingChange('enableSystemAudioCapture', !localSettings.enableSystemAudioCapture)}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${localSettings.enableSystemAudioCapture
                        ? 'bg-primary-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                      }
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${localSettings.enableSystemAudioCapture ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>

                {/* Input Device Selection for System Audio Capture */}
                {localSettings.enableSystemAudioCapture && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Input Device for System Audio Capture
                    </label>
                    <select
                      value={localSettings.inputDeviceId}
                      onChange={(e) => handleSettingChange('inputDeviceId', e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select input device</option>
                      {audioDevices
                        .filter(device => device.type === 'input' || device.type === 'monitor')
                        .map(device => (
                          <option key={device.id} value={device.id}>
                            {device.name} {device.isDefault ? '(Default)' : ''}
                          </option>
                        ))
                      }
                    </select>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Choose a monitor source to capture audio from applications. 
                      Monitor sources allow you to record what's playing through your speakers.
                    </p>
                    
                    {/* Input Device Info */}
                    {localSettings.inputDeviceId && (
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                          System Audio Capture Setup:
                        </h4>
                        <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                          <li>1. Play audio in Spotify, YouTube, Discord, etc.</li>
                          <li>2. Use the record button to capture system audio</li>
                          <li>3. The captured audio will be saved as a clip</li>
                          <li>4. You can then play it back through Discord</li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}

                {/* Audio Loopback Controls */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                    Audio Loopback Controls
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Control which devices can hear the audio from your soundboard clips
                  </p>
                  
                  {/* Speaker Loopback Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Enable Speaker Loopback
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Allow your speakers to hear soundboard clips (in addition to Discord)
                      </p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('enableSpeakerLoopback', !localSettings.enableSpeakerLoopback)}
                      className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                        ${localSettings.enableSpeakerLoopback
                          ? 'bg-primary-600'
                          : 'bg-gray-200 dark:bg-gray-700'
                        }
                      `}
                    >
                      <span
                        className={`
                          inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                          ${localSettings.enableSpeakerLoopback ? 'translate-x-6' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>

                  {/* Headphone Loopback Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Enable Headphone Loopback
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Allow your headphones to hear soundboard clips (in addition to Discord)
                      </p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('enableHeadphoneLoopback', !localSettings.enableHeadphoneLoopback)}
                      className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                        ${localSettings.enableHeadphoneLoopback
                          ? 'bg-primary-600'
                          : 'bg-gray-200 dark:bg-gray-700'
                        }
                      `}
                    >
                      <span
                        className={`
                          inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                          ${localSettings.enableHeadphoneLoopback ? 'translate-x-6' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>

                  {/* Loopback Info */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      How Loopback Works:
                    </h5>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <li>• <strong>Speaker Loopback:</strong> Routes audio from virtual output to your speakers</li>
                      <li>• <strong>Headphone Loopback:</strong> Routes audio from virtual output to your headphones</li>
                      <li>• <strong>Discord Integration:</strong> Audio always goes to Discord via virtual microphone</li>
                      <li>• <strong>Toggle Control:</strong> Enable/disable each loopback independently</li>
                    </ul>
                  </div>
                </div>

                {/* Output Device Selection (when virtual routing is disabled) */}
                {!localSettings.enableVirtualAudioRouting && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Output Device
                    </label>
                    <select
                      value={localSettings.outputDeviceId}
                      onChange={(e) => handleSettingChange('outputDeviceId', e.target.value)}
                      className="input-field"
                    >
                      <option value="">Default Output (System Default)</option>
                      {audioDevices
                        .filter(device => device.type === 'output' && !device.isVirtual)
                        .map(device => (
                          <option key={device.id} value={device.id}>
                            {device.name} {device.isDefault ? '(Default)' : ''}
                          </option>
                        ))
                      }
                    </select>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Choose where audio clips will be played. For Discord integration, enable virtual audio routing above.
                    </p>
                    
                    {/* Current Output Device Info */}
                    {localSettings.outputDeviceId && (
                      <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">
                          Selected Output Device:
                        </h4>
                        <p className="text-sm text-green-800 dark:text-green-200">
                          {audioDevices.find(d => d.id === localSettings.outputDeviceId)?.name || localSettings.outputDeviceId}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Audio Quality */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Recording Quality
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'low', label: 'Low (22kHz)', description: 'Smaller files' },
                      { value: 'medium', label: 'Medium (44kHz)', description: 'Balanced' },
                      { value: 'high', label: 'High (48kHz)', description: 'Best quality' }
                    ].map((quality) => (
                      <button
                        key={quality.value}
                        className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 text-left hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {quality.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {quality.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'hotkeys' && (
              <motion.div
                key="hotkeys"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Hotkey Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Global Hotkeys
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Allow clips to be triggered with keyboard shortcuts even when the app is in the background
                    </p>
                  </div>
                  <button
                    onClick={() => handleSettingChange('enableHotkeys', !localSettings.enableHotkeys)}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${localSettings.enableHotkeys
                        ? 'bg-primary-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                      }
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${localSettings.enableHotkeys ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>

                {/* Hotkey Instructions */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    How to assign hotkeys:
                  </h4>
                  <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>1. Right-click on any clip card</li>
                    <li>2. Select "Assign Hotkey"</li>
                    <li>3. Press your desired key combination</li>
                    <li>4. The hotkey will work globally</li>
                  </ol>
                </div>

                {/* Common Hotkeys */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Common Hotkey Combinations
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      'Ctrl + F1', 'Ctrl + F2', 'Ctrl + F3', 'Ctrl + F4',
                      'Alt + 1', 'Alt + 2', 'Alt + 3', 'Alt + 4'
                    ].map((hotkey) => (
                      <div
                        key={hotkey}
                        className="p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-center font-mono"
                      >
                        {hotkey}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleCancel} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SettingsPanel;
