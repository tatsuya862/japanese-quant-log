const menuToggle = document.querySelector(".menu-toggle");
menuToggle?.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!expanded));
  document.body.classList.toggle("menu-open", !expanded);
});

document.querySelectorAll(".site-header nav a").forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  });
});

document.querySelectorAll("[data-ga4-event]").forEach((link) => {
  link.addEventListener("click", () => {
    if (typeof window.gtag !== "function") return;

    window.gtag("event", link.dataset.ga4Event, {
      cta_label: link.dataset.ctaLabel || "",
      link_url: link.href || "",
    });
  });
});
