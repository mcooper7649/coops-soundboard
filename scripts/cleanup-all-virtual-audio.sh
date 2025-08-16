#!/bin/bash

# SoundBoard Complete Virtual Audio Cleanup Script
# Run this to remove ALL accumulated virtual audio devices

echo "🧹 SoundBoard Complete Virtual Audio Cleanup..."
echo "This will remove ALL virtual audio devices created by SoundBoard"
echo ""

# Confirm before proceeding
read -p "Are you sure you want to remove all virtual audio devices? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo "Starting comprehensive cleanup..."

# Stop any running SoundBoard processes
echo "🛑 Stopping any running SoundBoard processes..."
pkill -f "electron.*SoundBoard" 2>/dev/null || true
pkill -f "soundboard" 2>/dev/null || true

# Wait for processes to stop
sleep 2

# Remove all PulseAudio modules related to SoundBoard
echo "🔌 Removing PulseAudio modules..."

# Get all modules and remove SoundBoard-related ones
pactl list short modules | while read -r line; do
    if [[ $line =~ ^[0-9]+ ]]; then
        moduleId=$(echo "$line" | awk '{print $1}')
        moduleName=$(echo "$line" | awk '{print $2}')
        
        if [[ "$moduleName" =~ (soundboard|SoundBoard|virtual|null-sink|virtual-source|loopback) ]]; then
            echo "Removing module $moduleId ($moduleName)..."
            pactl unload-module "$moduleId" 2>/dev/null || true
        fi
    fi
done

# Remove any orphaned sinks
echo "🎵 Removing orphaned audio sinks..."
pactl list short sinks | while read -r line; do
    if [[ $line =~ ^[0-9]+ ]]; then
        sinkId=$(echo "$line" | awk '{print $1}')
        sinkName=$(echo "$line" | awk '{print $2}')
        
        if [[ "$sinkName" =~ (soundboard|virtual|null) ]]; then
            echo "Removing sink $sinkId ($sinkName)..."
            pactl unload-module "$sinkId" 2>/dev/null || true
        fi
    fi
done

# Remove any orphaned sources
echo "🎤 Removing orphaned audio sources..."
pactl list short sources | while read -r line; do
    if [[ $line =~ ^[0-9]+ ]]; then
        sourceId=$(echo "$line" | awk '{print $1}')
        sourceName=$(echo "$line" | awk '{print $2}')
        
        if [[ "$sourceName" =~ (soundboard|virtual|null) ]]; then
            echo "Removing source $sourceId ($sourceName)..."
            pactl unload-module "$sourceId" 2>/dev/null || true
        fi
    fi
done

# Force reload PulseAudio to clean up any remaining references
echo "🔄 Reloading PulseAudio..."
pulseaudio --kill 2>/dev/null || true
sleep 1
pulseaudio --start 2>/dev/null || true

# Wait for PulseAudio to restart
sleep 3

echo ""
echo "✅ Cleanup completed!"
echo ""
echo "📋 What was cleaned up:"
echo "   - All SoundBoard virtual audio modules"
echo "   - Orphaned audio sinks and sources"
echo "   - Virtual microphone devices"
echo "   - Audio routing loopbacks"
echo ""
echo "🎵 Next steps:"
echo "1. Restart SoundBoard"
echo "2. The startup script will create fresh, clean virtual devices"
echo "3. Your audio should work normally again"
echo ""
echo "💡 Tip: Run this cleanup script whenever you notice too many audio devices"
