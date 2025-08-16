#!/usr/bin/env node

/**
 * Simple Audio System Test Script
 * This script tests the audio recording functionality without requiring speaker
 * Run with: node scripts/test-audio-simple.js
 */

const fs = require('fs');
const path = require('path');
const mic = require('mic');
const wav = require('wav');

console.log('🎵 SoundBoard Simple Audio Test');
console.log('================================\n');

// Test configuration
const TEST_DURATION = 3000; // 3 seconds
const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BIT_DEPTH = 16;

// Test results
const testResults = {
  recording: false,
  fileSystem: false,
  errors: []
};

// Helper function to log with timestamp
const log = (message, type = 'info') => {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
};

// Test 1: File System Access
const testFileSystem = () => {
  log('Testing file system access...');
  
  try {
    const testDir = path.join(process.cwd(), 'test-audio');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
      log('Created test directory', 'success');
    }
    
    const testFile = path.join(testDir, 'test.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    testResults.fileSystem = true;
    log('File system test passed', 'success');
  } catch (error) {
    testResults.errors.push(`File system error: ${error.message}`);
    log(`File system test failed: ${error.message}`, 'error');
  }
};

// Test 2: Audio Recording
const testRecording = () => {
  return new Promise((resolve) => {
    log('Testing audio recording...');
    
    try {
      const micInstance = mic({
        rate: SAMPLE_RATE.toString(),
        channels: CHANNELS.toString(),
        debug: false,
        exitOnSilence: 6
      });

      const micInputStream = micInstance.getAudioStream();
      const testFile = path.join(process.cwd(), 'test-audio', 'test-recording.wav');
      
      const outputFileStream = new wav.FileWriter(testFile, {
        channels: CHANNELS,
        sampleRate: SAMPLE_RATE,
        bitDepth: BIT_DEPTH
      });

      micInputStream.pipe(outputFileStream);
      
      let dataReceived = false;
      micInputStream.on('data', () => {
        dataReceived = true;
      });

      micInputStream.on('error', (err) => {
        testResults.errors.push(`Recording error: ${err.message}`);
        log(`Recording error: ${err.message}`, 'error');
        resolve();
      });

      micInstance.start();
      
      // Record for TEST_DURATION milliseconds
      setTimeout(() => {
        try {
          micInstance.stop();
          
          // Wait a bit for file to be written
          setTimeout(() => {
            if (fs.existsSync(testFile) && fs.statSync(testFile).size > 0) {
              testResults.recording = true;
              log('Recording test passed', 'success');
              log(`Recorded file: ${testFile} (${fs.statSync(testFile).size} bytes)`);
              
              // Test WAV file format
              try {
                const wavReader = new wav.Reader();
                const fileStream = fs.createReadStream(testFile);
                
                wavReader.on('format', (format) => {
                  log(`WAV format detected: ${JSON.stringify(format)}`, 'success');
                });
                
                wavReader.on('error', (error) => {
                  log(`WAV read error: ${error.message}`, 'error');
                });
                
                fileStream.pipe(wavReader);
                
              } catch (error) {
                log(`WAV format test error: ${error.message}`, 'error');
              }
              
            } else {
              testResults.errors.push('Recording file not created or empty');
              log('Recording test failed: file not created or empty', 'error');
            }
            resolve();
          }, 500);
          
        } catch (error) {
          testResults.errors.push(`Recording stop error: ${error.message}`);
          log(`Recording stop error: ${error.message}`, 'error');
          resolve();
        }
      }, TEST_DURATION);
      
    } catch (error) {
      testResults.errors.push(`Recording setup error: ${error.message}`);
      log(`Recording setup error: ${error.message}`, 'error');
      resolve();
    }
  });
};

// Test 3: Check available audio devices
const testAudioDevices = () => {
  log('Checking available audio devices...');
  
  try {
    // Try to get system audio devices using a different approach
    const { execSync } = require('child_process');
    
    try {
      // Check if pulseaudio is running
      const pulseStatus = execSync('pulseaudio --check', { stdio: 'pipe' });
      log('PulseAudio is running', 'success');
    } catch (error) {
      log('PulseAudio is not running', 'info');
    }
    
    try {
      // Check ALSA devices
      const alsaDevices = execSync('aplay -l', { stdio: 'pipe' }).toString();
      log('ALSA devices found:', 'success');
      console.log(alsaDevices);
    } catch (error) {
      log('Could not list ALSA devices', 'error');
    }
    
    try {
      // Check PulseAudio devices
      const pulseDevices = execSync('pactl list short sinks', { stdio: 'pipe' }).toString();
      log('PulseAudio sinks found:', 'success');
      console.log(pulseDevices);
    } catch (error) {
      log('Could not list PulseAudio sinks', 'error');
    }
    
  } catch (error) {
    log(`Audio device check error: ${error.message}`, 'error');
  }
};

// Cleanup function
const cleanup = () => {
  log('Cleaning up test files...');
  
  try {
    const testDir = path.join(process.cwd(), 'test-audio');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
      log('Test directory removed', 'success');
    }
  } catch (error) {
    log(`Cleanup error: ${error.message}`, 'error');
  }
};

// Main test runner
const runTests = async () => {
  log('Starting simple audio system tests...\n');
  
  // Run tests sequentially
  testFileSystem();
  testAudioDevices();
  await testRecording();
  
  // Wait a bit for all tests to complete
  setTimeout(() => {
    console.log('\n📊 Test Results');
    console.log('================');
    console.log(`File System: ${testResults.fileSystem ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Recording: ${testResults.recording ? '✅ PASS' : '❌ FAIL'}`);
    
    if (testResults.errors.length > 0) {
      console.log('\n❌ Errors:');
      testResults.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    const allPassed = testResults.fileSystem && testResults.recording;
    console.log(`\n${allPassed ? '🎉 All tests passed!' : '💥 Some tests failed!'}`);
    
    // Cleanup
    cleanup();
    
    process.exit(allPassed ? 0 : 1);
  }, 2000);
};

// Handle process termination
process.on('SIGINT', () => {
  log('Tests interrupted by user');
  cleanup();
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('Tests terminated');
  cleanup();
  process.exit(1);
});

// Run the tests
runTests();
