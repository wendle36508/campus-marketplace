// Basic keyword auto-flagging for prohibited items. A match does NOT block
// posting: the listing is hidden from the feed and sent to the admin queue,
// so a false positive ("wine glasses") only costs a quick admin approval.
const RULES = [
  {
    category: 'Weapons',
    terms: [
      'gun', 'guns', 'firearm', 'firearms', 'pistol', 'handgun', 'rifle', 'shotgun',
      'ammo', 'ammunition', 'glock', 'ar-15', 'ar15', 'taser', 'stun gun',
      'brass knuckles', 'switchblade', 'butterfly knife', 'machete', 'crossbow',
    ],
  },
  {
    category: 'Alcohol',
    terms: [
      'alcohol', 'beer', 'beers', 'vodka', 'whiskey', 'whisky', 'tequila', 'rum',
      'wine', 'liquor', 'booze', 'keg', 'hard seltzer', 'white claw', 'champagne', 'gin',
    ],
  },
  {
    category: 'Drugs',
    terms: [
      'weed', 'marijuana', 'cannabis', 'thc', 'edibles', 'vape', 'vapes', 'juul',
      'nicotine', 'cbd', 'adderall', 'xanax', 'oxy', 'oxycodone', 'percocet', 'cocaine',
      'molly', 'mdma', 'lsd', 'acid tabs', 'shrooms', 'ketamine', 'pills', 'dab pen',
    ],
  },
  {
    category: 'Fake IDs or stolen goods',
    terms: ['fake id', 'fake ids', 'counterfeit', 'stolen', 'replica id'],
  },
];

// Phrases that contain a flagged word but are fine.
const ALLOW_PHRASES = ['wine glass', 'wine glasses', 'wine rack', 'shot glass', 'shot glasses', 'glue gun', 'hot glue gun', 'nerf gun', 'water gun', 'heat gun', 'massage gun', 'staple gun'];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function checkText(...parts) {
  let text = parts.filter(Boolean).join(' ').toLowerCase();
  for (const phrase of ALLOW_PHRASES) text = text.split(phrase).join(' ');

  const reasons = [];
  const matched = [];
  for (const rule of RULES) {
    for (const term of rule.terms) {
      const re = new RegExp(`(^|[^a-z0-9])${escape(term)}([^a-z0-9]|$)`, 'i');
      if (re.test(text)) {
        if (!reasons.includes(rule.category)) reasons.push(rule.category);
        matched.push(term);
      }
    }
  }
  return { flagged: reasons.length > 0, reasons, matched };
}

// Detects phone numbers / emails in chat so we can nudge people to keep it in-app.
function containsContactInfo(text) {
  const phone = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
  const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  return phone.test(text) || email.test(text);
}

module.exports = { checkText, containsContactInfo };
