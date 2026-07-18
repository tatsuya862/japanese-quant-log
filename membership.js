const CONTACT_EMAIL = "quantlog.support@gmail.com";

document.querySelectorAll("[data-contact-email]").forEach((node) => {
  node.textContent = CONTACT_EMAIL;
});

document.querySelectorAll("[data-contact-mailto]").forEach((node) => {
  node.setAttribute("href", `mailto:${CONTACT_EMAIL}`);
  if (!node.textContent.trim() || node.textContent.includes("@")) {
    node.textContent = CONTACT_EMAIL;
  }
});

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

document.querySelectorAll("[data-contact-form]").forEach((form) => {
  const messageNode = form.querySelector("[data-contact-form-message]");

  function setContactMessage(message, type = "info") {
    if (!messageNode) return;
    messageNode.textContent = message;
    messageNode.dataset.state = type;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const topic = String(formData.get("topic") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const detail = String(formData.get("message") || "").trim();

    if (!topic || !name || !email || !detail) {
      setContactMessage("未入力の項目があります。内容を確認してください。", "error");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setContactMessage("返信先メールアドレスの形式を確認してください。", "error");
      return;
    }

    const subject = `Quant Log お問い合わせ: ${topic}`;
    const body = [
      "Quant Log お問い合わせ",
      "",
      `お問い合わせ内容: ${topic}`,
      `お名前: ${name}`,
      `返信先メールアドレス: ${email}`,
      "",
      "お問い合わせの詳細:",
      detail
    ].join("\n");

    setContactMessage("メールアプリを開きます。送信前に内容をご確認ください。", "success");
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
});
