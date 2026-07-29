/**
 * @typedef {object} ApiKeyBag
 * @property {string} [openai]
 * @property {string} [anthropic]
 * @property {string} [gemini]
 * @property {string} [nvidia]
 * @property {string} [deepgram]
 */

/**
 * @typedef {object} ModelTier
 * @property {string} fast
 * @property {string} smart
 */

/**
 * @typedef {object} WindowBounds
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {object} RecentFeature
 * @property {string} mode
 * @property {string} userText
 * @property {number} at
 */

/**
 * @typedef {object} Settings
 * @property {number} schemaVersion
 * @property {number} privacyNoticeVersion
 * @property {string} provider
 * @property {boolean} smart
 * @property {string} resumeContext
 * @property {number} opacity
 * @property {boolean} compact
 * @property {boolean} onboarded
 * @property {boolean} privacyAck
 * @property {boolean} listenConsent
 * @property {WindowBounds|null} windowBounds
 * @property {{ assist: string }} shortcuts
 * @property {ApiKeyBag} apiKeys
 * @property {Record<string, ModelTier>} models
 * @property {string} [audioDeviceId]
 * @property {boolean} [openAtLogin]
 * @property {boolean} [betaUpdates]
 * @property {number} [lifetimeSpend]
 * @property {number} [sessionSpend]
 * @property {RecentFeature[]} [recentFeatures]
 * @property {string} [language]
 * @property {string} [licenseKey]
 */

/**
 * @typedef {object} TranscriptTurn
 * @property {'you'|'them'} channel
 * @property {string} text
 * @property {number} [at]
 */

/**
 * @typedef {object} Diagnostics
 * @property {string} version
 * @property {string} platform
 * @property {string} electron
 * @property {string} provider
 * @property {string|null} model
 * @property {boolean} hasKey
 * @property {boolean} capturing
 * @property {boolean} busy
 * @property {boolean} offline
 * @property {string|null} lastError
 * @property {string} dataPath
 * @property {object} media
 * @property {number} [lifetimeSpend]
 * @property {number} [sessionSpend]
 * @property {object|null} [cpu]
 */

module.exports = {};
