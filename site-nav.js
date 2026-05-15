(function () {
  const mount = document.getElementById("sharedNav");
  if (!mount) return;

  const AUTH_PAUSED = false;
  const activeSection = mount.dataset.active || "";
  let discordSession = null;
  let authChecked = false;
  let authPanelNext = "/?auth=profile";

  const icons = {
    trophy: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 7H4a3 3 0 0 0 3 3M17 7h3a3 3 0 0 1-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 11a4 4 0 1 0-8 0M5 21a7 7 0 0 1 14 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    status: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="m15 9-4 2-2 4 4-2 2-4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 21h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    chevron: `<svg class="igme-nav-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 17 15 12l-5-5M15 12H3M21 5v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    discord: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.194.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5 19 6.6v4.8c0 4.4-2.9 7.2-7 8.1-4.1-.9-7-3.7-7-8.1V6.6l7-3.1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    plane: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    zap: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 10-13h-7l0-7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    adult: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    spark: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.2 6.2l2.8 2.8M15 15l2.8 2.8M17.8 6.2 15 9M9 15l-2.8 2.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`
  };

  const flagTr = `<svg class="igme-flag" viewBox="0 0 36 26" aria-hidden="true"><rect width="36" height="26" fill="#e30a17"/><circle cx="15" cy="13" r="7" fill="#fff"/><circle cx="17.4" cy="13" r="5.5" fill="#e30a17"/><path d="m23.5 9.2 1 2.2 2.4.2-1.8 1.6.5 2.3-2.1-1.2-2.1 1.2.5-2.3-1.8-1.6 2.4-.2 1-2.2Z" fill="#fff"/></svg>`;
  const flagUs = `<svg class="igme-flag" viewBox="0 0 36 26" aria-hidden="true"><rect width="36" height="26" fill="#b22234"/><path d="M0 2h36v2H0zm0 4h36v2H0zm0 4h36v2H0zm0 4h36v2H0zm0 4h36v2H0zm0 4h36v2H0z" fill="#fff"/><rect width="16" height="14" fill="#3c3b6e"/></svg>`;
  const promoText = '🎉 Premium ve Özel Analiz kısa süreliğine %10 indirim almak için "analiz10" kodunu kullanın!';

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[ch]));
  }

  function defaultDiscordAvatar(id) {
    try {
      return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(id) % 5n)}.png`;
    } catch {
      return "https://cdn.discordapp.com/embed/avatars/0.png";
    }
  }

  function getDiscordAvatar(session) {
    return session?.avatar
      ? `https://cdn.discordapp.com/avatars/${session.discord_id}/${session.avatar}.png?size=64`
      : defaultDiscordAvatar(session?.discord_id || "0");
  }

  function safeNext(value) {
    const next = typeof value === "string" && value ? value : "/?auth=profile";
    if (!next.startsWith("/") || next.startsWith("//")) return "/";
    return next.slice(0, 240);
  }

  function currentNext() {
    return safeNext(`${location.pathname}${location.search || ""}`);
  }

  function loginNoticeReadKey(session = discordSession) {
    return `igme_discord_login_notice_read:${session?.discord_id || "guest"}`;
  }

  function readCachedSession() {
    try {
      const cached = JSON.parse(localStorage.getItem("igme_discord_cached_session") || "null");
      if (!cached || !cached.discord_id) return null;
      if (Date.now() - Number(cached.cached_at || 0) > 86400000) return null;
      return cached;
    } catch {
      return null;
    }
  }

  function writeCachedSession(session) {
    try {
      if (!session?.discord_id) return;
      localStorage.setItem("igme_discord_cached_session", JSON.stringify({
        discord_id: session.discord_id,
        username: session.username || "",
        global_name: session.global_name || "",
        avatar: session.avatar || "",
        cached_at: Date.now()
      }));
    } catch {}
  }

  function clearCachedSession() {
    try {
      localStorage.removeItem("igme_discord_cached_session");
    } catch {}
  }

  function isLoginNoticeRead(session = discordSession) {
    try {
      return localStorage.getItem(loginNoticeReadKey(session)) === "1";
    } catch {
      return false;
    }
  }

  function markLoginNoticeRead(session = discordSession) {
    try {
      localStorage.setItem(loginNoticeReadKey(session), "1");
    } catch {}
  }

  function closeNavMenus() {
    mount.querySelectorAll(".igme-nav-popover.open").forEach(menu => menu.classList.remove("open"));
    mount.querySelectorAll(".igme-nav-menu-trigger.open").forEach(btn => {
      btn.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function openAuthPanel(next = currentNext(), reason = "profile") {
    if (AUTH_PAUSED) return;
    authPanelNext = safeNext(next);
    closeNavMenus();
    const overlay = document.getElementById("igmeAuthOverlay");
    const panel = document.getElementById("igmeAuthPanel");
    const btn = document.getElementById("igmeAuthLoginBtn");
    const subtitle = document.getElementById("igmeAuthSubtitle");
    if (!overlay || !panel || !btn) return;
    btn.href = `/api/auth/discord?next=${encodeURIComponent(authPanelNext)}`;
    if (subtitle) {
      subtitle.textContent = reason === "discord"
        ? "Discord araması yapmak için hesabınla giriş yap"
        : "Devam etmek için Discord ile giriş yap";
    }
    overlay.classList.add("open");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("auth-panel-open");
  }

  function closeAuthPanel() {
    const overlay = document.getElementById("igmeAuthOverlay");
    const panel = document.getElementById("igmeAuthPanel");
    overlay?.classList.remove("open");
    panel?.classList.remove("open");
    panel?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("auth-panel-open");
  }

  function openSettingsPanel() {
    closeNavMenus();
    document.getElementById("igmeSettingsOverlay")?.classList.add("open");
    document.getElementById("igmeSettingsPanel")?.classList.add("open");
    document.getElementById("igmeSettingsPanel")?.setAttribute("aria-hidden", "false");
    document.getElementById("igmeSettingsBtn")?.classList.add("open");
  }

  function closeSettingsPanel() {
    document.getElementById("igmeSettingsOverlay")?.classList.remove("open");
    document.getElementById("igmeSettingsPanel")?.classList.remove("open");
    document.getElementById("igmeSettingsPanel")?.setAttribute("aria-hidden", "true");
    document.getElementById("igmeSettingsBtn")?.classList.remove("open");
  }

  function renderShell() {
    if (!document.querySelector(".promo-bar")) {
      mount.insertAdjacentHTML("beforebegin", `<div class="promo-bar">${escapeHtml(promoText)}</div>`);
    }

    mount.innerHTML = `
      <header class="igme-shared-topbar">
        <a class="igme-nav-brand" href="/" aria-label="IGME ana sayfa">
          <span class="igme-brand-icon" aria-hidden="true"><img class="igme-brand-logo" src="assets/si.png" alt=""></span>
          <span class="igme-brand-word">IG<span class="igme-brand-accent">ME</span></span>
          <span class="igme-brand-beta">BETA</span>
        </a>

        <nav class="igme-nav-links" aria-label="Ana menü">
          <a class="igme-nav-link ${activeSection === "leaderboard" ? "active" : ""}" href="/leaderboard">
            ${icons.trophy}
            <span>Top 50</span>
          </a>
          <a class="igme-nav-link gold" href="/">
            ${icons.trophy}
            <span>Bakım</span>
          </a>
          <a class="igme-nav-link" href="/">
            ${icons.user}
            <span>Kullanıcı Analizi</span>
          </a>
          <a class="igme-nav-link" href="/">
            ${icons.status}
            <span>Sistem Durumu</span>
          </a>
        </nav>

        <div class="igme-nav-right">
          <div id="igmeNavAuthArea"></div>
          <button class="igme-nav-settings-btn" id="igmeSettingsBtn" type="button" aria-label="Site Ayarları" aria-expanded="false">
            ${icons.settings}
          </button>
        </div>
      </header>

      <div class="igme-shared-overlay" id="igmeAuthOverlay"></div>
      <section class="igme-auth-panel" id="igmeAuthPanel" role="dialog" aria-label="Discord ile giriş" aria-modal="true" aria-hidden="true">
        <a class="igme-auth-back" href="/" data-auth-close>&lsaquo; Ana Sayfa</a>
        <div class="igme-auth-icon">${icons.discord}</div>
        <h2>Hoş Geldin</h2>
        <p id="igmeAuthSubtitle">Devam etmek için Discord ile giriş yap</p>
        <a class="igme-discord-login-btn" id="igmeAuthLoginBtn" href="/api/auth/discord?next=%2F%3Fauth%3Dprofile">
          ${icons.discord}
          Discord ile Giriş Yap
        </a>
        <div class="igme-auth-sep">Neden giriş yapmalısın?</div>
        <div class="igme-auth-benefit"><span>${icons.shield}</span> Hızlı ve güvenli giriş</div>
        <div class="igme-auth-benefit"><span>${icons.plane}</span> Sunuculara doğrudan katılım</div>
        <div class="igme-auth-benefit"><span>${icons.zap}</span> Enerji ile toplulukları destekle</div>
      </section>

      <div class="igme-shared-overlay" id="igmeSettingsOverlay"></div>
      <section class="igme-settings-panel" id="igmeSettingsPanel" role="dialog" aria-label="Site Ayarları" aria-modal="true" aria-hidden="true">
        <div class="igme-settings-header">${icons.settings}<span>Site Ayarları</span></div>
        <div class="igme-settings-body">
          <div class="igme-settings-label">DİL SEÇİMİ</div>
          <div class="igme-lang-grid">
            <button class="igme-lang-btn active" type="button">${flagTr} TR Türkçe</button>
            <button class="igme-lang-btn" type="button">${flagUs} US English</button>
          </div>
          <div class="igme-settings-label">AYARLAR</div>
          <div class="igme-setting-row">
            <span class="igme-setting-icon">${icons.adult}</span>
            <span><span class="igme-setting-title">+18 İçerik</span><span class="igme-setting-sub">+18 sunucuları ve içerikleri göster</span></span>
            <button class="igme-switch" id="igmeAdultToggle" type="button" role="switch" aria-checked="false"></button>
          </div>
          <div class="igme-setting-row">
            <span class="igme-setting-icon">${icons.spark}</span>
            <span><span class="igme-setting-title">Lazer Efekti</span><span class="igme-setting-sub">Mouse imlecini takip eden efekt</span></span>
            <button class="igme-switch" id="igmeLaserToggle" type="button" role="switch" aria-checked="false"></button>
          </div>
        </div>
        <div class="igme-settings-foot">IGME v1.0.0 © 2026</div>
      </section>
    `;
  }

  function renderLoggedOut() {
    const authArea = document.getElementById("igmeNavAuthArea");
    if (!authArea) return;
    authArea.innerHTML = `
      <button class="igme-discord-login-btn" type="button" data-auth-open data-auth-next="${escapeHtml(currentNext())}" data-auth-reason="profile">
        ${icons.discord}
        Discord
      </button>
    `;
  }

  function renderAuthPending() {
    const authArea = document.getElementById("igmeNavAuthArea");
    if (!authArea) return;
    authArea.innerHTML = `
      <div class="igme-nav-session-actions igme-nav-auth-pending" aria-hidden="true">
        <span class="igme-nav-icon-btn">${icons.bell}</span>
        <span class="igme-nav-profile-btn">
          <span class="igme-nav-user-avatar"></span>
          <span class="igme-nav-user-name">Profil</span>
          ${icons.chevron}
        </span>
      </div>
    `;
  }

  function renderLoggedIn(session) {
    const authArea = document.getElementById("igmeNavAuthArea");
    if (!authArea) return;
    const displayName = escapeHtml(session.global_name || session.username || "Profil");
    const avatar = escapeHtml(getDiscordAvatar(session));
    const unread = !isLoginNoticeRead(session);
    authArea.innerHTML = `
      <div class="igme-nav-session-actions">
        <div class="igme-nav-menu-wrap">
          <button class="igme-nav-icon-btn igme-nav-menu-trigger" id="igmeNotificationBtn" type="button" aria-label="Bildirimler" aria-expanded="false" data-menu-target="igmeNotificationMenu">
            ${icons.bell}
            ${unread ? '<span class="igme-nav-status-dot">1</span>' : ""}
          </button>
          <div class="igme-nav-popover igme-notification-menu" id="igmeNotificationMenu">
            <div class="igme-notification-head">
              <strong>Bildirimler</strong>
              <button type="button" data-mark-notifications>Okundu işaretle</button>
            </div>
            <div class="igme-notification-item">
              <span class="igme-notification-icon">i</span>
              <span class="igme-notification-copy">
                <strong>50 DSC hesabına tanımlandı. Hoş geldin bonusu hazır.</strong>
                <span>1 ay önce</span>
              </span>
            </div>
            <div class="igme-notification-foot">
              <a href="/" aria-label="Tüm bildirimleri görüntüle">Tüm bildirimleri görüntüle</a>
            </div>
          </div>
        </div>

        <div class="igme-nav-menu-wrap">
          <button class="igme-nav-profile-btn igme-nav-menu-trigger" id="igmeProfileBtn" type="button" aria-label="Profil menüsü" aria-expanded="false" data-menu-target="igmeProfileMenu">
            <img class="igme-nav-user-avatar" src="${avatar}" alt="" referrerpolicy="no-referrer">
            <span class="igme-nav-user-name">${displayName}</span>
            ${icons.chevron}
          </button>
          <div class="igme-nav-popover igme-profile-menu" id="igmeProfileMenu">
            <a class="igme-profile-menu-row" href="/discord-profile?id=${encodeURIComponent(session.discord_id || "")}">${icons.user} Profilim</a>
            <button class="igme-profile-menu-row" type="button" data-open-settings>${icons.settings} Ayarlar</button>
            <a class="igme-profile-menu-row red" href="/api/auth/logout">${icons.logout} Çıkış Yap</a>
          </div>
        </div>
      </div>
    `;
  }

  function renderAuth() {
    if (!authChecked) {
      renderAuthPending();
      return;
    }
    if (!discordSession) {
      renderLoggedOut();
      return;
    }
    renderLoggedIn(discordSession);
  }

  async function refreshSession() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store", headers: { Accept: "application/json" } });
      const data = await res.json().catch(() => ({}));
      authChecked = true;
      discordSession = data?.loggedIn ? data.user : null;
      if (discordSession) writeCachedSession(discordSession);
      else clearCachedSession();
    } catch {
      authChecked = true;
      discordSession = null;
      clearCachedSession();
    }
    renderAuth();
  }

  function applySwitchState(button, enabled) {
    button?.classList.toggle("on", Boolean(enabled));
    button?.setAttribute("aria-checked", enabled ? "true" : "false");
  }

  function initSettingsState() {
    let adult = false;
    let laser = false;
    try {
      adult = localStorage.getItem("igme_adult_content") === "1";
      laser = localStorage.getItem("igme_laser_effect") === "1";
    } catch {}
    document.body.classList.toggle("igme-laser-on", laser);
    applySwitchState(document.getElementById("igmeAdultToggle"), adult);
    applySwitchState(document.getElementById("igmeLaserToggle"), laser);
  }

  function syncHomeAuthQuery() {
    const url = new URL(location.href);
    const auth = url.searchParams.get("auth") || url.searchParams.get("reason");
    if (auth !== "discord") return;
    const next = safeNext(url.searchParams.get("next") || "/?auth=profile");
    window.setTimeout(() => openAuthPanel(next, "discord"), 0);
    url.searchParams.delete("auth");
    url.searchParams.delete("reason");
    url.searchParams.delete("next");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  mount.addEventListener("click", event => {
    if (event.target.closest('a[href="/api/auth/logout"]')) {
      clearCachedSession();
      return;
    }

    const authTrigger = event.target.closest("[data-auth-open]");
    if (authTrigger) {
      event.preventDefault();
      openAuthPanel(authTrigger.dataset.authNext || currentNext(), authTrigger.dataset.authReason || "profile");
      return;
    }

    const authClose = event.target.closest("[data-auth-close]");
    if (authClose) {
      event.preventDefault();
      closeAuthPanel();
      return;
    }

    const menuTrigger = event.target.closest(".igme-nav-menu-trigger");
    if (menuTrigger) {
      event.preventDefault();
      const targetId = menuTrigger.dataset.menuTarget;
      const menu = targetId ? document.getElementById(targetId) : null;
      const shouldOpen = !menu?.classList.contains("open");
      closeNavMenus();
      if (menu && shouldOpen) {
        menu.classList.add("open");
        menuTrigger.classList.add("open");
        menuTrigger.setAttribute("aria-expanded", "true");
        if (targetId === "igmeNotificationMenu") {
          markLoginNoticeRead();
          renderAuth();
          const reopened = document.getElementById("igmeNotificationMenu");
          const reopenedBtn = document.getElementById("igmeNotificationBtn");
          reopened?.classList.add("open");
          reopenedBtn?.classList.add("open");
          reopenedBtn?.setAttribute("aria-expanded", "true");
        }
      }
      return;
    }

    if (event.target.closest("[data-mark-notifications]")) {
      event.preventDefault();
      markLoginNoticeRead();
      renderAuth();
      return;
    }

    if (event.target.closest("[data-open-settings]")) {
      event.preventDefault();
      openSettingsPanel();
      return;
    }

    if (event.target.closest("#igmeSettingsBtn")) {
      event.preventDefault();
      openSettingsPanel();
      return;
    }

    const adultToggle = event.target.closest("#igmeAdultToggle");
    if (adultToggle) {
      const next = !adultToggle.classList.contains("on");
      try { localStorage.setItem("igme_adult_content", next ? "1" : "0"); } catch {}
      applySwitchState(adultToggle, next);
      return;
    }

    const laserToggle = event.target.closest("#igmeLaserToggle");
    if (laserToggle) {
      const next = !laserToggle.classList.contains("on");
      try { localStorage.setItem("igme_laser_effect", next ? "1" : "0"); } catch {}
      document.body.classList.toggle("igme-laser-on", next);
      applySwitchState(laserToggle, next);
    }
  });

  document.addEventListener("click", event => {
    if (!event.target.closest("#sharedNav")) closeNavMenus();
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    closeNavMenus();
    closeAuthPanel();
    closeSettingsPanel();
  });

  window.addEventListener("storage", event => {
    if (event.key?.startsWith("igme_discord_login_notice_read")) renderAuth();
  });

  window.IGME_OPEN_AUTH_PANEL = openAuthPanel;

  renderShell();
  initSettingsState();
  const cachedSession = readCachedSession();
  if (cachedSession) {
    discordSession = cachedSession;
    authChecked = true;
  }
  renderAuth();
  refreshSession();
  syncHomeAuthQuery();

  document.getElementById("igmeAuthOverlay")?.addEventListener("click", closeAuthPanel);
  document.getElementById("igmeSettingsOverlay")?.addEventListener("click", closeSettingsPanel);
})();
