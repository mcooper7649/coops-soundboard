import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square } from 'lucide-react';

interface RecorderButtonProps {
  isRecording: boolean;
  duration: number;
  onStart: () => void;
  onStop: () => void;
}

const RecorderButton: React.FC<RecorderButtonProps> = ({
  isRecording,
  duration,
  onStart,
  onStop
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 0.1);
      }, 100);
    } else {
      setRecordingDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const handleMouseDown = () => {
    if (!isRecording) {
      setIsPressed(true);
      onStart();
    }
  };

  const handleMouseUp = () => {
    if (isRecording) {
      setIsPressed(false);
      onStop();
    }
  };

  const handleMouseLeave = () => {
    if (isRecording) {
      setIsPressed(false);
      onStop();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!isRecording) {
      setIsPressed(true);
      onStart();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isRecording) {
      setIsPressed(false);
      onStop();
    }
  };

  const buttonVariants = {
    idle: {
      scale: 1,
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
    },
    pressed: {
      scale: 0.95,
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
    },
    recording: {
      scale: [1, 1.05, 1],
      boxShadow: "0 10px 15px -3px rgba(239, 68, 68, 0.3), 0 4px 6px -2px rgba(239, 68, 68, 0.2)"
    }
  };

  const iconVariants = {
    idle: { scale: 1, rotate: 0 },
    pressed: { scale: 0.9, rotate: 0 },
    recording: { 
      scale: [1, 1.1, 1],
      rotate: [0, 5, -5, 0]
    }
  };

  const pulseVariants = {
    recording: {
      scale: [1, 1.2, 1],
      opacity: [0.5, 0.8, 0.5],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut" as const
      }
    }
  };

  const getButtonState = () => {
    if (isRecording) return 'recording';
    if (isPressed) return 'pressed';
    return 'idle';
  };

  const buttonState = getButtonState();

  return (
    <div className="relative">
      {/* Recording indicator ring */}
      <AnimatePresence>
        {isRecording && (
                  <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate="recording"
          exit={{ scale: 0, opacity: 0 }}
          className="absolute inset-0 rounded-full bg-red-500/20"
          variants={pulseVariants}
        />
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        variants={buttonVariants}
        animate={buttonState}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`
          relative w-24 h-24 rounded-full flex items-center justify-center
          transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2
          ${isRecording 
            ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500 text-white' 
            : 'bg-primary-500 hover:bg-primary-600 focus:ring-primary-500 text-white'
          }
        `}
        disabled={isRecording}
      >
        {/* Icon */}
        <motion.div
          variants={iconVariants}
          animate={buttonState}
          transition={{ duration: 0.2 }}
        >
          {isRecording ? (
            <Square className="w-8 h-8" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </motion.div>

        {/* Recording duration overlay */}
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-8 left-1/2 transform -translate-x-1/2"
          >
            <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
              {recordingDuration.toFixed(1)}s
            </span>
          </motion.div>
        )}
      </motion.button>

      {/* Instructions */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isRecording 
            ? 'Release to stop recording' 
            : 'Press and hold to record'
          }
        </p>
      </div>

      {/* Recording status */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 text-center"
          >
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium">Recording</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecorderButton;
