import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trash2, Edit3, Volume2, Keyboard } from 'lucide-react';
import { AudioClip } from '../../shared/types';

interface ClipCardProps {
  clip: AudioClip;
  isPlaying: boolean;
  onPlay: (clipId: string) => void;
  onDelete: (clipId: string) => void;
  onRename: (clipId: string, name: string) => void;
}

const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  isPlaying,
  onPlay,
  onDelete,
  onRename
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(clip.name);
  const [showHotkeyModal, setShowHotkeyModal] = useState(false);

  const handlePlay = () => {
    onPlay(clip.id);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${clip.name}"?`)) {
      onDelete(clip.id);
    }
  };

  const handleRename = () => {
    if (editName.trim() && editName !== clip.name) {
      onRename(clip.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditName(clip.name);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  const formatDuration = (duration: number): string => {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date): string => {
    try {
      // Ensure date is valid
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  const cardVariants = {
    idle: { scale: 1, y: 0 },
    hover: { scale: 1.02, y: -2 },
    playing: { 
      scale: [1, 1.05, 1],
      boxShadow: "0 20px 25px -5px rgba(59, 130, 246, 0.3), 0 10px 10px -5px rgba(59, 130, 246, 0.2)"
    }
  };

  return (
    <>
      <motion.div
        variants={cardVariants}
        initial="idle"
        whileHover="hover"
        animate={isPlaying ? "playing" : "idle"}
        transition={{ duration: 0.2 }}
        className="card p-4 hover:shadow-xl transition-all duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyPress}
                onBlur={handleRename}
                className="input-field text-sm font-medium h-8"
                autoFocus
              />
            ) : (
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {clip.name}
              </h3>
            )}
          </div>
          
          <div className="flex items-center space-x-1 ml-2">
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Rename clip"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            
            <button
              onClick={handleDelete}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              title="Delete clip"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Duration and Date */}
        <div className="flex items-center justify-between mb-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-1">
            <Volume2 className="w-3 h-3" />
            <span>{formatDuration(clip.duration)}</span>
          </div>
          <span>{formatDate(clip.createdAt)}</span>
        </div>

        {/* Hotkey indicator */}
        {clip.hotkey && (
          <div className="mb-3">
            <div className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              <Keyboard className="w-3 h-3" />
              <span className="font-mono">{clip.hotkey}</span>
            </div>
          </div>
        )}

        {/* Play Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handlePlay}
          disabled={isPlaying}
          className={`
            w-full py-2 px-4 rounded-lg font-medium transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-2
            ${isPlaying
              ? 'bg-primary-400 text-white cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500'
            }
          `}
        >
          <div className="flex items-center justify-center space-x-2">
            {isPlaying ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Volume2 className="w-4 h-4" />
                </motion.div>
                <span>Playing...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Play</span>
              </>
            )}
          </div>
        </motion.button>

        {/* Playing indicator */}
        <AnimatePresence>
          {isPlaying && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-2 h-2 bg-primary-500 rounded-full"
                />
                <span className="text-xs font-medium">Now Playing</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Hotkey Modal */}
      <AnimatePresence>
        {showHotkeyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowHotkeyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                Assign Hotkey
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Press a key combination to assign to "{clip.name}"
              </p>
              <div className="text-center">
                <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Keyboard className="w-5 h-5" />
                  <span className="font-mono text-lg">Press keys...</span>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowHotkeyModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ClipCard;
