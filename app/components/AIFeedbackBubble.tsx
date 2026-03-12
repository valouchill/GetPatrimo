'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface AIFeedbackBubbleProps {
  message: string;
  type?: 'success' | 'warning' | 'info' | 'error';
  scoreIncrease?: number;
  visible: boolean;
}

/**
 * Composant AIFeedbackBubble - Bulle de conseil IA en temps réel
 * Affiche les retours de l'IA avec animations élégantes
 */
export default function AIFeedbackBubble({
  message,
  type = 'info',
  scoreIncrease,
  visible,
}: AIFeedbackBubbleProps) {
  if (!visible || !message) return null;

  const typeStyles = {
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      icon: 'text-emerald-600',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-900',
      icon: 'text-amber-600',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-900',
      icon: 'text-blue-600',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-900',
      icon: 'text-red-600',
    },
  };

  const styles = typeStyles[type];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.9 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`fixed top-36 right-8 z-[60] max-w-sm ${styles.bg} ${styles.border} border rounded-2xl shadow-xl p-4 backdrop-blur-sm`}
        >
          <div className="flex items-start gap-3">
            {/* Icône */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className={`flex-shrink-0 ${styles.icon}`}
            >
              {type === 'success' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {type === 'warning' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {type === 'error' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {type === 'info' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </motion.div>

            {/* Message */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${styles.text} leading-relaxed`}>
                {message}
              </p>
              {scoreIncrease !== undefined && scoreIncrease > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-2 flex items-center gap-2"
                >
                  <span className={`text-xs font-bold ${styles.icon}`}>
                    +{scoreIncrease} points
                  </span>
                  <div className="h-1 flex-1 bg-emerald-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Effet shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_3s_infinite] pointer-events-none" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
