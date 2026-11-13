(function () {
  "use strict";
  var provider = window.PickleAuth;
  var homeUrl = (window.PICKLE_CONFIG || {}).siteUrl;
  if (homeUrl) document.querySelectorAll('.account-header a[href="/"]').forEach(function (link) { link.href = homeUrl; });
  var registering = new URLSearchParams(location.search).get("mode") === "register";
  var $ = function (selector) { return document.querySelector(selector); };
  function clear() { provider.clear(); }
  function restore() {
    return provider.user().then(function (current) { return !!current; }).catch(function () { return false; });
  }
  function setMode() {
    $("#login-tab").setAttribute("aria-selected", String(!registering));
    $("#register-tab").setAttribute("aria-selected", String(registering));
    $("#auth-heading").textContent = registering ? "Make yourself at home." : "Welcome back.";
    $("#identity-label").textContent = registering ? "Email" : "Email or username";
    $("#identity").type = registering ? "email" : "text";
    $("#identity").autocomplete = registering ? "email" : "username";
    $("#username-field").hidden = !registering;
    $("#confirm-field").hidden = !registering;
    $("#username").required = registering;
    $("#auth-confirm").required = registering;
    $("#auth-password").minLength = registering ? 8 : 1;
    $("#auth-password").autocomplete = registering ? "new-password" : "current-password";
    $("#submit-auth").textContent = registering ? "Create account" : "Sign in";
    $("#auth-message").hidden = true;
  }
  function showAuth() { $("#dashboard").hidden = true; $("#auth-area").hidden = false; $("#account-loading").hidden = true; }
  async function showDashboard() {
    var current = await provider.user();
    if (!current) { showAuth(); return; }
    var username = (current.user_metadata || {}).username || "Player";
    $("#greeting").textContent = username;
    $("#current-username").value = username;
    $("#current-email").value = current.email;
    $("#dashboard").hidden = false; $("#auth-area").hidden = true; $("#account-loading").hidden = true;
  }
  async function withForm(form, task) {
    var button = form.querySelector("button[type=submit], button:not([type])");
    var message = form.querySelector(".settings-message, .form-error");
    if (button.disabled) return;
    button.disabled = true; button.setAttribute("aria-busy", "true"); message.hidden = true;
    try { await task(message); } catch (error) { message.textContent = error.message; message.classList.add("is-error"); message.hidden = false; }
    finally { button.disabled = false; button.removeAttribute("aria-busy"); }
  }
  function success(message, text) { message.textContent = text; message.classList.remove("is-error"); message.hidden = false; }
  $("#login-tab").onclick = function () { registering = false; setMode(); };
  $("#register-tab").onclick = function () { registering = true; setMode(); };
  $("#account-auth-form").onsubmit = function (event) {
    event.preventDefault(); var form = event.currentTarget;
    withForm(form, async function () {
      var password = $("#auth-password").value;
      if (registering && password !== $("#auth-confirm").value) throw new Error("Passwords do not match.");
      var body = { email: $("#identity").value.trim(), password: password };
      if (registering) body.displayName = $("#username").value.trim();
      if (registering) {
        var result = await provider.register(body.email, body.password, body.displayName);
        if (!result.confirmed) { success($("#auth-message"), "Check your email to confirm your account, then sign in."); return; }
      } else await provider.login(body.email, body.password);
      form.reset(); await showDashboard();
    });
  };
  $("#logout").onclick = async function () { try { await provider.logout(); } finally { clear(); showAuth(); } };
  [["#rename-form", "/api/me", "Username updated."], ["#email-form", "/api/account/email", "Email updated."], ["#password-form", "/api/account/password", "Password updated."]].forEach(function (entry) {
    $(entry[0]).onsubmit = function (event) {
      event.preventDefault(); var form = event.currentTarget;
      withForm(form, async function (message) {
        var body = Object.fromEntries(new FormData(form));
        if (body.newPassword && body.newPassword !== body.confirmPassword) throw new Error("New passwords do not match.");
        if (entry[0] === "#rename-form") await provider.rename(body.displayName);
        if (entry[0] === "#email-form") await provider.email(body.email, body.currentPassword);
        if (entry[0] === "#password-form") await provider.password(body.newPassword, body.currentPassword);
        form.querySelectorAll('input[type="password"]').forEach(function (input) { input.value = ""; });
        if (entry[0] === "#password-form") { clear(); showAuth(); success($("#auth-message"), "Password changed. Sign in with your new password."); }
        else { await showDashboard(); success(message, entry[0] === "#email-form" ? "Check your inbox to confirm your new email address." : entry[2]); }
      });
    };
  });
  $("#link-form").onsubmit = function (event) {
    event.preventDefault(); var code = new FormData(event.currentTarget).get("code").toUpperCase().replace(/[^A-Z0-9]/g, "");
    var message = event.currentTarget.querySelector(".settings-message");
    if (code.length !== 8) { message.textContent = "Enter the eight-character code from your launcher."; message.classList.add("is-error"); message.hidden = false; return; }
    location.href = "/auth?code=" + encodeURIComponent(code.slice(0, 4) + "-" + code.slice(4));
  };
  setMode();
  restore().then(function (ok) { if (ok) return showDashboard(); showAuth(); }).catch(function (error) { showAuth(); success($("#auth-message"), error.message); });
})();
