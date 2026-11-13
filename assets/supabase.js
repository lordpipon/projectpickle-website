/* Supabase Auth REST client. Only a publishable/anon key belongs in the browser. */
(function () {
  "use strict";
  var config = window.PICKLE_CONFIG || {};
  var provider = config.supabase || {};
  var key = "pickle.supabase.session";
  var session = null;
  var refreshTask = null;
  try { session = JSON.parse(localStorage.getItem(key) || "null"); } catch (_) {}
  function configured() {
    if (!provider.url || !provider.anonKey) throw new Error("Supabase is not connected yet. Add the Project URL and publishable key in assets/config.js.");
  }
  function save(next) { session = next; try { if (next) localStorage.setItem(key, JSON.stringify(next)); else localStorage.removeItem(key); } catch (_) {} }
  var callback = new URLSearchParams(location.hash.slice(1));
  if (callback.get("access_token") && callback.get("refresh_token")) {
    save({ access_token: callback.get("access_token"), refresh_token: callback.get("refresh_token"), expires_at: Date.now() / 1000 + Number(callback.get("expires_in") || 3600) });
    history.replaceState(null, "", location.pathname + location.search);
  }
  async function auth(path, method, body, access) {
    configured();
    var response;
    try { response = await fetch(provider.url.replace(/\/+$/, "") + "/auth/v1" + path, { method: method || "GET", headers: { apikey: provider.anonKey, "content-type": "application/json", authorization: "Bearer " + (access || provider.anonKey) }, body: body ? JSON.stringify(body) : undefined }); }
    catch (_) { throw new Error("Cannot reach the account service. Please try again."); }
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.msg || data.message || data.error_description || "Could not complete the request.");
    return data;
  }
  async function token() {
    if (!session) return null;
    if (session.expires_at > Date.now() / 1000 + 60) return session.access_token;
    if (!refreshTask) refreshTask = auth("/token?grant_type=refresh_token", "POST", { refresh_token: session.refresh_token }).then(function (data) { save(data); return data.access_token; }).catch(function (error) { save(null); throw error; }).finally(function () { refreshTask = null; });
    return refreshTask;
  }
  async function user() { var access = await token(); if (!access) return null; return auth("/user", "GET", null, access); }
  async function verifyPassword(password) {
    var current = await user();
    if (!current) throw new Error("Sign in again.");
    try { var fresh = await auth("/token?grant_type=password", "POST", { email: current.email, password: password }); save(fresh); }
    catch (_) { throw new Error("Your current password is incorrect."); }
  }
  window.PickleAuth = {
    token: token,
    user: user,
    clear: function () { save(null); },
    login: async function (identity, password) {
      var data;
      if (identity.includes("@")) data = await auth("/token?grant_type=password", "POST", { email: identity, password: password });
      else {
        configured();
        var response = await fetch(config.usernameLoginUrl || (config.apiUrl.replace(/\/+$/, "") + "/api/auth/supabase/login"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: identity, password: password }) });
        data = await response.json();
        if (!response.ok) throw new Error((data.error || {}).message || "Username or password is incorrect.");
      }
      save(data); return data;
    },
    register: async function (email, password, username) {
      var data = await auth("/signup?redirect_to=" + encodeURIComponent(location.origin + "/account"), "POST", { email: email, password: password, data: { username: username } });
      if (data.access_token) save(data);
      return { confirmed: !!data.access_token };
    },
    rename: async function (username) { var data = await auth("/user", "PUT", { data: { username: username } }, await token()); return data; },
    email: async function (email, password) { await verifyPassword(password); return auth("/user", "PUT", { email: email }, await token()); },
    password: async function (next, current) {
      await verifyPassword(current);
      await auth("/user", "PUT", { password: next }, await token());
      var response = await fetch(config.apiUrl.replace(/\/+$/, "") + "/api/account/revoke-devices", { method: "POST", headers: { authorization: "Bearer " + await token(), "content-type": "application/json" }, body: "{}" });
      await this.logout();
      if (!response.ok) throw new Error("Password changed. Sign in again; launcher sessions could not be revoked. Contact support.");
    },
    logout: async function () { var access = await token(); try { if (access) await auth("/logout?scope=global", "POST", {}, access); } finally { save(null); } }
  };
  window.addEventListener("storage", function (event) { if (event.key === key) { try { session = JSON.parse(event.newValue || "null"); } catch (_) { session = null; } } });
})();
