/* ------------------------------------------------------------------ *
 * Project Pickle website
 *
 * Two pages share this script:
 *   /          landing page
 *   /device    device sign-in (links the launcher to an account)
 *
 * No build step and no dependencies, so it deploys anywhere static.
 * ------------------------------------------------------------------ */

(function () {
  "use strict";

  var API = ((window.PICKLE_CONFIG && window.PICKLE_CONFIG.apiUrl) || "").replace(/\/+$/, "");
  var REFRESH_KEY = "pickle.web.refresh";

  document.documentElement.classList.add("js");

  /* ---------------------------------------------------------------- *
   * API
   * ---------------------------------------------------------------- */

  function ApiError(status, code, message) {
    this.status = status;
    this.code = code;
    this.message = message;
  }
  ApiError.prototype = Object.create(Error.prototype);

  var accessToken = null;
  var user = null;

  async function api(path, options) {
    var opts = options || {};
    var headers = Object.assign({}, opts.headers || {});
    if (opts.body && !headers["content-type"]) headers["content-type"] = "application/json";
    if (accessToken && opts.auth !== false) headers.authorization = "Bearer " + accessToken;

    var response;
    try {
      response = await fetch(API + path, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body,
      });
    } catch (cause) {
      throw new ApiError(0, "OFFLINE", "Cannot reach the Project Pickle backend.");
    }

    var text = await response.text();
    var payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (cause) {
      payload = null;
    }

    if (!response.ok) {
      var error = (payload && payload.error) || {};
      throw new ApiError(
        response.status,
        error.code || "HTTP_" + response.status,
        error.message || "Something went wrong.",
      );
    }
    return payload;
  }

  /* ---------------------------------------------------------------- *
   * Session
   * ---------------------------------------------------------------- */

  function remember(auth) {
    accessToken = auth.accessToken;
    user = auth.user;
    try {
      localStorage.setItem(REFRESH_KEY, auth.refreshToken);
    } catch (cause) {
      /* private mode: the session just will not survive a reload */
    }
  }

  function forget() {
    accessToken = null;
    user = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem("pickle.user");
    } catch (cause) {
      /* ignore */
    }
  }

  async function restore() {
    if (window.PickleAuth) {
      try {
        var current = await window.PickleAuth.user();
        if (!current) return false;
        accessToken = await window.PickleAuth.token();
        user = { id: current.id, displayName: (current.user_metadata || {}).username || "Player" };
        return true;
      } catch (cause) { return false; }
    }
    var stored = null;
    try {
      stored = localStorage.getItem(REFRESH_KEY);
    } catch (cause) {
      stored = null;
    }
    if (!stored) return false;

    try {
      var auth = await api("/api/auth/refresh", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ refreshToken: stored }),
      });
      remember(auth);
      return true;
    } catch (cause) {
      forget();
      return false;
    }
  }

  function signOut() {
    if (window.PickleAuth) { window.PickleAuth.clear(); forget(); return; }
    var stored = null;
    try {
      stored = localStorage.getItem(REFRESH_KEY);
    } catch (cause) {
      stored = null;
    }
    if (stored) {
      api("/api/auth/logout", { method: "POST", auth: false, body: JSON.stringify({ refreshToken: stored }) }).catch(
        function () {},
      );
    }
    forget();
  }

  /* ---------------------------------------------------------------- *
   * DOM helpers
   * ---------------------------------------------------------------- */

  function $(selector) {
    return document.querySelector(selector);
  }

  function setText(selector, value) {
    var node = $(selector);
    if (node) node.textContent = value;
  }

  function showError(selector, message) {
    var node = $(selector);
    if (!node) return;
    node.textContent = message || "";
    node.hidden = !message;
  }

  async function busy(button, task) {
    if (!button) return task();
    var original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + original;
    try {
      return await task();
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  function normalizeCode(value) {
    var cleaned = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (cleaned.length !== 8) return "";
    return cleaned.slice(0, 4) + "-" + cleaned.slice(4);
  }

  function maskedCode(code) {
    return code || "----";
  }

  function number(value) {
    return typeof value === "number" && isFinite(value) ? value.toLocaleString("en-US") : "—";
  }

  /* ---------------------------------------------------------------- *
   * Landing page
   * ---------------------------------------------------------------- */

  var REGION_NAMES = {
    "eu-central": "Europe · Frankfurt",
    "eu-west": "Europe · London",
    "na-east": "N. America · Virginia",
    "na-west": "N. America · Oregon",
  };

  var SORTS = {
    xp: function (entry) {
      return number(entry.xp) + " XP";
    },
    wins: function (entry) {
      return number(entry.wins) + " wins";
    },
    kills: function (entry) {
      return number(entry.kills) + " kills";
    },
  };

  function statusPill(text) {
    ["#nav-status", "#foot-status"].forEach(function (selector) {
      var pill = $(selector);
      if (!pill) return;
      pill.hidden = false;
      var label = pill.querySelector(".text");
      if (label) label.textContent = text;
    });
  }

  function regionRow(region) {
    var row = document.createElement("div");
    row.className = "console-row";

    var name = document.createElement("span");
    name.className = "region" + (region.online ? " is-online" : "");
    name.innerHTML = '<i class="dot" aria-hidden="true"></i>';
    var label = document.createElement("span");
    label.textContent = REGION_NAMES[region.region] || region.region;
    name.appendChild(label);

    row.appendChild(name);
    row.appendChild(metric(region.queuedPlayers, "queued"));
    row.appendChild(metric(region.playersInMatch, "playing"));
    return row;
  }

  function metric(value, label) {
    var cell = document.createElement("span");
    cell.className = "metric";
    var strong = document.createElement("b");
    strong.textContent = number(value);
    var small = document.createElement("small");
    small.textContent = label;
    cell.appendChild(strong);
    cell.appendChild(small);
    return cell;
  }

  function renderStatus(status) {
    var online = (status.regions || []).filter(function (region) {
      return region.online;
    });
    var total = (status.regions || []).length;
    var queued = (status.totals && status.totals.queuedPlayers) || 0;

    var rows = $("#live-rows");
    if (rows) {
      rows.textContent = "";
      var regions = status.regions || [];
      if (regions.length === 0) {
        var empty = document.createElement("div");
        empty.className = "console-row is-loading";
        empty.textContent = "No regions configured";
        rows.appendChild(empty);
      } else {
        regions.forEach(function (region) {
          rows.appendChild(regionRow(region));
        });
      }
    }

    var tag = $("#live-tag");
    if (tag) {
      tag.setAttribute("data-state", online.length ? "live" : "down");
      var text = tag.querySelector("span");
      if (text) text.textContent = online.length ? "Live" : "Offline";
    }

    setText("#stat-regions", number(online.length) + " / " + number(total));
    setText("#stat-queue", number(queued));
    setText("#stat-matches", number(status.totals && status.totals.matchesFormed));
    setText("#stat-accounts", number(status.totals && status.totals.accounts));

    var clock = new Date();
    setText(
      "#live-updated",
      clock.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    );

    statusPill(online.length + " of " + total + " regions online");
  }

  async function loadStatus() {
    try {
      renderStatus(await api("/api/status", { auth: false }));
    } catch (cause) {
      var tag = $("#live-tag");
      if (tag) {
        tag.setAttribute("data-state", "down");
        var text = tag.querySelector("span");
        if (text) text.textContent = "Offline";
      }
      var rows = $("#live-rows");
      if (rows) {
        rows.innerHTML = '<div class="console-row is-loading">Backend unreachable</div>';
      }
      setText("#live-updated", "no response");
      statusPill("Backend unreachable");
    }
  }

  async function loadBoard(sort) {
    var board = $("#board");
    if (!board) return;

    try {
      var data = await api("/api/leaderboard?limit=8&sort=" + encodeURIComponent(sort), { auth: false });
      var entries = (data && data.entries) || [];
      var format = SORTS[sort] || SORTS.xp;

      board.textContent = "";

      if (entries.length === 0) {
        var empty = document.createElement("li");
        empty.className = "board-empty";
        empty.innerHTML =
          "<strong>No matches reported yet.</strong><span>The board fills as soon as results come in.</span>";
        board.appendChild(empty);
        return;
      }

      entries.forEach(function (entry) {
        var row = document.createElement("li");
        row.className = "board-row";

        var rank = document.createElement("span");
        rank.className = "board-rank";
        rank.textContent = String(entry.rank).padStart(2, "0");

        var name = document.createElement("span");
        name.className = "board-name";
        name.textContent = entry.displayName;

        var value = document.createElement("span");
        value.className = "board-value";
        value.textContent = format(entry);

        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(value);
        board.appendChild(row);
      });
    } catch (cause) {
      board.innerHTML =
        '<li class="board-empty"><strong>Leaderboard unavailable.</strong><span>The backend did not answer.</span></li>';
    }
  }

  function initBoardTabs() {
    var tabs = document.querySelectorAll(".board-panel .tab");
    if (!tabs.length) return;

    for (var index = 0; index < tabs.length; index += 1) {
      tabs[index].addEventListener("click", function (event) {
        var button = event.currentTarget;
        var sort = button.getAttribute("data-sort") || "xp";

        for (var i = 0; i < tabs.length; i += 1) {
          var active = tabs[i] === button;
          tabs[i].classList.toggle("is-active", active);
          tabs[i].setAttribute("aria-selected", String(active));
        }

        loadBoard(sort);
      });
    }
  }

  function initNav() {
    var nav = $("#nav");
    if (!nav) return;

    var onScroll = function () {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function initReveal() {
    var targets = document.querySelectorAll(
      ".section-head, .step, .mode, .fact-list li, .board-panel, .support-row, .faq-grid > div, .closer-inner",
    );
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      for (var i = 0; i < targets.length; i += 1) targets[i].classList.add("is-in");
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    for (var index = 0; index < targets.length; index += 1) {
      targets[index].setAttribute("data-reveal", "");
      targets[index].style.setProperty("--delay", (index % 4) * 45 + "ms");
      observer.observe(targets[index]);
    }
  }

  function initSite() {
    var year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    initNav();
    initReveal();
    initBoardTabs();

    loadBoard("xp");

  }

  /* ---------------------------------------------------------------- *
   * Device sign-in
   * ---------------------------------------------------------------- */

  var code = "";
  var mode = "login";

  function setMode(next) {
    mode = next;
    var isRegister = mode === "register";

    var tabLogin = $("#tab-login");
    var tabRegister = $("#tab-register");
    if (tabLogin) tabLogin.setAttribute("aria-selected", String(!isRegister));
    if (tabRegister) tabRegister.setAttribute("aria-selected", String(isRegister));

    var nameField = $("#field-name");
    if (nameField) nameField.hidden = !isRegister;
    var confirmation = $("#field-confirm");
    if (confirmation) confirmation.hidden = !isRegister;
    setText("#device-identity-label", isRegister ? "Email" : "Email or username");
    var identity = $("#email");
    if (identity) { identity.type = isRegister ? "email" : "text"; identity.autocomplete = isRegister ? "email" : "username"; }

    setText("#auth-title", isRegister ? "Create your account" : "Sign in to Project Pickle");
    setText(
      "#auth-copy",
      isRegister ? "One account for the launcher, the website and your stats." : "Use the account you already play on.",
    );
    setText("#auth-submit", isRegister ? "Create account" : "Sign in");

    var password = $("#password");
    if (password) {
      password.setAttribute("autocomplete", isRegister ? "new-password" : "current-password");
      password.placeholder = isRegister ? "At least 8 characters" : "";
    }
    showError("#auth-error", "");
  }

  function view(name) {
    document.body.setAttribute("data-view", name);
    var views = document.querySelectorAll("[data-view-panel]");
    for (var index = 0; index < views.length; index += 1) {
      views[index].hidden = views[index].getAttribute("data-view-panel") !== name;
    }
  }

  function renderWho() {
    var pill = $("#who");
    if (!pill) return;
    if (user) {
      pill.hidden = false;
      pill.querySelector(".text").textContent = user.displayName;
    } else {
      pill.hidden = true;
    }
  }

  async function render() {
    if (!code) {
      view("code");
      var input = $("#code");
      if (input) input.focus();
      return;
    }

    setText("#confirm-code", maskedCode(code));

    if (!user) {
      view("auth");
      var email = $("#email");
      if (email) email.focus();
      return;
    }

    view("confirm");
  }

  function acceptCode(raw, replace) {
    var normalized = normalizeCode(raw);
    if (!normalized) {
      showError("#code-error", "That code should be eight letters and numbers, like ABCD-EFGH.");
      return false;
    }

    code = normalized;
    showError("#code-error", "");

    if (replace === false) return true;

    try {
      var url = new URL(window.location.href);
      url.searchParams.set("code", code);
      window.history.replaceState(null, "", url.pathname + url.search);
    } catch (cause) {
      /* file:// or a very old browser: keep the code in memory only */
    }
    return true;
  }

  function terminal(message) {
    setText("#gone-title", message.title);
    setText("#gone-copy", message.copy);
    view("gone");
  }

  async function approve(button) {
    showError("#confirm-error", "");
    await busy(button, async function () {
      try {
        await api("/api/auth/device/approve", {
          method: "POST",
          body: JSON.stringify({ userCode: code }),
        });
        setText("#done-name", user ? user.displayName : "");
        view("done");
      } catch (error) {
        if (error.code === "DEVICE_NOT_FOUND") {
          terminal({ title: "That code is not valid", copy: "Double-check the code in your launcher and try again." });
        } else if (error.code === "DEVICE_EXPIRED") {
          terminal({
            title: "That code expired",
            copy: "Codes are valid for ten minutes. Start a new sign-in from the launcher.",
          });
        } else if (error.code === "DEVICE_CONSUMED") {
          terminal({ title: "Already used", copy: "That sign-in is already complete. Go back to the launcher." });
        } else if (error.status === 401) {
          forget();
          user = null;
          renderWho();
          showError("#auth-error", "Your session expired. Sign in again.");
          view("auth");
        } else {
          showError("#confirm-error", error.message);
        }
      }
    });
  }

  async function submitAuth(form, button) {
    showError("#auth-error", "");

    var email = ($("#email") || {}).value || "";
    var password = ($("#password") || {}).value || "";
    var displayName = ($("#name") || {}).value || "";
    if (mode === "register" && password !== ($("#confirm-password") || {}).value) {
      showError("#auth-error", "Passwords do not match.");
      return;
    }

    if (!email || !password) {
      showError("#auth-error", "Email and password are both required.");
      return;
    }
    if (mode === "register" && displayName.trim().length < 3) {
      showError("#auth-error", "Pick a display name of at least three characters.");
      return;
    }

    await busy(button, async function () {
      try {
        if (window.PickleAuth) {
          if (mode === "register") {
            var created = await window.PickleAuth.register(email.trim(), password, displayName.trim());
            if (!created.confirmed) { showError("#auth-error", "Check your email to confirm your account, then sign in."); return; }
          } else await window.PickleAuth.login(email.trim(), password);
          await restore(); renderWho(); if (form) form.reset(); await render(); return;
        }
        var auth =
          mode === "register"
            ? await api("/api/auth/register", {
                method: "POST",
                auth: false,
                body: JSON.stringify({ email: email, password: password, displayName: displayName.trim() }),
              })
            : await api("/api/auth/login", {
                method: "POST",
                auth: false,
                body: JSON.stringify({ email: email, password: password }),
              });

        remember(auth);
        renderWho();
        if (form) form.reset();
        await render();
      } catch (error) {
        showError("#auth-error", error.message);
      }
    });
  }

  async function initDevice() {
    var params = new URLSearchParams(window.location.search);
    var incoming = params.get("code");
    if (incoming) acceptCode(incoming, false);

    view("loading");
    await restore();
    renderWho();
    await render();

    var tabs = document.querySelectorAll(".tab");
    for (var index = 0; index < tabs.length; index += 1) {
      tabs[index].addEventListener("click", function (event) {
        setMode(event.currentTarget.getAttribute("data-mode"));
      });
    }

    var codeForm = $("#form-code");
    if (codeForm) {
      codeForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!acceptCode(($("#code") || {}).value)) return;
        await render();
      });
    }
    var codeInput = $("#code");
    if (codeInput) {
      codeInput.addEventListener("input", function () {
        var caret = codeInput.selectionStart;
        codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9 -]/g, "");
        if (caret !== null) codeInput.setSelectionRange(caret, caret);
        showError("#code-error", "");
      });
    }

    var authForm = $("#form-auth");
    if (authForm) {
      authForm.addEventListener("submit", function (event) {
        event.preventDefault();
        submitAuth(authForm, $("#auth-submit"));
      });
    }

    var approveButton = $("#approve");
    if (approveButton) {
      approveButton.addEventListener("click", function () {
        approve(approveButton);
      });
    }

    var switchUser = $("#switch-user");
    if (switchUser) {
      switchUser.addEventListener("click", async function () {
        signOut();
        renderWho();
        setMode("login");
        await render();
      });
    }

    var restart = $("#restart");
    if (restart) {
      restart.addEventListener("click", async function () {
        code = "";
        try {
          var url = new URL(window.location.href);
          url.searchParams.delete("code");
          window.history.replaceState(null, "", url.pathname);
        } catch (cause) {
          /* ignore */
        }
        await render();
      });
    }
  }

  /* ---------------------------------------------------------------- *
   * Boot
   * ---------------------------------------------------------------- */

  var page = document.body.getAttribute("data-page");
  var start = page === "device" ? initDevice : initSite;

  var run = function () {
    Promise.resolve()
      .then(start)
      .catch(function (error) {
        console.error(error);
      });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
