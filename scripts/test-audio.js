#!/usr/bin/env node

/**
 * Audio System Test Script
 * This script tests the audio recording and playback functionality
 * Run with: node scripts/test-audio.js
 */

const fs = require('fs');
const path = require('path');
const mic = require('mic');
const wav = require('wav');
const Speaker = require('speaker');

console.log('🎵 SoundBoard Audio System Test');
console.log('================================\n');

// Test configuration
const TEST_DURATION = 3000; // 3 seconds
const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BIT_DEPTH = 16;

// Test results
const testResults = {
  recording: false,
  playback: false,
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

// Test 3: Audio Playback
const testPlayback = () => {
  return new Promise((resolve) => {
    log('Testing audio playback...');
    
    const testFile = path.join(process.cwd(), 'test-audio', 'test-recording.wav');
    
    if (!fs.existsSync(testFile)) {
      testResults.errors.push('No test recording file found for playback test');
      log('No test recording file found for playback test', 'error');
      resolve();
      return;
    }
    
    try {
      const fileStream = fs.createReadStream(testFile);
      const wavReader = new wav.Reader();
      
      const speaker = new Speaker({
        channels: CHANNELS,
        bitDepth: BIT_DEPTH,
        sampleRate: SAMPLE_RATE
      });
      
      wavReader.on('format', (format) => {
        log(`Audio format detected: ${JSON.stringify(format)}`, 'success');
        
        wavReader.pipe(speaker);
        
        speaker.on('close', () => {
          testResults.playback = true;
          log('Playback test passed', 'success');
          resolve();
        });
        
        speaker.on('error', (error) => {
          testResults.errors.push(`Playback error: ${error.message}`);
          log(`Playback error: ${error.message}`, 'error');
          resolve();
        });
      });
      
      wavReader.on('error', (error) => {
        testResults.errors.push(`WAV reader error: ${error.message}`);
        log(`WAV reader error: ${error.message}`, 'error');
        resolve();
      });
      
      fileStream.pipe(wavReader);
      
      // Timeout for playback test
      setTimeout(() => {
        log('Playback test timed out', 'error');
        resolve();
      }, 10000);
      
    } catch (error) {
      testResults.errors.push(`Playback setup error: ${error.message}`);
      log(`Playback setup error: ${error.message}`, 'error');
      resolve();
    }
  });
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
  log('Starting audio system tests...\n');
  
  // Run tests sequentially
  testFileSystem();
  await testRecording();
  await testPlayback();
  
  // Wait a bit for all tests to complete
  setTimeout(() => {
    console.log('\n📊 Test Results');
    console.log('================');
    console.log(`File System: ${testResults.fileSystem ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Recording: ${testResults.recording ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Playback: ${testResults.playback ? '✅ PASS' : '❌ FAIL'}`);
    
    if (testResults.errors.length > 0) {
      console.log('\n❌ Errors:');
      testResults.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    const allPassed = testResults.fileSystem && testResults.recording && testResults.playback;
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
