import { useState } from 'react';
import { motion } from 'framer-motion';

const SPORT_COLORS = {
  tennis: '#10B981',      // emerald
  pickleball: '#F97316',  // orange
  cricket: '#2563EB',     // blue
};

export default function MatchCard({ match, sport, onShare }) {
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `I won against ${match.opponent_name}!`,
          text: `Check out my match on VENLAX Sports: ${match.score}`,
          url: match.shareableUrl,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(match.shareableUrl);
        alert('Link copied to clipboard!');
      }
      onShare?.();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    } finally {
      setSharing(false);
    }
  };

  const sportColor = SPORT_COLORS[sport] || '#10B981';

  return (
    <motion.div
      className="max-w-sm mx-auto rounded-2xl overflow-hidden shadow-lg bg-white"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      data-testid="match-card"
    >
      {/* Sport header bar */}
      <div
        className="h-20 flex items-center justify-center text-white font-bold text-xl"
        style={{ backgroundColor: sportColor }}
      >
        {sport.charAt(0).toUpperCase() + sport.slice(1)}
      </div>

      {/* Card content */}
      <div className="p-8 text-center space-y-6">
        {/* Winner name */}
        <motion.h2
          className="text-4xl font-black"
          style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {match.winnerName}
        </motion.h2>

        {/* vs opponent */}
        <motion.p
          className="text-lg font-medium text-gray-600"
          style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          vs {match.opponentName}
        </motion.p>

        {/* Score */}
        <motion.p
          className="text-5xl font-bold"
          style={{ color: sportColor, fontFamily: "'Sora', system-ui, sans-serif" }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          {match.score}
        </motion.p>

        {/* Rating delta */}
        <motion.p
          className="text-3xl font-bold"
          style={{ color: sportColor, fontFamily: "'Sora', system-ui, sans-serif" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          +{Math.round(match.ratingDelta)}
        </motion.p>

        {/* Timestamp */}
        <motion.p
          className="text-xs text-gray-500"
          style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {new Date(match.timestamp).toLocaleDateString()} {new Date(match.timestamp).toLocaleTimeString()}
        </motion.p>
      </div>

      {/* Share button */}
      <div className="px-8 pb-8">
        <motion.button
          onClick={handleShare}
          disabled={sharing}
          className="w-full py-3 rounded-lg font-semibold text-white transition-all"
          style={{ backgroundColor: sportColor }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          data-testid="match-card-share"
        >
          {sharing ? 'Sharing...' : '▶ Share Victory'}
        </motion.button>
      </div>

      {/* Watermark */}
      <div className="px-8 pb-4 text-center text-xs text-gray-400">
        VENLAX Sports
      </div>
    </motion.div>
  );
}
