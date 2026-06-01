import { getSheetsClient } from '@/lib/sheets';

export const CONFIG_DEFAULTS = {
  ENABLE_AI_EXPLANATIONS: true,
  ENABLE_PREMIUM_ANALYSIS: false,
  MAX_AI_PER_USER_PER_DAY: 10,
  MIN_ANSWERS_FOR_ANALYSIS: 50,
  MIN_SESSIONS_FOR_ANALYSIS: 3,
  LEADERBOARD_CACHE_TTL_SECONDS: 300,
  QUESTIONS_CACHE_TTL_SECONDS: 14400,
  DAILY_CHALLENGE_ENABLED: true,
  APP_VERSION: '1.0.0',
  MAINTENANCE_MODE: false,
};

export const PUBLIC_CONFIG_KEYS = Object.freeze(Object.keys(CONFIG_DEFAULTS));

const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;
let configCache = null;

function normalizeHeader(value) {
  return String(value || '').trim();
}

function buildHeaderIndex(headers) {
  return headers.reduce((index, header, position) => {
    const normalized = normalizeHeader(header);
    if (normalized) index[normalized] = position;
    return index;
  }, {});
}

function parseConfigValue(value, type, fallback) {
  const raw = String(value ?? '').trim();
  const normalizedType = String(type || '').trim().toLowerCase();

  if (raw === '') return fallback;

  if (normalizedType === 'boolean') {
    if (raw.toLowerCase() === 'true') return true;
    if (raw.toLowerCase() === 'false') return false;
    return fallback;
  }

  if (normalizedType === 'number') {
    const number = Number(raw);
    return Number.isFinite(number) ? number : fallback;
  }

  return raw;
}

function getCell(row, headerIndex, headerName) {
  const index = headerIndex[headerName];
  return typeof index === 'number' ? row[index] : '';
}

async function readConfigFromSheet() {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Config!A:E',
  });

  const rows = response.data.values || [];
  const [headers, ...dataRows] = rows;
  if (!headers || headers.length === 0) return {};

  const headerIndex = buildHeaderIndex(headers);
  const config = {};

  dataRows.forEach(row => {
    const key = String(getCell(row, headerIndex, 'Key') || '').trim();
    if (!key || !(key in CONFIG_DEFAULTS)) return;

    config[key] = parseConfigValue(
      getCell(row, headerIndex, 'Value'),
      getCell(row, headerIndex, 'Type'),
      CONFIG_DEFAULTS[key]
    );
  });

  return config;
}

export async function getAppConfig() {
  const now = Date.now();
  if (configCache && now - configCache.cachedAt < CONFIG_CACHE_TTL_MS) {
    return configCache.config;
  }

  try {
    const sheetConfig = await readConfigFromSheet();
    const config = { ...CONFIG_DEFAULTS, ...sheetConfig };
    configCache = { config, cachedAt: now };
    return config;
  } catch (err) {
    console.warn('[config] Falling back to defaults:', err.message);
    const config = { ...CONFIG_DEFAULTS };
    configCache = { config, cachedAt: now };
    return config;
  }
}

export function getPublicConfig(config) {
  return PUBLIC_CONFIG_KEYS.reduce((publicConfig, key) => {
    publicConfig[key] = config[key];
    return publicConfig;
  }, {});
}

export function clearAppConfigCache() {
  configCache = null;
}
