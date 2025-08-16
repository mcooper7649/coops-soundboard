#!/bin/bash

# SoundBoard Virtual Audio Setup Script - FIXED VERSION
# This script creates a proper virtual audio setup for Discord integration

echo "🎵 Setting up SoundBoard Virtual Audio Devices (Fixed Version)..."

# Check if PipeWire or PulseAudio is running
if pgrep -x "pipewire" > /dev/null; then
    echo "🔧 Detected PipeWire (with PulseAudio compatibility)"
    AUDIO_SYSTEM="pipewire"
elif pgrep -x "pulseaudio" > /dev/null; then
    echo "🔧 Detected PulseAudio"
    AUDIO_SYSTEM="pulseaudio"
else
    echo "❌ No audio system detected. Please start PipeWire or PulseAudio first."
    exit 1
fi

# Remove any existing SoundBoard virtual devices
echo "🧹 Cleaning up existing virtual devices..."
pactl list short modules | grep -E "(soundboard|discord)" | awk '{print $1}' | xargs -r pactl unload-module 2>/dev/null || true

# Create a null sink for SoundBoard output
echo "🔌 Creating SoundBoard output sink..."
pactl load-module module-null-sink sink_name=soundboard-output sink_properties=device.description="SoundBoard-Output"

# Create a loopback to route audio from SoundBoard output to your speakers (so you can hear it)
echo "🔄 Setting up audio routing to speakers..."
pactl load-module module-loopback source=soundboard-output.monitor sink=@DEFAULT_SINK@

# Create a virtual sink that Discord can use as input
echo "🎤 Creating virtual sink for Discord input..."
pactl load-module module-null-sink sink_name=discord-input sink_properties=device.description="Discord-Input"

# Create a loopback to route audio from SoundBoard output to the Discord input sink
echo "🔄 Setting up audio routing to Discord..."
pactl load-module module-loopback source=soundboard-output.monitor sink=discord-input

echo ""
echo "✅ Virtual audio setup complete!"
echo ""
echo "📋 Setup Instructions:"
echo "1. In Discord, go to User Settings → Voice & Video"
echo "2. Set 'Input Device' to 'Discord-Input.monitor'"
echo "3. Set 'Output Device' to your preferred speakers/headphones"
echo "4. In SoundBoard settings, enable 'Virtual Audio Routing'"
echo "5. Select 'soundboard-output' as your virtual audio device"
echo ""
echo "🎵 How it works:"
echo "   - SoundBoard plays to 'soundboard-output'"
echo "   - Audio routes to your speakers (so you can hear it)"
echo "   - Audio also routes to 'discord-input'"
echo "   - Discord uses 'Discord-Input.monitor' as input"
echo ""
echo "To remove virtual devices later, run:"
echo "pactl list short modules | grep -E '(soundboard|discord)' | awk '{print \$1}' | xargs -r pactl unload-module"
