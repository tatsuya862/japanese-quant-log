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

  const recipient = "quantlog.tatsuya@gmail.com";
  const mailto = `mailto:${recipient}?subject=${subject}&body=${body}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}&body=${body}`;
  const status = contactForm.querySelector("#contact-status");

  if (event.submitter?.value === "mail-app") {
    window.location.href = mailto;
    if (status) status.textContent = "メールアプリが開かない場合は、Gmailかコピーをお使いください。";
    return;
  }

  window.location.href = gmail;
});

contactForm?.querySelector("#copy-contact")?.addEventListener("click", async () => {
  if (!contactForm.reportValidity()) return;
  const formData = new FormData(contactForm);
  const text = `宛先：quantlog.tatsuya@gmail.com\n件名：Quant Logへのお問い合わせ\n\nお名前：${String(formData.get("name") || "").trim()}\n返信先メールアドレス：${String(formData.get("email") || "").trim()}\n\nお問い合わせ内容：\n${String(formData.get("message") || "").trim()}`;
  const status = contactForm.querySelector("#contact-status");
  try {
    await navigator.clipboard.writeText(text);
    if (status) status.textContent = "宛先と本文をコピーしました。普段お使いのメールから送信してください。";
  } catch {
    if (status) status.textContent = "コピーできませんでした。下のメールアドレスへ直接送信してください。";
  }
});
