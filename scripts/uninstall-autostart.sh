#!/bin/bash

# SoundBoard Auto-Start Service Uninstaller
# This script removes the systemd service that automatically restores virtual audio on boot

echo "🗑️  Uninstalling SoundBoard Virtual Audio Auto-Start Service..."

SERVICE_NAME="soundboard-audio.service"

# Stop the service if it's running
echo "🛑 Stopping service..."
systemctl --user stop "$SERVICE_NAME" 2>/dev/null || true

# Disable the service
echo "❌ Disabling service..."
systemctl --user disable "$SERVICE_NAME" 2>/dev/null || true

# Remove the service file
echo "📁 Removing service file..."
rm -f ~/.config/systemd/user/"$SERVICE_NAME"

# Reload systemd user daemon
echo "🔄 Reloading systemd user daemon..."
systemctl --user daemon-reload

echo ""
echo "✅ SoundBoard Virtual Audio Auto-Start Service uninstalled successfully!"
echo ""
echo "📋 What this means:"
echo "   - Virtual audio devices will NOT automatically restore on boot"
echo "   - You'll need to manually run './scripts/setup-virtual-audio.sh' after each reboot"
echo "   - Or reinstall the auto-start service with './scripts/install-autostart.sh'"
echo ""
echo "🎵 To manually restore virtual audio now, run:"
echo "   ./scripts/setup-virtual-audio.sh"
