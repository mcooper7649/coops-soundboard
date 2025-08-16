#!/bin/bash

# SoundBoard Virtual Audio Startup Script
# Run this every time you start the SoundBoard app for a clean virtual audio setup

echo "🎵 Starting SoundBoard Virtual Audio Setup..."

# Always clean up any existing virtual devices first
echo "🧹 Cleaning up any existing virtual devices..."
pactl list short modules | grep -E "(soundboard|discord|virtual)" | awk '{print $1}' | xargs -r pactl unload-module 2>/dev/null || true

# Wait a moment for cleanup to complete
sleep 1

# Create fresh virtual audio setup
echo "🔌 Creating fresh virtual audio devices..."
pactl load-module module-null-sink sink_name=soundboard-output sink_properties=device.description="SoundBoard-Output"

echo "🔄 Setting up audio routing to speakers..."
pactl load-module module-loopback source=soundboard-output.monitor sink=@DEFAULT_SINK@

echo "🎤 Creating virtual microphone for Discord..."
pactl load-module module-null-sink sink_name=virtual-mic-sink sink_properties=device.description="SoundBoard-Virtual-Microphone-Sink"

echo "🔄 Setting up audio routing to virtual microphone..."
pactl load-module module-loopback source=soundboard-output.monitor sink=virtual-mic-sink

echo "🎤 Creating virtual microphone input source..."
pactl load-module module-remap-source source_name=virtual-microphone-input source_properties=device.description="SoundBoard-Virtual-Microphone" master=virtual-mic-sink.monitor

echo ""
echo "✅ Virtual audio setup complete!"
echo ""
echo "📋 Discord Setup:"
echo "1. In Discord, go to User Settings → Voice & Video"
echo "2. Set 'Input Device' to 'SoundBoard-Virtual-Microphone'"
echo "3. Set 'Output Device' to your preferred speakers/headphones"
echo ""
echo "🎵 SoundBoard Setup:"
echo "1. In SoundBoard settings, enable 'Virtual Audio Routing'"
echo "2. Select 'soundboard-output' as your virtual audio device"
echo ""
echo "🔍 Available devices:"
echo "   - Output: 'soundboard-output' (for SoundBoard)"
echo "   - Input: 'SoundBoard-Virtual-Microphone' (for Discord)"
echo ""
echo "💡 Pro tip: Run this script every time you start SoundBoard for a clean setup!"
