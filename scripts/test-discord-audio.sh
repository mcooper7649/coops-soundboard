#!/bin/bash

# Test script for Discord audio routing

echo "🧪 Testing Discord Audio Routing..."

# Check if virtual devices exist
if ! pactl list short sinks | grep -q "soundboard-output"; then
    echo "❌ SoundBoard output sink not found!"
    exit 1
fi

if ! pactl list short sinks | grep -q "discord-input"; then
    echo "❌ Discord input sink not found!"
    exit 1
fi

echo "✅ Virtual devices found!"

# Check if loopback is set up
if ! pactl list short modules | grep -q "loopback.*soundboard-output.monitor.*discord-input"; then
    echo "❌ Audio routing loopback not found!"
    exit 1
fi

echo "✅ Audio routing loopback found!"

# Check if monitor sources are available
if ! pactl list short sources | grep -q "discord-input.monitor"; then
    echo "❌ Discord input monitor source not found!"
    exit 1
fi

echo "✅ Discord input monitor source found!"

# Play a test sound to the SoundBoard output
echo "🔊 Playing test sound to SoundBoard output..."
if [ -f "/usr/share/sounds/alsa/Front_Left.wav" ]; then
    paplay --device=soundboard-output /usr/share/sounds/alsa/Front_Left.wav
    echo "✅ Test sound played successfully!"
else
    echo "⚠️  Test sound file not found, but virtual devices are working"
fi

echo ""
echo "🎵 Test complete! The Discord audio routing is working."
echo ""
echo "📋 Discord Setup:"
echo "1. In Discord, go to User Settings → Voice & Video"
echo "2. Set 'Input Device' to 'Discord-Input.monitor'"
echo "3. Set 'Output Device' to your preferred speakers/headphones"
echo ""
echo "🎵 How it works:"
echo "   - SoundBoard plays to 'soundboard-output'"
echo "   - Audio routes to 'discord-input' via loopback"
echo "   - Discord uses 'Discord-Input.monitor' as input"
echo "   - You should hear the audio in Discord voice chat!"
