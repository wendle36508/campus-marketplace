// Shared in-memory app state.
export const state = {
  config: null, // /api/config: app name, school branding, categories...
  me: null, // the signed-in user (or null)
  unread: 0,
  feedFilters: { q: '', category: '', condition: [], min: '', max: '', move_out: false, sort: 'new' },
};
