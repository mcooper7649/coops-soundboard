#!/bin/bash

# SoundBoard Virtual Audio Cleanup Script
# This script removes all SoundBoard virtual audio devices

echo "🧹 Cleaning up SoundBoard Virtual Audio Devices..."

# Check if virtual devices exist
if ! pactl list short modules | grep -q "soundboard"; then
    echo "✅ No SoundBoard virtual devices found to clean up."
    exit 0
fi

# Remove SoundBoard virtual devices
echo "🔌 Removing SoundBoard virtual devices..."
pactl list short modules | grep -E "(soundboard|discord)" | awk '{print $1}' | xargs -r pactl unload-module

echo "✅ Virtual audio devices removed successfully!"
echo ""
echo "🎵 Your audio system is now back to normal."
echo "To recreate the virtual devices later, run: ./scripts/setup-virtual-audio.sh"
