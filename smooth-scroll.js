(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");

  if (reduceMotion.matches || coarsePointer.matches) {
    return;
  }

  const scrollableSelector = [
    "textarea",
    "select",
    "[data-native-scroll]",
    ".recent-card",
    ".modal",
    ".dropdown",
  ].join(",");

  let targetY = window.scrollY;
  let frame = null;

  function maxScrollY() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function wheelPixels(event) {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      return event.deltaY * 18;
    }

    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      return event.deltaY * window.innerHeight;
    }

    return event.deltaY;
  }

  function canScrollInside(element, delta) {
    if (!(element instanceof Element)) {
      return false;
    }

    const container = element.closest(scrollableSelector);

    if (!container) {
      return false;
    }

    const style = window.getComputedStyle(container);
    const canOverflow = /(auto|scroll)/.test(style.overflowY);

    if (!canOverflow || container.scrollHeight <= container.clientHeight) {
      return false;
    }

    if (delta > 0) {
      return container.scrollTop + container.clientHeight < container.scrollHeight;
    }

    return container.scrollTop > 0;
  }

  function animate() {
    const currentY = window.scrollY;
    const distance = targetY - currentY;

    if (Math.abs(distance) < 0.6) {
      window.scrollTo(0, targetY);
      frame = null;
      return;
    }

    window.scrollTo(0, currentY + distance * 0.16);
    frame = window.requestAnimationFrame(animate);
  }

  window.addEventListener("wheel", function (event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    const delta = wheelPixels(event);

    if (!delta || canScrollInside(event.target, delta)) {
      return;
    }

    event.preventDefault();
    targetY = clamp(targetY + delta, 0, maxScrollY());

    if (!frame) {
      frame = window.requestAnimationFrame(animate);
    }
  }, { passive: false });

  window.addEventListener("scroll", function () {
    if (!frame) {
      targetY = window.scrollY;
    }
  }, { passive: true });
})();
