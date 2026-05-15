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

function setCheckoutMessage(message, type = "info") {
  document.querySelectorAll("[data-checkout-message]").forEach((node) => {
    node.textContent = message;
    node.dataset.state = type;
  });
}

async function startCheckout(button) {
  const buttons = document.querySelectorAll("[data-checkout-button]");
  buttons.forEach((item) => {
    item.dataset.originalText = item.dataset.originalText || item.textContent;
    item.disabled = true;
    item.textContent = "決済ページを準備中...";
  });
  setCheckoutMessage("", "info");

  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: window.location.pathname })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) {
      throw new Error(data.error || "決済ページを準備できませんでした。");
    }
    if (typeof window.gtag === "function") {
      window.gtag("event", "begin_checkout", {
        item_name: "Quant Log Paid Membership",
        value: 250,
        currency: "JPY"
      });
    }
    window.location.href = data.url;
  } catch (error) {
    setCheckoutMessage(
      `現在、決済ページを開けません。時間をおいて再試行するか、${CONTACT_EMAIL} へお問い合わせください。`,
      "error"
    );
    buttons.forEach((item) => {
      item.disabled = false;
      item.textContent = item.dataset.originalText || "月額メンバー登録へ進む";
    });
  }
}

document.querySelectorAll("[data-checkout-button]").forEach((button) => {
  button.addEventListener("click", () => startCheckout(button));
});
