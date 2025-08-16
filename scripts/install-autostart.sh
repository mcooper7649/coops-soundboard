#!/bin/bash

# SoundBoard Auto-Start Virtual Audio Setup
# This script installs a systemd service to automatically restore virtual audio on boot

echo "🔧 Installing SoundBoard Virtual Audio Auto-Start Service..."

# Get the current user's home directory
USER_HOME=$(eval echo ~$USER)
SERVICE_NAME="soundboard-audio.service"
SERVICE_PATH="$USER_HOME/.config/systemd/user/$SERVICE_NAME"
SCRIPT_PATH="$USER_HOME/Documents/Github/SoundBoard/scripts/soundboard-audio.service"

# Check if we're in the right directory
if [ ! -f "scripts/setup-virtual-audio.sh" ]; then
    echo "❌ Error: Please run this script from the SoundBoard project root directory"
    exit 1
fi

# Create the systemd user directory if it doesn't exist
mkdir -p "$USER_HOME/.config/systemd/user"

# Copy the service file to the user's systemd directory
echo "📁 Installing service file..."
cp "$SCRIPT_PATH" "$SERVICE_PATH"

# Update the ExecStart path in the service file to use the absolute path
sed -i "s|%h|$USER_HOME|g" "$SERVICE_PATH"

# Reload systemd user daemon
echo "🔄 Reloading systemd user daemon..."
systemctl --user daemon-reload

# Enable the service to start on boot
echo "✅ Enabling service to start on boot..."
systemctl --user enable "$SERVICE_NAME"

# Start the service now (optional)
echo "🚀 Starting service now..."
systemctl --user start "$SERVICE_NAME"

echo ""
echo "✅ SoundBoard Virtual Audio Auto-Start Service installed successfully!"
echo ""
echo "📋 Service Details:"
echo "   Service Name: $SERVICE_NAME"
echo "   Status: $(systemctl --user is-active $SERVICE_NAME)"
echo "   Enabled: $(systemctl --user is-enabled $SERVICE_NAME)"
echo ""
echo "🔧 Management Commands:"
echo "   Check status: systemctl --user status $SERVICE_NAME"
echo "   Start service: systemctl --user start $SERVICE_NAME"
echo "   Stop service: systemctl --user stop $SERVICE_NAME"
echo "   Disable auto-start: systemctl --user disable $SERVICE_NAME"
echo ""
echo "🎵 Your virtual audio devices will now automatically restore on every boot!"
