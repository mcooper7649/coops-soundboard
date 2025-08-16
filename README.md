# SoundBoard 🎵

A professional desktop soundboard application built with Electron, React, and TypeScript. Record, manage, and play audio clips with global hotkey support and a beautiful, modern interface.

## ✨ Features

- **🎤 Press-to-Record**: Hold down the record button to capture audio, release to save
- **🎵 Instant Playback**: Click any clip to play it immediately
- **⌨️ Global Hotkeys**: Assign keyboard shortcuts to clips that work even when the app is minimized
- **🎨 Beautiful UI**: Modern, responsive design with light/dark theme support
- **📱 Cross-Platform**: Works on Windows, macOS, and Linux
- **🎧 Audio Device Selection**: Choose your preferred output device (perfect for Discord integration)
- **💾 Automatic Organization**: Clips are automatically saved and organized
- **🔄 Real-time Updates**: Live recording status and playback indicators

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** 8.0.0 or higher
- **Git** (for cloning the repository)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/SoundBoard.git
   cd SoundBoard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```

That's it! The app will build and launch automatically. 🎉

## 🛠️ Development

### Available Scripts

- `npm start` - Build and run the application
- `npm run dev` - Start in development mode with hot reload
- `npm run build` - Build the application for production
- `npm run pack` - Package the application for distribution
- `npm run dist` - Create distributable packages

### Development Mode

For development with hot reload:

```bash
npm run dev
```

This will:
- Watch for file changes in both main and renderer processes
- Automatically rebuild and reload the application
- Open DevTools for debugging

### Project Structure

```
SoundBoard/
├── src/
│   ├── main/           # Electron main process
│   │   ├── main.ts     # Main application logic
│   │   └── preload.ts  # Preload script for IPC
│   ├── renderer/       # React renderer process
│   │   ├── components/ # React components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── index.tsx   # Main React entry point
│   │   └── index.css   # Global styles with Tailwind
│   └── shared/         # Shared types and interfaces
│       └── types.ts    # TypeScript type definitions
├── dist/               # Build output
├── webpack.config.js   # Webpack configuration
├── tailwind.config.js  # TailwindCSS configuration
└── package.json        # Dependencies and scripts
```

## 🎯 Usage

### Recording Audio Clips

1. **Start Recording**: Click and hold the red record button
2. **Speak into your microphone**: The button will pulse while recording
3. **Stop Recording**: Release the button to save the clip
4. **Automatic Naming**: Clips are named automatically (Clip_01, Clip_02, etc.)

### Playing Clips

- **Click to Play**: Simply click any clip card to play it
- **Visual Feedback**: Playing clips show a blue glow and "Now Playing" indicator
- **Duration Display**: Each clip shows its length and creation date

### Managing Clips

- **Rename**: Click the edit icon on any clip to rename it
- **Delete**: Click the trash icon to remove a clip (with confirmation)
- **Hotkeys**: Right-click clips to assign global keyboard shortcuts

### Global Hotkeys

1. **Enable Hotkeys**: Go to Settings → Hotkeys and enable global hotkeys
2. **Assign Shortcuts**: Right-click any clip and select "Assign Hotkey"
3. **Press Combination**: Press your desired key combination (e.g., Ctrl+F1)
4. **Global Access**: The hotkey will work even when the app is minimized

### Settings

Access settings via the gear icon in the top-right corner:

- **General**: Theme selection, volume control, clips directory
- **Audio**: Output device selection, recording quality
- **Hotkeys**: Global hotkey configuration and instructions

## 🎧 Audio Setup

### For Discord Integration

To use SoundBoard with Discord or other applications:

1. **Install Virtual Audio Device**:
   - **Windows**: Install VB-Cable Virtual Audio Device
   - **macOS**: Install BlackHole
   - **Linux**: Use PulseAudio loopback or similar

2. **Configure Output**:
   - Go to Settings → Audio
   - Select your virtual audio device as the output
   - Set Discord's input to the same virtual device

3. **Enjoy**: Your clips will now play through Discord!

### Supported Audio Formats

- **Input**: Microphone (any standard audio input)
- **Output**: WAV format (44.1kHz, 16-bit, mono)
- **Quality**: Configurable sample rates and bit depths

## 🎨 Customization

### Themes

- **Light Theme**: Clean, bright interface
- **Dark Theme**: Easy on the eyes for low-light environments
- **System Theme**: Automatically follows your OS theme preference

### Styling

The app uses TailwindCSS for styling. Customize colors, animations, and layout by editing:
- `tailwind.config.js` - Theme configuration
- `src/renderer/index.css` - Custom component styles

### Keyboard Shortcuts

Default keyboard shortcuts:
- `Ctrl+Shift+R` - Start/stop recording
- `Space` - Play selected clip
- `Delete` - Delete selected clip
- `F2` - Rename selected clip

## 🚀 Building for Distribution

### Create Installers

```bash
npm run dist
```

This creates platform-specific installers:
- **Windows**: NSIS installer (.exe)
- **macOS**: DMG file
- **Linux**: AppImage file

### Build Configuration

Edit `package.json` to customize the build:
- App ID and name
- Icons and metadata
- Target platforms
- Installer options

## 🐛 Troubleshooting

### Common Issues

**Recording not working**:
- Check microphone permissions
- Ensure microphone is not muted
- Verify audio input device selection

**Hotkeys not working**:
- Enable global hotkeys in settings
- Check for conflicts with other applications
- Ensure the app has necessary permissions

**Audio playback issues**:
- Verify output device selection
- Check system volume
- Ensure audio files are not corrupted

**Build errors**:
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Update Node.js to latest LTS version
- Check for platform-specific dependencies

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm start
```

### Logs

Application logs are stored in:
- **Windows**: `%APPDATA%/SoundBoard/logs/`
- **macOS**: `~/Library/Logs/SoundBoard/`
- **Linux**: `~/.config/SoundBoard/logs/`

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Electron** - Cross-platform desktop app framework
- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **TailwindCSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **Lucide React** - Beautiful icons

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/SoundBoard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/SoundBoard/discussions)
- **Wiki**: [Project Wiki](https://github.com/yourusername/SoundBoard/wiki)

---

**Made with ❤️ for content creators, streamers, and audio enthusiasts everywhere!**
