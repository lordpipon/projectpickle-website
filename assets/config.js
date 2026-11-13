/*
 * Project Pickle website configuration.
 *
 * Leave apiUrl empty when this site is served from the same origin as the API
 * (for example nginx serving this folder and proxying /api to the backend).
 *
 * On Vercel the API lives on another host, so point it at the backend:
 *   apiUrl: "https://api.projectpickle.xyz"
 */
window.PICKLE_CONFIG = {
  apiUrl: "https://34-32-63-8.sslip.io",
  authUrl: "https://projectpickle.xyz",
  siteUrl: "https://projectpickle.xyz",
  supabase: {
    url: "",
    anonKey: "",
  },
};
