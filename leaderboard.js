(function () {
  const metrics = [
    {
      id: "realVoice",
      label: "Gerçek Ses",
      accent: "#3b82f6",
      icon: "user-check",
      short: "Gerçek"
    },
    {
      id: "totalVoice",
      label: "Total Ses",
      accent: "#8b5cf6",
      icon: "headphones",
      short: "Total"
    },
    {
      id: "voice",
      label: "Ses",
      accent: "#38bdf8",
      icon: "mic",
      short: "Ses"
    },
    {
      id: "members",
      label: "Üyeler",
      accent: "#a78bfa",
      icon: "users",
      short: "Üye"
    },
    {
      id: "boosts",
      label: "Takviye",
      accent: "#f472b6",
      icon: "diamond",
      short: "Boost"
    },
    {
      id: "camera",
      label: "Kamera",
      accent: "#e879f9",
      icon: "video",
      short: "Kamera"
    },
    {
      id: "stream",
      label: "Yayın",
      accent: "#60a5fa",
      icon: "monitor",
      short: "Yayın"
    }
  ];

  const servers = [
    {
      name: "† Dark Paradise",
      icon: "DP",
      rankStyle: "crown-gold",
      members: 191282,
      boosts: 768,
      totalVoice: 349,
      realVoice: 238,
      voice: 132,
      muted: 106,
      bots: 111,
      stream: 32,
      camera: 9,
      bg: "linear-gradient(90deg, rgba(0, 0, 0, .94), rgba(0, 0, 0, .86) 44%, rgba(0, 0, 0, .74)), url('assets/leaderboard/dark-paradise.webp') center/cover no-repeat, linear-gradient(120deg, #11142a, #050505)"
    },
    {
      name: "M E Y H A N E",
      icon: "MY",
      rankStyle: "crown-white",
      members: 101293,
      boosts: 567,
      totalVoice: 313,
      realVoice: 214,
      voice: 94,
      muted: 120,
      bots: 99,
      stream: 22,
      camera: 11,
      bg: "linear-gradient(90deg, rgba(0, 0, 0, .94), rgba(0, 0, 0, .84) 44%, rgba(0, 0, 0, .7)), url('assets/leaderboard/meyhane.webp') center/cover no-repeat, linear-gradient(115deg, #351414, #050505)"
    },
    {
      name: "R E F E R A N S #DGKO CRASH",
      icon: "RF",
      rankStyle: "crown-orange",
      members: 11193,
      boosts: 43,
      totalVoice: 181,
      realVoice: 148,
      voice: 96,
      muted: 52,
      bots: 33,
      stream: 10,
      camera: 2,
      bg: "linear-gradient(90deg, rgba(0, 0, 0, .94), rgba(0, 0, 0, .84) 44%, rgba(0, 0, 0, .7)), url('assets/leaderboard/referans.webp') center/cover no-repeat, linear-gradient(110deg, #0b1b22, #050505)"
    },
    {
      name: "☆ S H A N N A R A",
      icon: "SH",
      rankStyle: "rank-number",
      members: 154164,
      boosts: 354,
      totalVoice: 112,
      realVoice: 112,
      voice: 79,
      muted: 33,
      bots: 0,
      stream: 15,
      camera: 16,
      bg: "linear-gradient(90deg, rgba(0, 0, 0, .94), rgba(0, 0, 0, .84) 44%, rgba(0, 0, 0, .7)), url('assets/leaderboard/shannara.webp') center/cover no-repeat, linear-gradient(120deg, #071723, #050505)"
    },
    {
      name: "† M O N A R C H",
      icon: "MN",
      rankStyle: "rank-number",
      members: 93900,
      boosts: 308,
      totalVoice: 139,
      realVoice: 86,
      voice: 56,
      muted: 30,
      bots: 53,
      stream: 14,
      camera: 2,
      bg: "linear-gradient(90deg, rgba(0, 0, 0, .94), rgba(0, 0, 0, .84) 44%, rgba(0, 0, 0, .7)), url('assets/leaderboard/monarch.webp') center/cover no-repeat, linear-gradient(125deg, #181818, #050505)"
    },
    {
      name: "A L E N O R #ENLER",
      icon: "AL",
      rankStyle: "rank-number",
      members: 86420,
      boosts: 242,
      totalVoice: 129,
      realVoice: 77,
      voice: 64,
      muted: 18,
      bots: 41,
      stream: 8,
      camera: 4,
      bg: "linear-gradient(90deg, rgba(0, 0, 0, .94), rgba(0, 0, 0, .84) 44%, rgba(0, 0, 0, .7)), url('assets/leaderboard/alenor.webp') center/cover no-repeat, linear-gradient(120deg, #1e1710, #050505)"
    }
  ];

  const icons = {
    trophy: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 7H4a3 3 0 0 0 3 3M17 7h3a3 3 0 0 1-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.2a4 4 0 0 1 0 7.6M22 21v-2a4 4 0 0 0-3-3.8M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    compass: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="m15.5 8.5-2.1 5a1.5 1.5 0 0 1-.9.9l-5 2.1 2.1-5a1.5 1.5 0 0 1 .9-.9l5-2.1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 17 9 11l4 4 8-8M15 7h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "user-check": '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m16 11 2 2 4-4M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    headphones: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    diamond: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 21 9l-9 12L3 9l9-6Z"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="7" width="13" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="m16 11 5-3v8l-5-3" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    monitor: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 21h8M12 16v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    bot: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="8" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M12 8V4M9 12h.01M15 12h.01M8 20h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    muted: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 18v3M19 11v1a7 7 0 0 1-10.6 6M5 11v1a7 7 0 0 0 1.2 3.9M9 5.8A3 3 0 0 1 15 7v4a3 3 0 0 1-.2 1M3 3l18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  let activeMetric = "realVoice";

  function formatNumber(value) {
    return new Intl.NumberFormat("tr-TR").format(value || 0);
  }

  function metricById(id) {
    return metrics.find(metric => metric.id === id) || metrics[0];
  }

  function renderMetricButtons() {
    const wrap = document.getElementById("leaderMetricButtons");
    if (!wrap) return;
    wrap.innerHTML = metrics.map(metric => `
      <button class="leader-filter ${metric.id === activeMetric ? "active" : ""}" type="button" data-metric="${metric.id}" style="--metric-color:${metric.accent}">
        <span class="leader-filter-icon">${icons[metric.icon]}</span>
        <span>${metric.label}</span>
      </button>
    `).join("");
  }

  function renderRows() {
    const list = document.getElementById("leaderRows");
    if (!list) return;
    const metric = metricById(activeMetric);
    const sorted = [...servers].sort((a, b) => (b[activeMetric] || 0) - (a[activeMetric] || 0));
    list.innerHTML = sorted.map((server, index) => rowTemplate(server, index + 1, metric)).join("");
  }

  function rankTemplate(rank, server) {
    if (server.rankStyle && server.rankStyle.startsWith("crown")) {
      return `<span class="leader-crown ${server.rankStyle}" aria-label="${rank}. sira"></span>`;
    }
    return `<span class="leader-rank-number">#${rank}</span>`;
  }

  function rowTemplate(server, rank, metric) {
    return `
      <article class="leader-row" style="--row-bg:${server.bg}; --metric-color:${metric.accent}">
        <a class="leader-row-link" href="/discord-profile?q=${encodeURIComponent(server.name)}" aria-label="${server.name} profilini ac">
          <div class="leader-row-bg"></div>
          <div class="leader-row-main">
            <div class="leader-rank">${rankTemplate(rank, server)}</div>
            <div class="leader-icon">${server.icon}</div>
            <div class="leader-info">
              <div class="leader-name-line">
                <h2>${server.name}</h2>
                <span class="leader-open">${icons.external}</span>
              </div>
              <div class="leader-stats" aria-label="Sunucu istatistikleri">
                <span>${icons.users}${formatNumber(server.members)}</span>
                <span class="boost">${icons.diamond}${formatNumber(server.boosts)}</span>
                <span>${icons.headphones}${formatNumber(server.totalVoice)}</span>
                <span>${icons["user-check"]}${formatNumber(server.realVoice)}</span>
                <span>${icons.mic}${formatNumber(server.voice)}</span>
                <span class="danger">${icons.muted}${formatNumber(server.muted)}</span>
                <span class="danger">${icons.bot}${formatNumber(server.bots)}</span>
                <span>${icons.monitor}${formatNumber(server.stream)}</span>
                <span>${icons.video}${formatNumber(server.camera)}</span>
              </div>
            </div>
            <div class="leader-focus-stat">
              <span>${metric.label}</span>
              <strong>${formatNumber(server[metric.id])}</strong>
            </div>
          </div>
        </a>
      </article>
    `;
  }

  function wireFilters() {
    document.getElementById("leaderMetricButtons")?.addEventListener("click", event => {
      const button = event.target.closest("[data-metric]");
      if (!button) return;
      activeMetric = button.dataset.metric || "realVoice";
      renderMetricButtons();
      renderRows();
    });
  }

  function startCountdown() {
    const target = document.getElementById("leaderCountdown");
    if (!target) return;
    let value = 1;
    window.setInterval(() => {
      value = value <= 1 ? 30 : value - 1;
      target.textContent = `${value} saniye sonra güncelleme`;
    }, 1000);
  }

  function wireSponsor() {
    document.getElementById("leaderSponsorClose")?.addEventListener("click", () => {
      document.querySelector(".leader-sponsor")?.classList.add("hidden");
    });
  }

  renderMetricButtons();
  renderRows();
  wireFilters();
  startCountdown();
  wireSponsor();
})();
