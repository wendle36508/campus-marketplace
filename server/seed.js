// Demo data: the Babson school row, a few students, ~15 listings, a couple of
// chats, a completed sale with a rating, and items for the admin queue.
const fs = require('fs');
const path = require('path');
const { db, newId } = require('./db');

const ago = (hours) => new Date(Date.now() - hours * 3600e3).toISOString();

function loadSchoolFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function insertSchool(def) {
  const row = {
    id: newId(),
    slug: def.slug,
    name: def.name,
    short_name: def.short_name,
    email_domains: JSON.stringify(def.email_domains.map((d) => d.toLowerCase())),
    primary_color: def.primary_color,
    primary_color_dark: def.primary_color_dark || def.primary_color,
    logo_url: def.logo_url || null,
    meetup_spots: JSON.stringify(def.meetup_spots || []),
    is_active: true,
    created_at: new Date().toISOString(),
  };
  await db('schools').insert(row);
  return row;
}

// Demo accounts use "<name>.demo@babson.edu" addresses that don't belong to
// real students. Demo data is for local demos only: the server refuses to start
// in production with SEED_DEMO_DATA on, and admin rights on the live site come
// only from ADMIN_EMAILS.
async function seed({ schoolOnly = false } = {}) {
  const school = await insertSchool(loadSchoolFile(path.join(__dirname, '..', 'schools', 'babson.json')));
  if (schoolOnly) return { school };
  const sid = school.id;
  const spots = JSON.parse(school.meetup_spots).map((s) => s.name);

  const mkUser = (email, first, initial, year, role = 'student', hours = 500) => ({
    id: newId(), school_id: sid, email, first_name: first, last_initial: initial, grad_year: year,
    photo_url: null, role, status: 'active', verified_at: ago(hours), safety_tips_seen: false, created_at: ago(hours),
  });
  const maya = mkUser('maya.demo@babson.edu', 'Maya', 'C', 2027, 'student', 900);
  const jordan = mkUser('jordan.demo@babson.edu', 'Jordan', 'P', 2028, 'student', 700);
  const priya = mkUser('priya.demo@babson.edu', 'Priya', 'S', 2027, 'student', 650);
  const luis = mkUser('luis.demo@babson.edu', 'Luis', 'R', 2029, 'student', 300);
  const tyler = mkUser('tyler.demo@babson.edu', 'Tyler', 'B', 2028, 'student', 30);
  const admin = mkUser('admin.demo@babson.edu', 'Campus', 'A', new Date().getFullYear() + 1, 'admin', 1000);
  await db('users').insert([maya, jordan, priya, luis, tyler, admin]);

  const L = [
    [maya, 'Galanz mini fridge, 3.1 cu ft', 'Works perfectly, has a small freezer section. Cleaned and defrosted. Fits under a lofted bed.', 55, 'Dorm Essentials', 'Good', spots[1], true, 'fridge', 3],
    [jordan, 'Ergonomic mesh desk chair', 'Adjustable height and lumbar support. Used one semester, no rips.', 35, 'Furniture', 'Like New', spots[1], true, 'chair', 5],
    [priya, '5x7 area rug, gray geometric', 'Soft, low pile rug. Makes a dorm feel way less like a dorm. Vacuumed.', 25, 'Dorm Essentials', 'Good', spots[0], true, 'rug', 8],
    [luis, 'Principles of Microeconomics, Mankiw 9th ed', 'Required for ECN 1000. Some highlighting in the first few chapters.', 40, 'Textbooks', 'Good', spots[0], false, 'textbook', 12],
    [maya, 'Financial Accounting bundle (3 books)', 'Textbook, study guide and workbook. Workbook is partly filled in.', 60, 'Textbooks', 'Fair', spots[0], false, 'textbook', 20],
    [jordan, 'Samsung 43" 4K smart TV', 'Bought last year, comes with remote and stand. Netflix and YouTube built in.', 140, 'Electronics', 'Like New', spots[2], true, 'tv', 26],
    [priya, 'LED desk lamp with USB port', 'Three brightness levels and a USB charging port in the base.', 12, 'Dorm Essentials', 'Like New', spots[1], false, 'lamp', 30],
    [luis, 'Futon couch that folds into a bed', 'Great for guests. Frame is solid, cushion is comfy. You will need a friend to carry it.', 85, 'Furniture', 'Good', spots[3], true, 'futon', 34],
    [maya, '3-drawer storage tower', 'Clear plastic drawers on wheels. Perfect for under the desk.', 15, 'Dorm Essentials', 'Good', spots[1], true, 'drawers', 40],
    [priya, 'Keurig K-Mini coffee maker', 'Single serve, makes 6-12 oz. Descaled last week.', 30, 'Dorm Essentials', 'Like New', spots[1], false, 'coffee', 46],
    [jordan, 'Babson hoodie, size M', 'Green crewneck hoodie from the bookstore, washed a few times.', 20, 'Clothing', 'Like New', spots[1], false, 'hoodie', 52],
    [luis, '2 Celtics tickets, Nov 14 (balcony)', 'Two seats together, section 305. Transfer through the Ticketmaster app.', 90, 'Tickets', 'New', spots[0], false, 'tickets', 60],
    [priya, 'Free: about 30 hangers', 'Moving out, take them all. Mix of plastic and velvet.', 0, 'Free Stuff', 'Good', spots[1], true, 'hangers', 64],
    [jordan, 'Full-length mirror', 'Over-the-door or lean against the wall. No cracks.', 15, 'Dorm Essentials', 'Good', spots[1], true, 'mirror', 70],
    [maya, 'Microwave, 0.7 cu ft', '700 watts, turntable works. Allowed in all the dorms.', 25, 'Dorm Essentials', 'Good', spots[1], false, 'microwave', 80],
    [luis, 'Trek hybrid bike + U-lock', 'Rides great, new tires in September. Lock and key included.', 180, 'Other', 'Good', spots[2], false, 'bike', 96],
  ];

  const listingRows = [];
  const photoRows = [];
  const byImage = {};
  for (const [u, title, description, price, category, condition, pickup, moveOut, img, hours] of L) {
    const id = newId();
    listingRows.push({
      id, school_id: sid, seller_id: u.id, title, description, price_cents: price * 100, category, condition,
      pickup_location: pickup, move_out_sale: moveOut, status: 'active', moderation: 'ok', moderation_reasons: '[]',
      created_at: ago(hours), updated_at: ago(hours),
    });
    photoRows.push({ id: newId(), listing_id: id, url: `/img/seed/${img}.svg`, position: 0 });
    byImage[img + title] = id;
    byImage[img] = byImage[img] || id;
  }
  // A completed sale (Maya -> Priya) with a thumbs up
  const shelfId = newId();
  listingRows.push({ id: shelfId, school_id: sid, seller_id: maya.id, title: 'IKEA Billy bookshelf', description: 'White, 5 shelves.', price_cents: 3000, category: 'Furniture', condition: 'Good', pickup_location: spots[1], move_out_sale: false, status: 'sold', moderation: 'ok', moderation_reasons: '[]', sold_to_user_id: priya.id, created_at: ago(200), updated_at: ago(150) });
  photoRows.push({ id: newId(), listing_id: shelfId, url: '/img/seed/bookshelf.svg', position: 0 });
  // For the admin view: an auto-flagged listing and a reported scam
  const pongId = newId();
  listingRows.push({ id: pongId, school_id: sid, seller_id: luis.id, title: 'Beer pong table + cups', description: 'Folding table, 8 ft.', price_cents: 40 * 100, category: 'Furniture', condition: 'Good', pickup_location: spots[3], move_out_sale: true, status: 'active', moderation: 'flagged', moderation_reasons: JSON.stringify(['Alcohol']), created_at: ago(2), updated_at: ago(2) });
  photoRows.push({ id: newId(), listing_id: pongId, url: '/img/seed/beerpong.svg', position: 0 });
  const podsId = newId();
  listingRows.push({ id: podsId, school_id: sid, seller_id: tyler.id, title: 'AirPods Pro, brand new sealed', description: 'Sealed in box. $40, Venmo me first and I will drop them at your dorm.', price_cents: 4000, category: 'Electronics', condition: 'New', pickup_location: null, move_out_sale: false, status: 'active', moderation: 'ok', moderation_reasons: '[]', created_at: ago(6), updated_at: ago(6) });
  photoRows.push({ id: newId(), listing_id: podsId, url: '/img/seed/airpods.svg', position: 0 });

  await db.batchInsert('listings', listingRows, 50);
  await db.batchInsert('listing_photos', photoRows, 50);

  await db('ratings').insert([
    { id: newId(), listing_id: shelfId, rater_id: priya.id, seller_id: maya.id, value: 1, created_at: ago(149) },
  ]);

  // Conversations
  const fridgeId = byImage.fridge;
  const c1 = { id: newId(), school_id: sid, listing_id: fridgeId, buyer_id: jordan.id, seller_id: maya.id, created_at: ago(2.5), last_message_at: ago(1.6), buyer_last_read_at: ago(1.6), seller_last_read_at: ago(2) };
  const c2 = { id: newId(), school_id: sid, listing_id: byImage.tv, buyer_id: maya.id, seller_id: jordan.id, created_at: ago(5), last_message_at: ago(4), buyer_last_read_at: ago(4), seller_last_read_at: ago(4) };
  const c3 = { id: newId(), school_id: sid, listing_id: shelfId, buyer_id: priya.id, seller_id: maya.id, created_at: ago(170), last_message_at: ago(150), buyer_last_read_at: ago(150), seller_last_read_at: ago(150) };
  await db('conversations').insert([c1, c2, c3]);
  const m = (c, sender, body, hours, kind = 'text') => ({ id: newId(), conversation_id: c.id, sender_id: sender.id, kind, body, created_at: ago(hours) });
  await db('messages').insert([
    m(c1, jordan, 'Hi! Is this still available?', 2.5),
    m(c1, maya, 'Yes it is! I\'m around campus most afternoons.', 2.2),
    m(c1, jordan, 'Great, could we meet tomorrow around 4?', 2.0),
    m(c1, maya, JSON.stringify({ name: spots[1], description: 'Indoors, staffed front desk nearby', when: 'Tomorrow 4pm' }), 1.9, 'meetup'),
    m(c1, jordan, 'Perfect, see you there', 1.6),
    m(c2, maya, 'Hi! Is this still available?', 5),
    m(c2, jordan, 'It is! Want to see it working first? Happy to meet at Public Safety.', 4),
    m(c3, priya, 'Is this still available?', 170),
    m(c3, maya, 'Yep! Meet at Reynolds tomorrow at noon?', 168),
    m(c3, maya, 'Seller marked this item sold.', 150, 'system'),
  ]);

  await db('reports').insert([
    { id: newId(), school_id: sid, reporter_id: maya.id, listing_id: podsId, reported_user_id: tyler.id, reason: 'scam', details: 'Asked me to Venmo before meeting and the price is way too low for sealed AirPods Pro.', status: 'open', created_at: ago(4) },
    { id: newId(), school_id: sid, reporter_id: priya.id, listing_id: null, reported_user_id: tyler.id, reason: 'no_show', details: 'Agreed to meet at the library and never showed up.', status: 'open', created_at: ago(20) },
  ]);

  return { school };
}

async function seedIfEmpty(opts = {}) {
  const row = await db('schools').first();
  if (row) return false;
  await seed(opts);
  console.log(opts.schoolOnly ? 'Added Babson College (no demo data).' : 'Seeded demo data for Babson College.');
  return true;
}

async function resetAll() {
  if (require('./config').isProduction) throw new Error('Refusing to reset the production database.');
  for (const t of ['ratings', 'blocks', 'reports', 'messages', 'conversations', 'listing_photos', 'listings', 'sessions', 'verification_codes', 'users', 'schools']) {
    await db(t).del();
  }
  await seed();
}

module.exports = { seed, seedIfEmpty, resetAll, insertSchool, loadSchoolFile };
