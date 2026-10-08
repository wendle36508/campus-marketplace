// Product-wide lists. The client fetches these from /api/config so there is
// a single source of truth.
const CATEGORIES = [
  'Furniture',
  'Dorm Essentials',
  'Electronics',
  'Textbooks',
  'Clothing',
  'Tickets',
  'Free Stuff',
  'Other',
];

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

const REPORT_REASONS = [
  { id: 'scam', label: 'Scam or suspicious' },
  { id: 'inappropriate', label: 'Inappropriate' },
  { id: 'prohibited', label: 'Prohibited item' },
  { id: 'no_show', label: 'No-show at meetup' },
  { id: 'other', label: 'Something else' },
];

const SAFETY_TIPS = [
  'Meet in a public, well-lit spot on campus. Use one of the suggested safe meetup spots.',
  'Keep the conversation in the app. No need to share your phone number.',
  'Inspect the item before you pay. Use cash or a payment app only once you have it.',
  'Never pay in advance or send a deposit to someone you have not met.',
  'If something feels off, walk away and report it. We review every report.',
];

module.exports = { CATEGORIES, CONDITIONS, REPORT_REASONS, SAFETY_TIPS };
