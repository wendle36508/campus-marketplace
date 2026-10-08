// AI price suggestions from a photo.
// With ANTHROPIC_API_KEY set, the photo is sent to Claude (vision) which returns
// structured JSON. Without a key, a keyword-based mock keeps the demo working.
const config = require('../config');
const { CATEGORIES, CONDITIONS } = require('../constants');

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'item_name', 'title', 'category', 'condition', 'description',
    'price_low', 'price_high', 'price_recommended', 'reason', 'confidence',
  ],
  properties: {
    item_name: { type: 'string', description: 'What the item is, e.g. "Mini fridge"' },
    title: { type: 'string', description: 'Listing title, under 60 characters, with brand/size if visible' },
    category: { type: 'string', enum: CATEGORIES },
    condition: { type: 'string', enum: CONDITIONS },
    description: { type: 'string', description: '1-2 short sentences a student seller would write' },
    price_low: { type: 'integer', description: 'Low end of fair used price in whole USD' },
    price_high: { type: 'integer', description: 'High end of fair used price in whole USD' },
    price_recommended: { type: 'integer', description: 'Single recommended price in whole USD' },
    reason: { type: 'string', description: 'One line explaining the price, e.g. "Similar used mini fridges sell for $40-60; this one looks lightly used"' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
};

function systemPrompt(schoolName) {
  return `You help ${schoolName} students price items they are selling to other students on a campus marketplace.

Look at the photo and identify the item. Then suggest a fair price for the student-to-student used market, which is cheaper than retail and cheaper than eBay: buyers are students on a budget, pickup is on campus, and sellers (especially at end-of-semester move-out) usually want a quick sale.

Rough guide: used items in good condition typically go for 25-50% of retail; like-new items up to about 60%; worn or bulky furniture that is hard to move often goes lower. Textbooks depend heavily on edition. If the item is nearly worthless, a price of 0 with category "Free Stuff" is fine.

Estimate condition only from what is visible. Keep the reason to one plain sentence that mentions the typical price range for similar used items. Keep the title short and specific (include brand or size if you can read it). Prices are whole US dollars and price_low <= price_recommended <= price_high.`;
}

let client;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: config.ai.apiKey });
  }
  return client;
}

async function callClaude({ imageBase64, mediaType, schoolName }) {
  const request = {
    model: config.ai.model,
    max_tokens: 4000,
    system: systemPrompt(schoolName),
    output_config: {
      effort: 'low', // fast: the goal is photo-to-posted in under 60 seconds
      format: { type: 'json_schema', schema: SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: 'Suggest listing details and a fair student-market price for this item.' },
        ],
      },
    ],
  };

  let response;
  try {
    // Server-side fallback: if the primary model declines, the API retries on
    // a fallback model within the same call.
    response = await getClient().beta.messages.create({
      ...request,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch (err) {
    if (err && err.status === 400) {
      response = await getClient().messages.create(request); // retry without the beta
    } else {
      throw err;
    }
  }

  if (response.stop_reason === 'refusal') throw new Error('The AI declined to price this photo');
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text in AI response');
  return JSON.parse(textBlock.text);
}

// ---- Mock (no API key) ------------------------------------------------------
const MOCK_ITEMS = [
  { k: ['fridge', 'refrigerator'], item: 'Mini fridge', cat: 'Dorm Essentials', lo: 40, hi: 60, retail: 150 },
  { k: ['chair'], item: 'Desk chair', cat: 'Furniture', lo: 25, hi: 45, retail: 120 },
  { k: ['rug', 'carpet'], item: 'Area rug', cat: 'Dorm Essentials', lo: 20, hi: 35, retail: 80 },
  { k: ['tv', 'television', 'monitor'], item: 'TV', cat: 'Electronics', lo: 70, hi: 110, retail: 250 },
  { k: ['lamp', 'light'], item: 'Desk lamp', cat: 'Dorm Essentials', lo: 8, hi: 15, retail: 30 },
  { k: ['book', 'textbook'], item: 'Textbook', cat: 'Textbooks', lo: 20, hi: 45, retail: 180 },
  { k: ['desk', 'table'], item: 'Desk', cat: 'Furniture', lo: 30, hi: 60, retail: 150 },
  { k: ['couch', 'sofa', 'futon'], item: 'Futon', cat: 'Furniture', lo: 60, hi: 100, retail: 300 },
  { k: ['microwave'], item: 'Microwave', cat: 'Dorm Essentials', lo: 20, hi: 35, retail: 80 },
  { k: ['jacket', 'coat', 'hoodie', 'shirt', 'shoes'], item: 'Clothing item', cat: 'Clothing', lo: 15, hi: 35, retail: 90 },
  { k: ['mirror'], item: 'Mirror', cat: 'Dorm Essentials', lo: 8, hi: 15, retail: 30 },
  { k: ['bike', 'bicycle'], item: 'Bike', cat: 'Other', lo: 60, hi: 120, retail: 350 },
];

function mockSuggest(hint = '') {
  const h = hint.toLowerCase();
  const m = MOCK_ITEMS.find((x) => x.k.some((k) => h.includes(k)));
  if (m) {
    const rec = Math.round((m.lo + m.hi) / 2 / 5) * 5;
    return {
      item_name: m.item,
      title: m.item,
      category: m.cat,
      condition: 'Good',
      description: `${m.item} in good working condition. Pickup on campus.`,
      price_low: m.lo,
      price_high: m.hi,
      price_recommended: rec,
      reason: `Similar used ${m.item.toLowerCase()}s sell for $${m.lo}–${m.hi} between students (about $${m.retail} new); this one looks lightly used.`,
      confidence: 'medium',
    };
  }
  return {
    item_name: 'Item',
    title: '',
    category: 'Other',
    condition: 'Good',
    description: '',
    price_low: 10,
    price_high: 25,
    price_recommended: 15,
    reason: 'Sample suggestion: most small used dorm items sell for $10–25 between students.',
    confidence: 'low',
  };
}

function clean(s) {
  const out = { ...s };
  if (!CATEGORIES.includes(out.category)) out.category = 'Other';
  if (!CONDITIONS.includes(out.condition)) out.condition = 'Good';
  for (const k of ['price_low', 'price_high', 'price_recommended']) out[k] = Math.max(0, Math.round(Number(out[k]) || 0));
  if (out.price_low > out.price_high) [out.price_low, out.price_high] = [out.price_high, out.price_low];
  out.price_recommended = Math.min(Math.max(out.price_recommended, out.price_low), out.price_high);
  out.title = String(out.title || '').slice(0, 80);
  return out;
}

async function suggestFromPhoto({ data, mediaType, hint, schoolName }) {
  if (!config.ai.apiKey) {
    return { ...clean(mockSuggest(hint)), source: 'demo' };
  }
  try {
    const buf = data;
    if (buf.length > 4.5 * 1024 * 1024) throw new Error('Photo too large for AI analysis');
    const result = await callClaude({ imageBase64: buf.toString('base64'), mediaType, schoolName });
    return { ...clean(result), source: 'ai' };
  } catch (err) {
    console.error('[ai] price suggestion failed, using fallback:', err.message);
    return { ...clean(mockSuggest(hint)), source: 'fallback', error: 'AI pricing is unavailable right now, so this is a rough estimate.' };
  }
}

module.exports = { suggestFromPhoto };
