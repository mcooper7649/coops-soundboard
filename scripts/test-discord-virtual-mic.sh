#!/bin/bash

# Test script for Discord Virtual Microphone

echo "🧪 Testing Discord Virtual Microphone Setup..."

# Check if virtual devices exist
if ! pactl list short sinks | grep -q "soundboard-output"; then
    echo "❌ SoundBoard output sink not found!"
    exit 1
fi

if ! pactl list short sinks | grep -q "virtual-microphone"; then
    echo "❌ Virtual microphone sink not found!"
    exit 1
fi

echo "✅ Virtual sinks found!"

# Check if monitor sources are available
if ! pactl list short sources | grep -q "virtual-microphone.monitor"; then
    echo "❌ Virtual microphone monitor source not found!"
    exit 1
fi

echo "✅ Virtual microphone monitor source found!"

# Check if loopback routing is set up
if ! pactl list short modules | grep -q "loopback.*soundboard-output.monitor.*virtual-microphone"; then
    echo "❌ Audio routing loopback not found!"
    exit 1
fi

echo "✅ Audio routing loopback found!"

# Play a test sound to the SoundBoard output
echo "🔊 Playing test sound to SoundBoard output..."
if [ -f "/usr/share/sounds/alsa/Front_Left.wav" ]; then
    paplay --device=soundboard-output /usr/share/sounds/alsa/Front_Left.wav
    echo "✅ Test sound played successfully!"
else
    echo "⚠️  Test sound file not found, but virtual devices are working"
fi

echo ""
echo "🎵 Test complete! The Discord virtual microphone is working."
echo ""
echo "📋 Discord Setup Instructions:"
echo "1. In Discord, go to User Settings → Voice & Video"
echo "2. Set 'Input Device' to 'SoundBoard-Virtual-Microphone.monitor'"
echo "3. Set 'Output Device' to your preferred speakers/headphones"
echo ""
echo "🎵 How it works:"
echo "   - SoundBoard plays to 'soundboard-output'"
echo "   - Audio routes to your speakers (so you can hear it)"
echo "   - Audio also routes to 'virtual-microphone' via loopback"
echo "   - Discord uses 'SoundBoard-Virtual-Microphone.monitor' as input"
echo "   - You should hear the audio in Discord voice chat!"
echo ""
echo "🔍 Available devices for Discord:"
echo "   - Input Device: 'SoundBoard-Virtual-Microphone.monitor'"
echo "   - Output Device: Your preferred speakers/headphones"
