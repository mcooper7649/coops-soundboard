# SoundBoard Virtual Audio Setup

This guide explains how to set up virtual audio routing for Discord integration in SoundBoard.

## What is Virtual Audio Routing?

Virtual audio routing allows SoundBoard to play audio clips through a virtual microphone that Discord can use as an input device. This means:

- Audio clips play through Discord instead of your speakers
- Other people in voice chat can hear your soundboard clips
- You can still hear game audio and other sounds through your normal speakers

## Quick Setup

### 1. Run the Setup Script

```bash
./scripts/setup-virtual-audio.sh
```

This script will:
- Create a virtual audio sink called `soundboard-output`
- Create a virtual microphone called `SoundBoard-Virtual-Microphone`
- Set up audio routing between them

### 2. Configure Discord

1. Open Discord
2. Go to User Settings → Voice & Video
3. Set **Input Device** to `SoundBoard-Virtual-Microphone`
4. Set **Output Device** to your preferred speakers/headphones
5. Test your microphone to ensure it's working

### 3. Configure SoundBoard

1. Open SoundBoard
2. Go to Settings → Audio tab
3. Enable **Virtual Audio Routing**
4. Select `soundboard-output` as your virtual audio device
5. Save settings

## How It Works

```
SoundBoard Audio Clip → soundboard-output (virtual sink)
                                    ↓
                            soundboard-input (virtual source)
                                    ↓
                            Discord Voice Chat
```

## Testing

Run the test script to verify everything is working:

```bash
./scripts/test-virtual-audio.sh
```

You should hear a test sound, and if you're in Discord, others should hear it too.

## Troubleshooting

### No Audio in Discord
- Check that Discord input device is set to `SoundBoard-Virtual-Microphone`
- Verify virtual audio routing is enabled in SoundBoard
- Make sure `soundboard-output` is selected as the virtual device

### Audio Still Plays Through Speakers
- Check that virtual audio routing is enabled in SoundBoard settings
- Verify the correct virtual device is selected
- Restart SoundBoard after changing settings

### Virtual Devices Not Found
- Run the setup script again: `./scripts/setup-virtual-audio.sh`
- Check that PulseAudio/PipeWire is running
- Look for any error messages in the setup script

## Cleanup

To remove all virtual audio devices:

```bash
./scripts/cleanup-virtual-audio.sh
```

## Manual Setup (Advanced)

If you prefer to set up virtual audio manually:

```bash
# Create virtual sink
pactl load-module module-null-sink sink_name=soundboard-output sink_properties=device.description="SoundBoard-Output"

# Create virtual source
pactl load-module module-virtual-source source_name=soundboard-input source_properties=device.description="SoundBoard-Virtual-Microphone"

# Route audio from sink to source
pactl load-module module-loopback source=soundboard-output.monitor sink=soundboard-input
```

## System Requirements

- Linux with PulseAudio or PipeWire
- `pactl` command available
- `paplay` command available
- Discord desktop app

## Support

If you encounter issues:
1. Check the console output for error messages
2. Verify PulseAudio/PipeWire is running
3. Try running the cleanup script and setup script again
4. Check that your audio system supports virtual devices
