/**
 * PATH:
 * backend/src/modules/notifications/adapters/index.js
 *
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - Central adapter registry
 * - No delivery execution here
 *
 * DOCTRINE:
 * Channels are adapters.
 * Orchestrator coordinates.
 * Policy decides.
 */

const BaseAdapter = require('./BaseAdapter');
const InAppAdapter = require('./InAppAdapter');
const EmailAdapter = require('./EmailAdapter');
const ZaloManualAdapter = require('./ZaloManualAdapter');
const TelegramAdapter = require('./TelegramAdapter');
const WhatsAppAdapter = require('./WhatsAppAdapter');

const ADAPTER_CLASSES = {
  IN_APP: InAppAdapter,
  EMAIL: EmailAdapter,
  ZALO: ZaloManualAdapter,
  TELEGRAM: TelegramAdapter,
  WHATSAPP: WhatsAppAdapter,
};

function getAdapterClass(channel) {
  if (!channel) {
    throw new Error(
      '[AdapterRegistry.getAdapterClass]: channel is required'
    );
  }

  const AdapterClass = ADAPTER_CLASSES[channel];

  if (!AdapterClass) {
    throw new Error(
      `[AdapterRegistry.getAdapterClass]: unsupported channel ${channel}`
    );
  }

  return AdapterClass;
}

function createAdapter(channel, options = {}) {
  const AdapterClass = getAdapterClass(channel);

  return new AdapterClass(options);
}

function listSupportedChannels() {
  return Object.keys(ADAPTER_CLASSES);
}

async function healthCheckAll(optionsByChannel = {}) {
  const results = [];

  for (const channel of listSupportedChannels()) {
    const adapter =
      createAdapter(
        channel,
        optionsByChannel[channel] || {}
      );

    const health =
      await adapter.healthCheck();

    results.push(health);
  }

  return results;
}

module.exports = {
  BaseAdapter,
  InAppAdapter,
  EmailAdapter,
  ZaloManualAdapter,
  TelegramAdapter,
  WhatsAppAdapter,

  ADAPTER_CLASSES,

  getAdapterClass,
  createAdapter,
  listSupportedChannels,
  healthCheckAll,
};