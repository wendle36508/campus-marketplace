// Shared helpers: schools, auth middleware, and the serializers that decide
// what one user is allowed to see about another.
const crypto = require('crypto');
const { db, parseJson } = require('./db');

// ---- errors -----------------------------------------------------------------
class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// ---- schools ----------------------------------------------------------------
function toSchool(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    short_name: row.short_name,
    email_domains: parseJson(row.email_domains, []),
    primary_color: row.primary_color,
    primary_color_dark: row.primary_color_dark || row.primary_color,
    logo_url: row.logo_url,
    meetup_spots: parseJson(row.meetup_spots, []),
  };
}

async function getSchool(id) {
  return toSchool(await db('schools').where({ id }).first());
}

async function activeSchools() {
  return (await db('schools').where({ is_active: true }).orderBy('name')).map(toSchool);
}

async function schoolForEmail(email) {
  const domain = String(email).split('@')[1] || '';
  const schools = await activeSchools();
  return schools.find((s) => s.email_domains.map((d) => d.toLowerCase()).includes(domain)) || null;
}

// ---- auth middleware --------------------------------------------------------
const SESSION_COOKIE = 'sid';

async function loadUser(req, _res, next) {
  try {
    const token = req.cookies && req.cookies[SESSION_COOKIE];
    if (token) {
      const session = await db('sessions').where({ token_hash: sha256(token) }).first();
      if (session && session.expires_at > new Date().toISOString()) {
        const user = await db('users').where({ id: session.user_id }).first();
        if (user) {
          req.user = user;
          req.school = await getSchool(user.school_id);
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireUser(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in.', 'auth_required'));
  if (req.user.status === 'banned') return next(new HttpError(403, 'This account has been suspended.', 'banned'));
  if (!req.user.verified_at) return next(new HttpError(403, 'Please verify your email first.', 'unverified'));
  next();
}

// Verified AND has finished their profile.
function requireMember(req, res, next) {
  requireUser(req, res, (err) => {
    if (err) return next(err);
    if (!req.user.first_name) return next(new HttpError(403, 'Finish your profile first.', 'profile_incomplete'));
    next();
  });
}

function requireAdmin(req, res, next) {
  requireMember(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== 'admin') return next(new HttpError(403, 'Admins only.', 'forbidden'));
    next();
  });
}

// ---- serializers ------------------------------------------------------------
// The ONLY shape of a user that other users ever receive. No email, no phone.
function publicUser(u, school, stats) {
  if (!u) return null;
  const s = (stats && stats[u.id]) || { up: 0, down: 0, sold: 0 };
  return {
    id: u.id,
    first_name: u.first_name,
    last_initial: u.last_initial,
    display_name: u.first_name ? `${u.first_name} ${u.last_initial || ''}.`.replace(' .', '') : 'Student',
    grad_year: u.grad_year,
    photo_url: u.photo_url,
    verified: !!u.verified_at,
    school_short_name: school ? school.short_name : null,
    banned: u.status === 'banned',
    rating: { up: s.up, down: s.down },
    sold_count: s.sold,
    member_since: u.created_at,
  };
}

// The signed-in user's own view of themselves.
function selfUser(u, school, stats) {
  return {
    ...publicUser(u, school, stats),
    email: u.email,
    role: u.role,
    status: u.status,
    safety_tips_seen: !!u.safety_tips_seen,
    profile_complete: !!u.first_name,
  };
}

async function userStats(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const out = {};
  for (const id of ids) out[id] = { up: 0, down: 0, sold: 0 };
  if (!ids.length) return out;
  const ratings = await db('ratings')
    .select('seller_id', 'value')
    .count({ n: '*' })
    .whereIn('seller_id', ids)
    .groupBy('seller_id', 'value');
  for (const r of ratings) {
    if (Number(r.value) > 0) out[r.seller_id].up = Number(r.n);
    else out[r.seller_id].down = Number(r.n);
  }
  const sold = await db('listings').select('seller_id').count({ n: '*' }).whereIn('seller_id', ids).where({ status: 'sold' }).groupBy('seller_id');
  for (const r of sold) out[r.seller_id].sold = Number(r.n);
  return out;
}

// Loads photos + sellers for a batch of listing rows and returns client objects.
async function hydrateListings(rows, school, viewer) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const photos = await db('listing_photos').whereIn('listing_id', ids).orderBy('position');
  const sellers = await db('users').whereIn('id', [...new Set(rows.map((r) => r.seller_id))]);
  const stats = await userStats(sellers.map((s) => s.id));
  const sellerById = Object.fromEntries(sellers.map((s) => [s.id, s]));
  return rows.map((r) => {
    const isOwner = viewer && viewer.id === r.seller_id;
    const isAdmin = viewer && viewer.role === 'admin';
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      price: r.price_cents / 100,
      category: r.category,
      condition: r.condition,
      pickup_location: r.pickup_location,
      move_out_sale: !!r.move_out_sale,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      photos: photos.filter((p) => p.listing_id === r.id).map((p) => p.url),
      seller: publicUser(sellerById[r.seller_id], school, stats),
      is_mine: !!isOwner,
      // moderation details are only visible to the owner and admins
      ...(isOwner || isAdmin
        ? {
            moderation: r.moderation,
            moderation_reasons: parseJson(r.moderation_reasons, []),
            sold_to_user_id: r.sold_to_user_id,
          }
        : {}),
    };
  });
}

// Ids of users the viewer has blocked or been blocked by (hidden both ways).
async function blockedIds(userId) {
  const rows = await db('blocks').where({ blocker_id: userId }).orWhere({ blocked_id: userId });
  return [...new Set(rows.map((r) => (r.blocker_id === userId ? r.blocked_id : r.blocker_id)))];
}

module.exports = {
  HttpError,
  wrap,
  sha256,
  toSchool,
  getSchool,
  activeSchools,
  schoolForEmail,
  SESSION_COOKIE,
  loadUser,
  requireUser,
  requireMember,
  requireAdmin,
  publicUser,
  selfUser,
  userStats,
  hydrateListings,
  blockedIds,
};
