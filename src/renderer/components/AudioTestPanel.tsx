import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Play, Square, Volume2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAudioManager } from '../hooks/useAudioManager';

const AudioTestPanel: React.FC = () => {
  const {
    clips,
    recordingState,
    playbackState,
    startRecording,
    stopRecording,
    playClip,
    stopPlayback,
    audioDevices,
    playbackError
  } = useAudioManager();

  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<{
    recording: 'pending' | 'pass' | 'fail';
    playback: 'pending' | 'pass' | 'fail';
    devices: 'pending' | 'pass' | 'fail';
  }>({
    recording: 'pending',
    playback: 'pending',
    devices: 'pending'
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const runRecordingTest = async () => {
    addLog('Starting recording test...');
    setTestResults(prev => ({ ...prev, recording: 'pending' }));
    
    try {
      addLog('Attempting to start recording...');
      await startRecording();
      addLog('Recording started successfully');
      
      // Wait 3 seconds then stop
      setTimeout(async () => {
        try {
          addLog('Stopping recording...');
          await stopRecording();
          addLog('Recording stopped successfully');
          setTestResults(prev => ({ ...prev, recording: 'pass' }));
        } catch (error) {
          addLog(`Recording stop failed: ${error}`);
          setTestResults(prev => ({ ...prev, recording: 'fail' }));
        }
      }, 3000);
      
    } catch (error) {
      addLog(`Recording start failed: ${error}`);
      setTestResults(prev => ({ ...prev, recording: 'fail' }));
    }
  };

  const runPlaybackTest = async () => {
    if (clips.length === 0) {
      addLog('No clips available for playback test');
      setTestResults(prev => ({ ...prev, playback: 'fail' }));
      return;
    }

    addLog('Starting playback test...');
    setTestResults(prev => ({ ...prev, playback: 'pending' }));
    
    try {
      const testClip = clips[0];
      addLog(`Testing playback with clip: ${testClip.name}`);
      await playClip(testClip.id);
      addLog('Playback started successfully');
      
      // Wait for playback to finish or timeout
      const timeout = setTimeout(() => {
        addLog('Playback test timed out');
        setTestResults(prev => ({ ...prev, playback: 'fail' }));
      }, (testClip.duration + 2) * 1000);
      
      // Listen for playback state changes
      const checkPlayback = () => {
        if (!playbackState.isPlaying) {
          clearTimeout(timeout);
          addLog('Playback completed successfully');
          setTestResults(prev => ({ ...prev, playback: 'pass' }));
        } else {
          setTimeout(checkPlayback, 100);
        }
      };
      
      setTimeout(checkPlayback, 100);
      
    } catch (error) {
      addLog(`Playback test failed: ${error}`);
      setTestResults(prev => ({ ...prev, playback: 'fail' }));
    }
  };

  const runDeviceTest = () => {
    addLog('Starting device test...');
    setTestResults(prev => ({ ...prev, devices: 'pending' }));
    
    if (audioDevices.length > 0) {
      addLog(`Found ${audioDevices.length} audio devices:`);
      audioDevices.forEach(device => {
        addLog(`  - ${device.name} (${device.type}) ${device.isDefault ? '[DEFAULT]' : ''}`);
      });
      setTestResults(prev => ({ ...prev, devices: 'pass' }));
    } else {
      addLog('No audio devices found');
      setTestResults(prev => ({ ...prev, devices: 'fail' }));
    }
  };

  const runAllTests = () => {
    setTestLogs([]);
    addLog('Starting comprehensive audio tests...');
    
    // Run tests in sequence
    setTimeout(() => runDeviceTest(), 500);
    setTimeout(() => runRecordingTest(), 1000);
    setTimeout(() => runPlaybackTest(), 5000);
  };

  const clearLogs = () => {
    setTestLogs([]);
  };

  const getStatusIcon = (status: 'pending' | 'pass' | 'fail') => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 bg-gray-300 rounded-full animate-pulse" />;
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'fail':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Audio System Test Panel
      </h2>
      
      {/* Test Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={runAllTests}
          className="btn-primary"
        >
          Run All Tests
        </button>
        
        <button
          onClick={runDeviceTest}
          className="btn-secondary"
        >
          Test Devices
        </button>
        
        <button
          onClick={runRecordingTest}
          className="btn-secondary"
        >
          Test Recording
        </button>
        
        <button
          onClick={runPlaybackTest}
          className="btn-secondary"
        >
          Test Playback
        </button>
        
        <button
          onClick={clearLogs}
          className="btn-secondary"
        >
          Clear Logs
        </button>
      </div>

      {/* Test Status */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          {getStatusIcon(testResults.devices)}
          <span className="text-sm font-medium">Device Detection</span>
        </div>
        
        <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          {getStatusIcon(testResults.recording)}
          <span className="text-sm font-medium">Recording</span>
        </div>
        
        <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          {getStatusIcon(testResults.playback)}
          <span className="text-sm font-medium">Playback</span>
        </div>
      </div>

      {/* Current Status */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Current Status
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Recording:</span>
            <span className={`ml-2 ${recordingState.isRecording ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
              {recordingState.isRecording ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Playback:</span>
            <span className={`ml-2 ${playbackState.isPlaying ? 'text-blue-500' : 'text-gray-700 dark:text-gray-300'}`}>
              {playbackState.isPlaying ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Clips:</span>
            <span className="ml-2 text-gray-700 dark:text-gray-300">
              {clips.length}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Devices:</span>
            <span className="ml-2 text-gray-700 dark:text-gray-300">
              {audioDevices.length}
            </span>
          </div>
        </div>
      </div>

      {/* Playback Errors */}
      {playbackError && (
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2 text-red-700 dark:text-red-400">
            Playback Error
          </h3>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700 dark:text-red-400">
                {playbackError}
              </span>
            </div>
            <p className="text-xs text-red-600 dark:text-red-500 mt-2">
              This often happens when Discord or other apps have exclusive audio control. 
              Try closing Discord or changing your audio settings.
            </p>
          </div>
        </div>
      )}

      {/* Test Logs */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Test Logs
        </h3>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 h-48 overflow-y-auto">
          {testLogs.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No test logs yet. Run a test to see results.
            </p>
          ) : (
            <div className="space-y-1">
              {testLogs.map((log, index) => (
                <div key={index} className="text-xs font-mono text-gray-700 dark:text-gray-300">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AudioTestPanel;
