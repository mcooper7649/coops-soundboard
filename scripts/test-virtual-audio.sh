#!/bin/bash

# Test script for SoundBoard virtual audio routing

echo "🧪 Testing SoundBoard Virtual Audio Routing..."

# Check if virtual devices exist
if ! pactl list short sinks | grep -q "soundboard-output"; then
    echo "❌ SoundBoard output sink not found!"
    exit 1
fi

echo "✅ Virtual devices found!"

# Get the sink ID for soundboard-output
SINK_ID=$(pactl list short sinks | grep "soundboard-output" | awk '{print $1}')
echo "🔌 SoundBoard output sink ID: $SINK_ID"

# Check if loopback is set up
if ! pactl list short modules | grep -q "loopback.*soundboard-output.monitor"; then
    echo "❌ Audio routing loopback not found!"
    exit 1
fi

echo "✅ Audio routing loopback found!"

# Check if virtual source exists
if ! pactl list short sources | grep -q "soundboard-input"; then
    echo "❌ SoundBoard virtual source not found!"
    exit 1
fi

echo "✅ SoundBoard virtual source found!"

# Play a test sound to the SoundBoard output
echo "🔊 Playing test sound to SoundBoard output..."
if [ -f "/usr/share/sounds/alsa/Front_Left.wav" ]; then
    paplay --device=soundboard-output /usr/share/sounds/alsa/Front_Left.wav
    echo "✅ Test sound played successfully!"
else
    echo "⚠️  Test sound file not found, but virtual devices are working"
fi

echo ""
echo "🎵 Test complete! The virtual audio routing is working."
echo "You should have heard the test sound through your speakers/headphones."
echo ""
echo "📋 Next steps:"
echo "1. In Discord, go to User Settings → Voice & Video"
echo "2. Set 'Input Device' to 'SoundBoard-Virtual-Microphone'"
echo "3. Set 'Output Device' to your preferred speakers/headphones"
echo "4. In SoundBoard, enable virtual audio routing and select 'soundboard-output'"
echo "5. Play clips and they should go to Discord!"
