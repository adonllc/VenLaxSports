import { useState, useEffect } from 'react';
import axios from 'axios';
import { Copy, Share2, DollarSign, TrendingUp, Gift } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001';

export default function RewardsCredits() {
  const [credits, setCredits] = useState(null);
  const [referralCode, setReferralCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    try {
      const creditsRes = await axios.get(`${BACKEND_URL}/api/referrals/me/credits`, {
        withCredentials: true,
      });
      setCredits(creditsRes.data);

      const codeRes = await axios.get(`${BACKEND_URL}/api/referrals/me/referral-code`, {
        withCredentials: true,
      });
      setReferralCode(codeRes.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching credits/referral code:', err);
      setError(err.response?.data?.detail || 'Failed to load referral code. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (referralCode && navigator.share) {
      try {
        await navigator.share({
          title: 'Join VenLax Sports',
          text: `Play tennis, pickleball & cricket with my referral code ${referralCode.referral_code}`,
          url: referralCode.referral_link,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin">⌛</div>
          <p>Loading rewards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Your Rewards & Credits
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Earn credits, refer friends, get rewarded
          </p>
        </div>

        {/* Credit Balance Card */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Credits Balance */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border-l-4 border-emerald-500">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Available Credits
              </h2>
            </div>

            <div className="space-y-4">
              <div className="text-5xl font-bold text-emerald-600 dark:text-emerald-400">
                ${credits?.credits_balance?.toFixed(2) || '0.00'}
              </div>

              {credits?.credits_expiry && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Expires: {new Date(credits.credits_expiry).toLocaleDateString()}
                </p>
              )}

              <p className="text-sm text-gray-600 dark:text-gray-400">
                Use credits to reduce league entry fees. Apply at checkout.
              </p>
            </div>
          </div>

          {/* Referral Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border-l-4 border-orange-500">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Referral Stats
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Friends Referred</p>
                <p className="text-4xl font-bold text-gray-900 dark:text-white">
                  {credits?.total_referrals || 0}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Earned from Referrals</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  ${credits?.earned_referrals?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral Code Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Gift className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Share Your Referral Code
            </h2>
          </div>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Share your code with friends. They get $5 off their first league, you get $5 credit.
          </p>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={fetchCredits}
                className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {referralCode && (
            <div className="space-y-6">
              {/* Code Display */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Your Referral Code</p>
                <div className="flex items-center justify-between gap-4">
                  <code className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                    {referralCode.referral_code}
                  </code>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Referral Link */}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Share This Link</p>
                <div className="flex items-center justify-between gap-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <input
                    type="text"
                    readOnly
                    value={referralCode.referral_link}
                    className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-200"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Share Button */}
              {navigator.share && (
                <button
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                >
                  <Share2 className="w-5 h-5" />
                  Share Now
                </button>
              )}
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-8 border border-blue-200 dark:border-blue-800">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">How It Works</h3>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">1</div>
              <p className="font-semibold text-gray-900 dark:text-white mb-2">Share Your Code</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Send your referral code to friends via text, email, or social media
              </p>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">2</div>
              <p className="font-semibold text-gray-900 dark:text-white mb-2">They Sign Up</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                They register using your code and get $5 off their first league
              </p>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">3</div>
              <p className="font-semibold text-gray-900 dark:text-white mb-2">You Earn $5</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Get $5 credit instantly when they sign up
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
