// ============================================================
//  TikTok Content Performance Dashboard
//  Google Apps Script -- Code.gs
//  Northwind Pulse -- Creator & Ecommerce
// ============================================================

const DATA_SHEET_ID  = '1c86yKsvHafajJSLYiHDrFQ6Evgx9rxGJTalRSEI46l0';
const CONTENT_TAB    = 'db_social_content';
const CACHE_KEY      = 'tt_content_v1';
const CACHE_META_KEY = '__tt_chunks__';
const CACHE_TTL      = 21600; // 6 hours


// ── Entry point -- returns JSON for the dashboard ─────────────────────────────
function doGet() {
  try {
    const output = ContentService
      .createTextOutput(JSON.stringify(getTikTokContentData()))
      .setMimeType(ContentService.MimeType.JSON);
    return output;
  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ── Main data function ────────────────────────────────────────────────────────
function getTikTokContentData() {
  const cache  = CacheService.getScriptCache();
  const cached = _getChunks(cache);
  if (cached) return JSON.parse(cached);

  const ss    = SpreadsheetApp.openById(DATA_SHEET_ID);
  const sheet = ss.getSheetByName(CONTENT_TAB);
  if (!sheet) throw new Error('Tab not found: ' + CONTENT_TAB);

  const vals    = sheet.getDataRange().getValues();
  const headers = vals[0].map(String);

  function col(name) { return headers.indexOf(name); }

  const iPostId    = col('post_id');
  const iPostDate  = col('post_date');
  const iPlatform  = col('platform');
  const iPostType  = col('post_type');
  const iTitle     = col('title');
  const iViews     = col('views');
  const iLikes     = col('likes');
  const iComments  = col('comments');
  const iShares    = col('shares');
  const iSaves     = col('saves');
  const iReach     = col('reach');
  const iDuration  = col('duration_sec');
  const iFollower  = col('follower_count');
  const iFollowing = col('following_count');
  const iTotalLikes= col('total_likes');
  const iVideoCount= col('video_count');

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun',
                       'Jul','Aug','Sep','Oct','Nov','Dec'];

  let profile = null;
  const rows  = [];
  const years  = new Set();
  const months = new Set();

  for (let i = 1; i < vals.length; i++) {
    const row      = vals[i];
    const platform = String(row[iPlatform] || '').trim().toLowerCase();
    if (platform !== 'tiktok') continue;

    const postId   = String(row[iPostId]   || '').trim();
    const postType = String(row[iPostType] || '').trim().toLowerCase();

    if (postId === 'PROFILE' || postType === 'profile') {
      profile = {
        display_name:   'Maple & Co.',
        handle:         '@mapleandco_',
        follower_count: Number(row[iFollower])   || 0,
        following_count:Number(row[iFollowing])  || 0,
        total_likes:    Number(row[iTotalLikes])  || 0,
        video_count:    Number(row[iVideoCount])  || 0,
      };
      continue;
    }

    const rawDate = row[iPostDate];
    const d       = rawDate ? new Date(rawDate) : null;
    const yr      = d ? String(d.getFullYear())                    : '';
    const mo      = d ? String(d.getMonth() + 1).padStart(2, '0') : '';
    const mKey    = yr && mo ? yr + '-' + mo                      : '';
    const mLabel  = d ? MONTH_NAMES[d.getMonth()] + ' ' + yr      : '';
    const dateStr = d ? d.toISOString().slice(0, 10)               : '';

    const views    = Number(row[iViews])    || 0;
    const likes    = Number(row[iLikes])    || 0;
    const comments = Number(row[iComments]) || 0;
    const shares   = Number(row[iShares])   || 0;
    const saves    = Number(row[iSaves])    || 0;
    const reach    = Number(row[iReach])    || 0;
    const duration = Number(row[iDuration]) || 0;

    const engRate = views > 0
      ? Math.round(((likes + comments + shares) / views) * 10000) / 100
      : 0;

    rows.push({
      post_id:  postId,
      date:     dateStr,
      yr, mo, mKey, mLabel,
      title:    String(row[iTitle] || '').trim(),
      views, likes, comments, shares, saves, reach, duration,
      engRate,
    });

    if (yr)  years.add(yr);
    if (mo) months.add(mo);
  }

  const MONTH_ORDER = ['01','02','03','04','05','06','07','08','09','10','11','12'];

  const result = {
    profile: profile || {},
    rows,
    fo: {
      years:  [...years].sort().reverse(),
      months: MONTH_ORDER
        .filter(m => months.has(m))
        .map(m => ({ value: m, label: MONTH_NAMES[parseInt(m, 10) - 1] })),
    },
  };

  _putChunks(cache, JSON.stringify(result));
  return result;
}


// ── Chunked cache helpers ─────────────────────────────────────────────────────
function _putChunks(cache, json) {
  try {
    const CHUNK = 90000;
    const total = Math.ceil(json.length / CHUNK);
    const pairs = {};
    pairs[CACHE_META_KEY] = String(total);
    for (let i = 0; i < total; i++) {
      pairs[CACHE_KEY + '_' + i] = json.slice(i * CHUNK, (i + 1) * CHUNK);
    }
    cache.putAll(pairs, CACHE_TTL);
  } catch (e) { console.log('Cache write failed:', e); }
}

function _getChunks(cache) {
  try {
    const meta = cache.get(CACHE_META_KEY);
    if (!meta) return null;
    const total  = parseInt(meta, 10);
    const keys   = Array.from({ length: total }, (_, i) => CACHE_KEY + '_' + i);
    const stored = cache.getAll(keys);
    if (Object.keys(stored).length !== total) return null;
    return keys.map(k => stored[k]).join('');
  } catch (e) { return null; }
}


// ── Sheet setup -- creates/refreshes db_social_content with demo data ─────────
function setupSheet() {
  const ss    = SpreadsheetApp.openById(DATA_SHEET_ID);
  let sheet   = ss.getSheetByName(CONTENT_TAB);
  if (sheet) {
    sheet.clearContents();
  } else {
    sheet = ss.insertSheet(CONTENT_TAB);
  }

  const headers = [
    'post_id','post_date','platform','post_type','title',
    'views','likes','comments','shares','saves','reach',
    'duration_sec','follower_count','following_count','total_likes','video_count'
  ];

  const titles = [
    'GRWM: Boutique owner morning routine \u2728',
    'New arrivals try-on haul \u2014 Maple & Co. \uD83C\uDF3F',
    'Styling the Linen Wrap Dress 3 ways',
    'POV: You finally found your new favorite set',
    'Summer outfit ideas from my boutique',
    'Wide leg trouser try-on + styling tips',
    'Honest review: our best selling dress',
    'Pack an order with me \uD83D\uDCE6 behind the scenes',
    'How I style the Ribbed Tank Set for every occasion',
    'This cardigan sold out in 2 hours - it is back!!',
    'Outfit inspo: holiday party looks from Maple & Co.',
    'Small business Saturday haul + try on',
    'The viral belt bag - worth it?',
    'New year, new arrivals \uD83C\uDF38',
    'Spring collection first look - Maple & Co. 2026',
    'Behind the scenes: packaging 200 holiday orders',
    'How I built my online boutique from scratch',
    'Tote bag styling 5 ways \uD83C\uDF3F',
    'These platform sandals are everything',
    'Try on with me: the new Cropped Blazer drop'
  ];

  // Video data: [post_date, views, likes, comments, shares, duration_sec]
  // Video #4 (index 3) is the viral one ~Oct 15 2025 ~200k views
  const videoData = [
    ['2025-10-01',  8200,  610,  42,  88, 34],
    ['2025-10-06', 14300, 1020,  76, 155, 41],
    ['2025-10-11', 22500, 1680, 118, 228, 38],
    ['2025-10-15',198400,14200, 832,2610, 52], // viral
    ['2025-10-20', 11800,  890,  64, 120, 29],
    ['2025-10-25',  9400,  700,  51,  97, 45],
    ['2025-10-30', 17200, 1310,  88, 181, 33],
    ['2025-11-04',  6800,  520,  38,  72, 27],
    ['2025-11-09', 12600,  940,  67, 132, 48],
    ['2025-11-14',  8900,  670,  49,  92, 36],
    ['2025-11-19', 31400, 2280, 162, 390, 44],
    ['2025-11-24', 19800, 1490, 104, 248, 31],
    ['2025-11-29',  7100,  540,  40,  78, 22],
    ['2026-01-03', 24600, 1820, 128, 312, 55],
    ['2026-01-08', 11200,  840,  60, 114, 39],
    ['2026-01-13', 34800, 2560, 185, 445, 58],
    ['2026-01-18', 15600, 1160,  82, 196, 42],
    ['2026-02-02', 18300, 1370,  96, 228, 37],
    ['2026-02-07',  9600,  720,  52,  98, 25],
    ['2026-03-01', 27400, 2040, 144, 358, 46],
  ];

  const rows = [headers];

  // PROFILE row
  rows.push([
    'PROFILE', '', 'tiktok', 'profile', 'Maple & Co.',
    0, 0, 0, 0, 0, 0, 0,
    12048, 284, 184820, 142
  ]);

  // Video rows
  videoData.forEach(function(v, idx) {
    const postDate   = v[0];
    const views      = v[1];
    const likes      = v[2];
    const comments   = v[3];
    const shares     = v[4];
    const duration   = v[5];
    const reach      = Math.round(views * 0.88);
    const postId     = 'TT_' + String(idx + 1).padStart(3, '0');
    const title      = titles[idx] || 'TikTok Video ' + (idx + 1);

    rows.push([
      postId, postDate, 'tiktok', 'video', title,
      views, likes, comments, shares, 0, reach,
      duration, 0, 0, 0, 0
    ]);
  });

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);

  // Format date column
  const dateRange = sheet.getRange(3, 2, videoData.length, 1);
  dateRange.setNumberFormat('yyyy-mm-dd');

  Logger.log('setupSheet() complete. ' + (rows.length - 1) + ' data rows written (including PROFILE).');
}


// ── Utilities ─────────────────────────────────────────────────────────────────
function clearCache() {
  CacheService.getScriptCache().remove(CACHE_META_KEY);
  Logger.log('Cache cleared.');
}

function warmCache() {
  clearCache();
  getTikTokContentData();
  Logger.log('Cache warmed at ' + new Date().toLocaleString());
}

function createWarmCacheTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'warmCache'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('warmCache').timeBased().everyHours(4).create();
  Logger.log('Warm-cache trigger created (every 4 hours).');
}

function testDataAccess() {
  clearCache();
  const data = getTikTokContentData();
  Logger.log('Profile: ' + JSON.stringify(data.profile));
  Logger.log('Post rows: ' + data.rows.length);
  Logger.log('Filter options: ' + JSON.stringify(data.fo));
  if (data.rows.length > 0) {
    Logger.log('Sample row: ' + JSON.stringify(data.rows[0]));
  }
}
