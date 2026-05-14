(function () {
  const storageKey = "igme_cookie_consent";

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
      return;
    }
    callback();
  }

  onReady(function () {
    if (localStorage.getItem(storageKey)) return;

    const consent = document.createElement("section");
    consent.className = "cookie-consent";
    consent.setAttribute("role", "dialog");
    consent.setAttribute("aria-label", "Çerez bilgilendirmesi");
    consent.innerHTML = `
      <span class="cookie-consent__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M18.5 12.2A6.5 6.5 0 1 1 11.8 5.5c.1 2.4 1.6 3.9 4.1 4.1.2 1.3 1 2.2 2.6 2.6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          <circle cx="9" cy="10" r="1" fill="currentColor"/>
          <circle cx="11.5" cy="15" r="1" fill="currentColor"/>
          <circle cx="14.5" cy="12.8" r="1" fill="currentColor"/>
        </svg>
      </span>
      <div>
        <p class="cookie-consent__text">
          Bu site deneyimi iyileştirmek ve reklam/analitik süreçlerini yürütmek için çerezler kullanır.
          Detaylar için <a href="gizlilik-politikasi.html">Gizlilik Politikasını</a> inceleyebilirsiniz.
        </p>
        <div class="cookie-consent__actions">
          <button class="cookie-consent__button reject" type="button" data-cookie-choice="rejected">Reddet</button>
          <button class="cookie-consent__button accept" type="button" data-cookie-choice="accepted">Kabul Et</button>
        </div>
      </div>
    `;

    document.body.appendChild(consent);
    requestAnimationFrame(function () {
      consent.classList.add("is-visible");
    });

    consent.querySelectorAll("[data-cookie-choice]").forEach(function (button) {
      button.addEventListener("click", function () {
        localStorage.setItem(storageKey, button.getAttribute("data-cookie-choice") || "dismissed");
        consent.classList.remove("is-visible");
        window.setTimeout(function () {
          consent.remove();
        }, 200);
      });
    });
  });
})();
