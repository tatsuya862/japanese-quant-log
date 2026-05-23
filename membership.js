const CONTACT_EMAIL = "quantlog.support@gmail.com";
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/28E00c4Bm8tra5Q1Fw2wU03";

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

function startCheckout() {
  const buttons = document.querySelectorAll("[data-checkout-button]");
  buttons.forEach((item) => {
    item.dataset.originalText = item.dataset.originalText || item.textContent;
    item.disabled = true;
    item.textContent = "決済ページを準備中...";
  });
  setCheckoutMessage("", "info");

  if (typeof window.gtag === "function") {
    window.gtag("event", "begin_checkout", {
      item_name: "Quant Log Paid Membership",
      value: 275,
      currency: "JPY"
    });
  }
  window.location.href = STRIPE_PAYMENT_LINK;
}

document.querySelectorAll("[data-checkout-button]").forEach((button) => {
  button.addEventListener("click", () => startCheckout(button));
});
