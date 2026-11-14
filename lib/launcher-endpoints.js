// Explicit desktop API surface. No arbitrary proxy paths or internal server-token endpoints.
export function launcherEndpoint(path, method) {
  const paths = {
    GET: ['me','me/matches','account','builds','status','leaderboard'],
    POST: ['auth/device/start','auth/device/poll','auth/refresh','auth/logout'],
    PATCH: ['me'],
  };
  return paths[method]?.includes(path) ?? false;
}
export const desktopHeaders = {
  'access-control-allow-origin':'null',
  'access-control-allow-methods':'GET, POST, PATCH, OPTIONS',
  'access-control-allow-headers':'authorization, content-type',
  'vary':'Origin',
};
