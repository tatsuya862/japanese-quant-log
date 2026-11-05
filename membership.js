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

const contactForm = document.querySelector("#contact-form");
contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(contactForm);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const subject = encodeURIComponent("Quant Logへのお問い合わせ");
  const body = encodeURIComponent(
    `お名前：${name}\n返信先メールアドレス：${email}\n\nお問い合わせ内容：\n${message}`,
  );

  window.location.href = `mailto:quantlog.tatsuya@gmail.com?subject=${subject}&body=${body}`;
});
