const APP_NAME = "QUANT LOG by Tatsuya";
const SESSION_COOKIE = "ql_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
const SESSION_IDLE_SECONDS = 60 * 60 * 2;
const TOKEN_TTL_MINUTES = 60;
const RESET_TTL_MINUTES = 30;
const CSRF_TTL_MINUTES = 120;
const PASSWORD_ITERATIONS = 310000;
const MAX_PASSWORD_LENGTH = 1024;

const AUTH_PATHS = new Set([
  "/register",
  "/login",
  "/logout",
  "/account",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/resend-verification",
  "/terms",
  "/privacy",
  "/contact"
]);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!AUTH_PATHS.has(url.pathname)) {
    return context.next();
  }

  if (String(env.PUBLIC_AUTH_ENABLED || "").toLowerCase() !== "true") {
    return publicMembershipRoute(request, url);
  }

  try {
    assertEnv(env);
    await ensureSchema(env.AUTH_DB);
    return await route(request, env, url);
  } catch (error) {
    console.error("auth_error", error && error.name ? error.name : "Error");
    return htmlPage("エラー", `
      <section class="panel">
        <h1>処理を完了できませんでした</h1>
        <p>時間をおいて再度お試しください。</p>
      </section>
    `, { status: 500 });
  }
}

function publicMembershipRoute(request, url) {
  const authUiPaths = new Set([
    "/register",
    "/login",
    "/account",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/resend-verification",
    "/logout"
  ]);

  if (authUiPaths.has(url.pathname)) return publicMembershipNotice();
  if (url.pathname === "/terms") return publicTermsPage();
  if (url.pathname === "/privacy") return publicPrivacyPage();
  if (url.pathname === "/contact") return publicContactPage();
  return htmlPage("Not Found", `<section class="panel"><h1>ページが見つかりません</h1></section>`, { status: 404 });
}

function publicMembershipNotice() {
  return htmlPage("会員機能の需要確認", `
    <section class="panel wide">
      <p class="eyebrow">Membership Interest</p>
      <h1>会員機能は需要確認段階です</h1>
      <p>現在の公開環境では、本物の無料登録・ログイン処理は提供していません。</p>
      <p>メールアドレス、ユーザー名、パスワードなどの個人情報は入力不要です。登録フォーム、ログインフォーム、DB保存は公開していません。</p>
      <p>将来的にニーズが確認できた場合、安全な無料登録機能の提供を検討します。有料プランやサブスクリプションを開始する場合は、料金、サービス内容、支払条件、解約方法を事前に明示し、ユーザーの同意なく自動的に課金へ移行することはありません。</p>
      <div class="actions">
        <a class="btn primary" href="/register-interest.html">会員機能の需要確認を見る</a>
        <a class="btn ghost" href="/index.html">トップページへ戻る</a>
      </div>
    </section>
  `);
}

function publicTermsPage() {
  return htmlPage("利用規約", `
    <section class="panel wide">
      <p class="eyebrow">Terms</p>
      <h1>利用規約</h1>
      <p>会員機能については、現在、無料会員登録に向けた需要確認段階です。現時点では、メールアドレス、ユーザー名、パスワードなどの個人情報は収集していません。</p>
      <p>将来的にニーズが確認できた場合、安全な無料登録機能の提供を検討します。有料プランやサブスクリプションを開始する場合は、料金、サービス内容、支払条件、解約方法を事前に明示し、ユーザーの同意なく自動的に課金へ移行することはありません。</p>
      <p><a href="/contact">問い合わせ・通報窓口</a>をご利用ください。</p>
    </section>
  `);
}

function publicPrivacyPage() {
  return htmlPage("プライバシーポリシー", `
    <section class="panel wide">
      <p class="eyebrow">Privacy</p>
      <h1>プライバシーポリシー</h1>
      <p>現在の公開環境では、本物の登録・ログイン機能を提供していません。そのため、メールアドレス、ユーザー名、パスワード、パスワードハッシュ、アカウント情報は収集していません。</p>
      <p>会員機能については、将来的な無料機能候補の需要確認を目的として、静的な案内ページを公開しています。</p>
      <p>正式な問い合わせ窓口は準備中です。公開時には、個人情報やアカウントに関する連絡先を明確に表示します。</p>
    </section>
  `);
}

function publicContactPage() {
  return htmlPage("問い合わせ・通報", `
    <section class="panel wide">
      <p class="eyebrow">Contact</p>
      <h1>問い合わせ・通報</h1>
      <p>個人情報、アカウント、削除依頼、不正利用に関するお問い合わせは、正式な問い合わせ窓口からご連絡ください。</p>
      <p>正式な問い合わせ窓口は準備中です。公開時には、個人情報やアカウントに関する連絡先を明確に表示します。</p>
      <ul>
        <li>サイト全般</li>
        <li>会員機能に関する問い合わせ</li>
        <li>個人情報に関する問い合わせ</li>
        <li>削除依頼</li>
        <li>不正利用・なりすまし・誹謗中傷の通報</li>
      </ul>
    </section>
  `);
}

function assertEnv(env) {
  if (!env.AUTH_DB) {
    throw new Error("AUTH_DB binding is required.");
  }
}

async function route(request, env, url) {
  const method = request.method.toUpperCase();
  if (url.pathname === "/register" && method === "GET") return registerPage(env, request);
  if (url.pathname === "/register" && method === "POST") return registerUser(env, request);
  if (url.pathname === "/verify-email" && method === "GET") return verifyEmail(env, url);
  if (url.pathname === "/login" && method === "GET") return loginPage(env, request);
  if (url.pathname === "/login" && method === "POST") return loginUser(env, request);
  if (url.pathname === "/logout" && method === "POST") return logoutUser(env, request);
  if (url.pathname === "/account" && method === "GET") return accountPage(env, request);
  if (url.pathname === "/resend-verification" && method === "POST") return resendVerification(env, request);
  if (url.pathname === "/forgot-password" && method === "GET") return forgotPasswordPage(env, request);
  if (url.pathname === "/forgot-password" && method === "POST") return sendPasswordReset(env, request);
  if (url.pathname === "/reset-password" && method === "GET") return resetPasswordPage(env, request, url);
  if (url.pathname === "/reset-password" && method === "POST") return resetPassword(env, request);
  if (url.pathname === "/terms" && method === "GET") return termsPage();
  if (url.pathname === "/privacy" && method === "GET") return privacyPage();
  if (url.pathname === "/contact" && method === "GET") return contactPage();
  return htmlPage("見つかりません", `<section class="panel"><h1>ページが見つかりません</h1></section>`, { status: 404 });
}

async function ensureSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email_verified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT,
      password_reset_token_hash TEXT,
      password_reset_expires_at TEXT,
      email_verification_token_hash TEXT,
      email_verification_expires_at TEXT,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_login_ip TEXT,
      last_user_agent TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      account_status TEXT NOT NULL DEFAULT 'active',
      membership_status TEXT NOT NULL DEFAULT 'free',
      subscription_status TEXT NOT NULL DEFAULT 'none',
      plan_id TEXT,
      deleted_at TEXT,
      suspended_at TEXT,
      suspension_reason TEXT,
      terms_accepted_at TEXT,
      privacy_policy_accepted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash ON users(email_verification_token_hash);
    CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash ON users(password_reset_token_hash);
    CREATE TABLE IF NOT EXISTS sessions (
      id_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS csrf_tokens (
      token_hash TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      email_hash TEXT,
      event_type TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      metadata TEXT
    );
  `);
}

async function registerPage(env, request, message = "") {
  const csrf = await createCsrf(env.AUTH_DB);
  return htmlPage("無料会員登録", `
    <section class="panel wide">
      <p class="eyebrow">Free Membership</p>
      <h1>無料会員登録</h1>
      <p>クオンツログでは、今後の会員限定コンテンツや新機能の提供に向けて、無料会員登録を受け付けています。</p>
      <p>現在の登録は無料です。有料プランやサブスクリプションを開始する場合は、料金、サービス内容、支払条件、解約方法を事前に明示し、ユーザーの同意なく自動的に課金へ移行することはありません。</p>
      <p>登録には、メールアドレス、パスワード、ニックネームが必要です。氏名、住所、電話番号、生年月日、クレジットカード情報は取得しません。</p>
      ${message}
      <form method="post" action="/register" class="form">
        <input type="hidden" name="csrf" value="${escapeAttr(csrf)}">
        <label>メールアドレス<input required type="email" name="email" autocomplete="email" maxlength="254"></label>
        <label>パスワード<input required type="password" name="password" autocomplete="new-password" minlength="15" maxlength="${MAX_PASSWORD_LENGTH}"></label>
        <p class="help">15文字以上を推奨します。空白、記号、英数字、Unicode文字を使用できます。</p>
        <label>ニックネーム<input required type="text" name="display_name" autocomplete="nickname" maxlength="40"></label>
        <label class="check"><input required type="checkbox" name="accept_terms" value="yes"> <span><a href="/terms">利用規約</a>および<a href="/privacy">プライバシーポリシー</a>に同意して無料登録する</span></label>
        <button class="btn primary" type="submit">無料で会員登録する</button>
      </form>
      <p class="link-row"><a href="/login">ログインはこちら</a></p>
    </section>
  `);
}

async function registerUser(env, request) {
  const form = await safeFormData(request);
  const csrfError = await verifyCsrf(env.AUTH_DB, form.get("csrf"));
  if (csrfError) return registerPage(env, request, errorMessage("入力内容を確認してください。"));

  const email = normalizeEmail(form.get("email"));
  const password = String(form.get("password") || "");
  const displayName = normalizeDisplayName(form.get("display_name"));
  const accepted = form.get("accept_terms") === "yes";
  const ip = clientIp(request);
  const userAgent = truncate(request.headers.get("user-agent") || "", 500);
  const rateLimited = await hitRateLimit(env.AUTH_DB, `register:ip:${ip}`, 5, 30);

  if (rateLimited || !accepted || !isValidEmail(email) || !displayName) {
    return registerPage(env, request, errorMessage("入力内容を確認してください。"));
  }
  if (!isStrongPassword(password, email, displayName)) {
    return registerPage(env, request, errorMessage("このパスワードは推測されやすいため使用できません。より長く、他人が推測しにくいパスワードを設定してください。"));
  }

  const existing = await env.AUTH_DB.prepare("SELECT id, email_verified_at FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    await logEvent(env.AUTH_DB, "registration_duplicate", { userId: existing.id, email, ip, userAgent });
    return neutralMailPage("登録を受け付けました", "入力されたメールアドレス宛に、必要な場合は確認メールを送信します。メールをご確認ください。");
  }

  const now = new Date();
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const verifyToken = randomToken();
  const verifyTokenHash = await hashToken(verifyToken);
  const verifyExpires = addMinutes(now, TOKEN_TTL_MINUTES).toISOString();
  const timestamp = now.toISOString();

  await env.AUTH_DB.prepare(`
    INSERT INTO users (
      id, email, password_hash, display_name, created_at, updated_at,
      email_verification_token_hash, email_verification_expires_at,
      role, account_status, membership_status, subscription_status,
      terms_accepted_at, privacy_policy_accepted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', 'active', 'free', 'none', ?, ?)
  `).bind(userId, email, passwordHash, displayName, timestamp, timestamp, verifyTokenHash, verifyExpires, timestamp, timestamp).run();

  await logEvent(env.AUTH_DB, "registered", { userId, email, ip, userAgent });
  const verifyUrl = new URL(`/verify-email?token=${encodeURIComponent(verifyToken)}`, request.url).toString();
  const mail = await sendMail(env, {
    to: email,
    subject: "QUANT LOG メールアドレス確認",
    text: `QUANT LOGの無料会員登録を完了するには、以下のURLを開いてメールアドレスを確認してください。\n\n${verifyUrl}\n\nこのリンクは${TOKEN_TTL_MINUTES}分で期限切れになります。`
  });

  return neutralMailPage("登録を受け付けました", "入力されたメールアドレス宛に、必要な場合は確認メールを送信します。メールをご確認ください。", mail.devFallback ? verifyUrl : "");
}

async function verifyEmail(env, url) {
  const token = url.searchParams.get("token") || "";
  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();
  const user = await env.AUTH_DB.prepare(`
    SELECT id, email FROM users
    WHERE email_verification_token_hash = ?
      AND email_verification_expires_at > ?
      AND deleted_at IS NULL
  `).bind(tokenHash, now).first();

  if (!user) {
    return htmlPage("メール認証", `<section class="panel"><h1>確認リンクが無効です</h1><p>リンクの期限が切れているか、すでに使用されています。</p><p><a href="/login">ログインへ</a></p></section>`, { status: 400 });
  }

  await env.AUTH_DB.prepare(`
    UPDATE users
    SET email_verified_at = ?, email_verification_token_hash = NULL, email_verification_expires_at = NULL, updated_at = ?
    WHERE id = ?
  `).bind(now, now, user.id).run();
  await logEvent(env.AUTH_DB, "email_verified", { userId: user.id, email: user.email });
  return htmlPage("メール認証完了", `<section class="panel"><h1>メール認証が完了しました</h1><p>無料会員としてログインできます。</p><p><a class="btn primary" href="/login">ログインする</a></p></section>`);
}

async function loginPage(env, request, message = "") {
  const csrf = await createCsrf(env.AUTH_DB);
  return htmlPage("ログイン", `
    <section class="panel">
      <p class="eyebrow">Member Login</p>
      <h1>ログイン</h1>
      ${message}
      <form method="post" action="/login" class="form">
        <input type="hidden" name="csrf" value="${escapeAttr(csrf)}">
        <label>メールアドレス<input required type="email" name="email" autocomplete="email" maxlength="254"></label>
        <label>パスワード<input required type="password" name="password" autocomplete="current-password" maxlength="${MAX_PASSWORD_LENGTH}"></label>
        <button class="btn primary" type="submit">ログインする</button>
      </form>
      <p class="link-row"><a href="/forgot-password">パスワードを忘れた方はこちら</a></p>
      <p class="link-row"><a href="/register">無料会員登録はこちら</a></p>
      <p class="legal-row"><a href="/terms">利用規約</a> / <a href="/privacy">プライバシーポリシー</a></p>
    </section>
  `);
}

async function loginUser(env, request) {
  const form = await safeFormData(request);
  const csrfError = await verifyCsrf(env.AUTH_DB, form.get("csrf"));
  if (csrfError) return loginPage(env, request, errorMessage("入力内容を確認してください。"));

  const email = normalizeEmail(form.get("email"));
  const password = String(form.get("password") || "");
  const ip = clientIp(request);
  const userAgent = truncate(request.headers.get("user-agent") || "", 500);
  const rateLimited = await hitRateLimit(env.AUTH_DB, `login:ip:${ip}`, 10, 15) || await hitRateLimit(env.AUTH_DB, `login:email:${await hashToken(email)}`, 8, 15);
  const generic = errorMessage("メールアドレスまたはパスワードが正しくありません。");

  if (rateLimited || !isValidEmail(email)) {
    await logEvent(env.AUTH_DB, "login_failed", { email, ip, userAgent, metadata: { reason: "limited_or_invalid" } });
    return loginPage(env, request, generic);
  }

  const user = await env.AUTH_DB.prepare(`
    SELECT * FROM users
    WHERE email = ? AND deleted_at IS NULL
  `).bind(email).first();
  const locked = user && user.locked_until && new Date(user.locked_until) > new Date();
  const valid = user && !locked && user.account_status === "active" && await verifyPassword(password, user.password_hash);

  if (!valid) {
    if (user) {
      const failures = Number(user.failed_login_attempts || 0) + 1;
      const lockedUntil = failures >= 5 ? addMinutes(new Date(), 15).toISOString() : null;
      await env.AUTH_DB.prepare("UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?")
        .bind(failures, lockedUntil, new Date().toISOString(), user.id).run();
    }
    await logEvent(env.AUTH_DB, "login_failed", { userId: user && user.id, email, ip, userAgent });
    return loginPage(env, request, generic);
  }

  await env.AUTH_DB.prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ?, last_login_ip = ?, last_user_agent = ?, updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), ip, userAgent, new Date().toISOString(), user.id).run();

  const sessionCookie = await createSession(env.AUTH_DB, user.id, ip, userAgent);
  await logEvent(env.AUTH_DB, "login_success", { userId: user.id, email, ip, userAgent });
  return redirect("/account", sessionCookie);
}

async function logoutUser(env, request) {
  const form = await safeFormData(request);
  const csrfError = await verifyCsrf(env.AUTH_DB, form.get("csrf"));
  if (csrfError) return redirect("/login", clearSessionCookie());
  const sessionToken = getCookie(request, SESSION_COOKIE);
  if (sessionToken) {
    await env.AUTH_DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await hashToken(sessionToken)).run();
  }
  return redirect("/login", clearSessionCookie());
}

async function accountPage(env, request, message = "") {
  const auth = await requireUser(env, request);
  if (!auth.user) return redirect("/login");
  const csrf = await createCsrf(env.AUTH_DB);
  const status = auth.user.email_verified_at ? "認証済み" : "未認証";
  return htmlPage("マイページ", `
    <section class="panel wide">
      <p class="eyebrow">My Page</p>
      <h1>マイページ</h1>
      ${message}
      <dl class="account-list">
        <div><dt>ニックネーム</dt><dd>${escapeHtml(auth.user.display_name)}</dd></div>
        <div><dt>登録メールアドレス</dt><dd>${escapeHtml(auth.user.email)}</dd></div>
        <div><dt>メール認証状態</dt><dd>${status}</dd></div>
        <div><dt>現在の会員ステータス</dt><dd>無料会員</dd></div>
      </dl>
      <p>有料プランやサブスクリプションを開始する場合は、料金、サービス内容、支払条件、解約方法を事前に明示し、ユーザーの同意なく自動的に課金へ移行することはありません。</p>
      ${auth.user.email_verified_at ? "" : `
        <form method="post" action="/resend-verification" class="inline-form">
          <input type="hidden" name="csrf" value="${escapeAttr(csrf)}">
          <button class="btn ghost" type="submit">確認メールを再送する</button>
        </form>
      `}
      <div class="actions">
        <a class="btn ghost" href="/forgot-password">パスワードを再設定する</a>
        <a class="btn ghost" href="/contact">問い合わせ・通報</a>
        <form method="post" action="/logout" class="inline-form">
          <input type="hidden" name="csrf" value="${escapeAttr(csrf)}">
          <button class="btn primary" type="submit">ログアウト</button>
        </form>
      </div>
    </section>
  `);
}

async function resendVerification(env, request) {
  const form = await safeFormData(request);
  const csrfError = await verifyCsrf(env.AUTH_DB, form.get("csrf"));
  const auth = await requireUser(env, request);
  if (csrfError || !auth.user) return redirect("/login");
  if (auth.user.email_verified_at) return accountPage(env, request, successMessage("メールアドレスは認証済みです。"));

  const token = randomToken();
  const tokenHash = await hashToken(token);
  const expires = addMinutes(new Date(), TOKEN_TTL_MINUTES).toISOString();
  await env.AUTH_DB.prepare("UPDATE users SET email_verification_token_hash = ?, email_verification_expires_at = ?, updated_at = ? WHERE id = ?")
    .bind(tokenHash, expires, new Date().toISOString(), auth.user.id).run();
  const verifyUrl = new URL(`/verify-email?token=${encodeURIComponent(token)}`, request.url).toString();
  const mail = await sendMail(env, {
    to: auth.user.email,
    subject: "QUANT LOG メールアドレス確認",
    text: `以下のURLを開いてメールアドレスを確認してください。\n\n${verifyUrl}\n\nこのリンクは${TOKEN_TTL_MINUTES}分で期限切れになります。`
  });
  return accountPage(env, request, successMessage(`確認メールを送信しました。${mail.devFallback ? `<br><a href="${escapeAttr(verifyUrl)}">開発用確認リンク</a>` : ""}`));
}

async function forgotPasswordPage(env, request, message = "") {
  const csrf = await createCsrf(env.AUTH_DB);
  return htmlPage("パスワード再設定", `
    <section class="panel">
      <p class="eyebrow">Password Reset</p>
      <h1>パスワード再設定</h1>
      ${message}
      <form method="post" action="/forgot-password" class="form">
        <input type="hidden" name="csrf" value="${escapeAttr(csrf)}">
        <label>メールアドレス<input required type="email" name="email" autocomplete="email" maxlength="254"></label>
        <button class="btn primary" type="submit">再設定用メールを送信する</button>
      </form>
      <p class="link-row"><a href="/login">ログインへ戻る</a></p>
    </section>
  `);
}

async function sendPasswordReset(env, request) {
  const form = await safeFormData(request);
  const csrfError = await verifyCsrf(env.AUTH_DB, form.get("csrf"));
  const email = normalizeEmail(form.get("email"));
  const ip = clientIp(request);
  const userAgent = truncate(request.headers.get("user-agent") || "", 500);
  let devLink = "";

  if (!csrfError && isValidEmail(email)) {
    const rateLimited = await hitRateLimit(env.AUTH_DB, `reset:ip:${ip}`, 5, 15);
    const user = rateLimited ? null : await env.AUTH_DB.prepare("SELECT id, email FROM users WHERE email = ? AND deleted_at IS NULL AND account_status = 'active'").bind(email).first();
    if (user) {
      const token = randomToken();
      const tokenHash = await hashToken(token);
      const expires = addMinutes(new Date(), RESET_TTL_MINUTES).toISOString();
      await env.AUTH_DB.prepare("UPDATE users SET password_reset_token_hash = ?, password_reset_expires_at = ?, updated_at = ? WHERE id = ?")
        .bind(tokenHash, expires, new Date().toISOString(), user.id).run();
      const resetUrl = new URL(`/reset-password?token=${encodeURIComponent(token)}`, request.url).toString();
      const mail = await sendMail(env, {
        to: user.email,
        subject: "QUANT LOG パスワード再設定",
        text: `パスワードを再設定するには、以下のURLを開いてください。\n\n${resetUrl}\n\nこのリンクは${RESET_TTL_MINUTES}分で期限切れになり、一度だけ使用できます。`
      });
      devLink = mail.devFallback ? resetUrl : "";
      await logEvent(env.AUTH_DB, "password_reset_requested", { userId: user.id, email, ip, userAgent });
    } else {
      await logEvent(env.AUTH_DB, "password_reset_requested_unknown", { email, ip, userAgent });
    }
  }

  return neutralMailPage("再設定メールを送信します", "入力されたメールアドレス宛に、必要な場合は再設定用メールを送信します。", devLink);
}

async function resetPasswordPage(env, request, url, message = "") {
  const token = url.searchParams.get("token") || "";
  const tokenHash = await hashToken(token);
  const user = await env.AUTH_DB.prepare("SELECT id FROM users WHERE password_reset_token_hash = ? AND password_reset_expires_at > ?")
    .bind(tokenHash, new Date().toISOString()).first();
  if (!user) {
    return htmlPage("パスワード再設定", `<section class="panel"><h1>再設定リンクが無効です</h1><p>リンクの期限が切れているか、すでに使用されています。</p><p><a href="/forgot-password">再設定メールを再送する</a></p></section>`, { status: 400 });
  }
  const csrf = await createCsrf(env.AUTH_DB);
  return htmlPage("パスワード再設定", `
    <section class="panel">
      <h1>新しいパスワードを設定</h1>
      ${message}
      <form method="post" action="/reset-password" class="form">
        <input type="hidden" name="csrf" value="${escapeAttr(csrf)}">
        <input type="hidden" name="token" value="${escapeAttr(token)}">
        <label>新しいパスワード<input required type="password" name="password" autocomplete="new-password" minlength="15" maxlength="${MAX_PASSWORD_LENGTH}"></label>
        <button class="btn primary" type="submit">パスワードを更新する</button>
      </form>
    </section>
  `);
}

async function resetPassword(env, request) {
  const form = await safeFormData(request);
  const csrfError = await verifyCsrf(env.AUTH_DB, form.get("csrf"));
  const token = String(form.get("token") || "");
  const password = String(form.get("password") || "");
  const tokenHash = await hashToken(token);
  const user = await env.AUTH_DB.prepare("SELECT id, email, display_name FROM users WHERE password_reset_token_hash = ? AND password_reset_expires_at > ?")
    .bind(tokenHash, new Date().toISOString()).first();
  if (csrfError || !user) {
    return htmlPage("パスワード再設定", `<section class="panel"><h1>再設定リンクが無効です</h1><p>リンクの期限が切れているか、すでに使用されています。</p></section>`, { status: 400 });
  }
  if (!isStrongPassword(password, user.email, user.display_name)) {
    return resetPasswordPage(env, request, new URL(`/reset-password?token=${encodeURIComponent(token)}`, request.url), errorMessage("このパスワードは推測されやすいため使用できません。より長く、他人が推測しにくいパスワードを設定してください。"));
  }
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  await env.AUTH_DB.prepare("UPDATE users SET password_hash = ?, password_reset_token_hash = NULL, password_reset_expires_at = NULL, failed_login_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?")
    .bind(passwordHash, now, user.id).run();
  await env.AUTH_DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();
  await logEvent(env.AUTH_DB, "password_reset_completed", { userId: user.id, email: user.email, ip: clientIp(request), userAgent: truncate(request.headers.get("user-agent") || "", 500) });
  await sendMail(env, {
    to: user.email,
    subject: "QUANT LOG パスワード変更完了",
    text: "QUANT LOGのパスワードが変更されました。心当たりがない場合は、問い合わせ窓口からご連絡ください。"
  });
  return htmlPage("パスワード再設定完了", `<section class="panel"><h1>パスワードを更新しました</h1><p>新しいパスワードでログインしてください。</p><p><a class="btn primary" href="/login">ログインする</a></p></section>`, { headers: { "Set-Cookie": clearSessionCookie() } });
}

function termsPage() {
  return htmlPage("利用規約", `
    <section class="panel wide">
      <p class="eyebrow">Terms</p>
      <h1>利用規約</h1>
      <h2>サービス内容</h2>
      <p>当サイトは、AI活用、金融マーケット観測、サービス試作、個人プロトタイプに関する情報と機能を提供します。無料会員登録は、今後の会員限定コンテンツや新機能の提供に向けた登録ニーズ確認を目的とします。</p>
      <h2>無料会員登録</h2>
      <p>現在の登録は無料です。有料プランやサブスクリプションを開始する場合は、料金、サービス内容、支払条件、解約方法を事前に明示し、ユーザーの同意なく自動的に課金へ移行することはありません。</p>
      <h2>アカウント管理責任</h2>
      <p>ユーザーは、自身のメールアドレス、パスワード、アカウントを適切に管理する責任を負います。</p>
      <h2>禁止事項</h2>
      <ul>
        <li>誹謗中傷、虚偽情報の投稿、嫌がらせ行為</li>
        <li>不正アクセス、他人になりすます行為、複数アカウントの悪用</li>
        <li>運営または第三者の信用を毀損する行為</li>
        <li>サービス運営を妨害する行為</li>
        <li>法令または公序良俗に反する行為</li>
      </ul>
      <h2>運営側の対応権限</h2>
      <p>運営は、違反または悪質行為があると判断した場合、投稿削除、アカウント停止、アカウント削除、事前通知なしの利用制限、法的措置を行うことがあります。</p>
      <h2>サービス変更・停止</h2>
      <p>運営は、必要に応じてサービス内容の変更、停止、終了を行うことがあります。</p>
      <h2>免責事項</h2>
      <p>当サイトの情報は、投資、税務、法律、労務その他の専門的助言を目的とするものではありません。最終的な判断はユーザー自身の責任で行うものとします。</p>
      <h2>退会・アカウント削除</h2>
      <p>退会やアカウント削除の希望は問い合わせ窓口から受け付けます。本人確認と安全確認のうえ対応します。</p>
      <h2>準拠法・管轄</h2>
      <p>本規約は日本法に準拠します。紛争が生じた場合は、日本国内の管轄裁判所を第一審の専属的合意管轄とします。</p>
      <h2>問い合わせ先</h2>
      <p><a href="/contact">問い合わせ・通報窓口</a>をご利用ください。</p>
    </section>
  `);
}

function privacyPage() {
  return htmlPage("プライバシーポリシー", `
    <section class="panel wide">
      <p class="eyebrow">Privacy</p>
      <h1>プライバシーポリシー</h1>
      <h2>取得する情報</h2>
      <p>無料登録時点で、メールアドレス、ニックネーム、パスワードハッシュ、ログイン日時、IPアドレスなどのアクセス情報、User-Agent、パスワード再設定履歴、メール認証履歴を取得します。氏名、住所、電話番号、生年月日、クレジットカード情報は取得しません。</p>
      <h2>利用目的</h2>
      <ul>
        <li>会員登録、ログイン認証、パスワード再設定、メール認証</li>
        <li>不正ログイン防止、セキュリティ確保、悪質ユーザー対応</li>
        <li>サービス改善、お知らせの送信、問い合わせ対応</li>
      </ul>
      <h2>第三者提供の有無</h2>
      <p>法令に基づく場合を除き、本人の同意なく第三者へ個人情報を提供しません。</p>
      <h2>外部サービス利用の有無</h2>
      <p>メール送信、アクセス解析、ホスティング、セキュリティ対策のため外部サービスを利用することがあります。</p>
      <h2>安全管理措置</h2>
      <p>パスワードは平文保存せず、ソルト付きの安全なハッシュとして保存します。確認トークンと再設定トークンもハッシュ化して保存します。</p>
      <h2>Cookie・アクセス解析の利用</h2>
      <p>ログイン状態の維持、不正利用防止、アクセス解析のためCookieやアクセスログを利用します。</p>
      <h2>問い合わせ先</h2>
      <p>個人情報、削除依頼、不正ログインの疑い、その他トラブルは<a href="/contact">問い合わせ・通報窓口</a>からご連絡ください。</p>
    </section>
  `);
}

function contactPage() {
  return htmlPage("問い合わせ", `
    <section class="panel wide">
      <p class="eyebrow">Contact</p>
      <h1>問い合わせ・通報</h1>
      <p>アカウントに関する問い合わせ、不正ログインの疑い、誹謗中傷・嫌がらせの通報、個人情報に関する問い合わせ、削除依頼、その他トラブル報告を受け付けます。</p>
      <div class="actions">
        <a class="btn primary" href="https://ig.me/m/tatsuyaaistructure" target="_blank" rel="noreferrer">Instagram DM</a>
        <a class="btn ghost" href="https://www.instagram.com/tatsuyaaistructure/?hl=ja" target="_blank" rel="noreferrer">Instagram</a>
      </div>
      <p class="help">本番公開前に、必要に応じて正式な問い合わせ用メールアドレスを追加してください。</p>
    </section>
  `);
}

async function requireUser(env, request) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return {};
  const tokenHash = await hashToken(token);
  const session = await env.AUTH_DB.prepare("SELECT * FROM sessions WHERE id_hash = ? AND expires_at > ?")
    .bind(tokenHash, new Date().toISOString()).first();
  if (!session) return {};
  if (new Date(session.last_seen_at).getTime() + SESSION_IDLE_SECONDS * 1000 < Date.now()) {
    await env.AUTH_DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(tokenHash).run();
    return {};
  }
  const user = await env.AUTH_DB.prepare("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL").bind(session.user_id).first();
  if (!user || user.account_status !== "active") return {};
  await env.AUTH_DB.prepare("UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?").bind(new Date().toISOString(), tokenHash).run();
  return { user, session };
}

async function createSession(db, userId, ip, userAgent) {
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const now = new Date();
  await db.prepare("INSERT INTO sessions (id_hash, user_id, created_at, expires_at, last_seen_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(tokenHash, userId, now.toISOString(), addSeconds(now, SESSION_MAX_AGE_SECONDS).toISOString(), now.toISOString(), ip, userAgent).run();
  return `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

async function createCsrf(db) {
  await db.prepare("DELETE FROM csrf_tokens WHERE expires_at <= ?").bind(new Date().toISOString()).run();
  const token = randomToken();
  await db.prepare("INSERT INTO csrf_tokens (token_hash, created_at, expires_at) VALUES (?, ?, ?)")
    .bind(await hashToken(token), new Date().toISOString(), addMinutes(new Date(), CSRF_TTL_MINUTES).toISOString()).run();
  return token;
}

async function verifyCsrf(db, token) {
  if (!token || typeof token !== "string") return true;
  const tokenHash = await hashToken(token);
  const row = await db.prepare("SELECT token_hash FROM csrf_tokens WHERE token_hash = ? AND expires_at > ?")
    .bind(tokenHash, new Date().toISOString()).first();
  await db.prepare("DELETE FROM csrf_tokens WHERE token_hash = ? OR expires_at <= ?")
    .bind(tokenHash, new Date().toISOString()).run();
  return !row;
}

async function hitRateLimit(db, key, limit, windowMinutes) {
  const now = new Date();
  const row = await db.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").bind(key).first();
  if (!row || new Date(row.reset_at) <= now) {
    await db.prepare("INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)")
      .bind(key, addMinutes(now, windowMinutes).toISOString()).run();
    return false;
  }
  const count = Number(row.count || 0) + 1;
  await db.prepare("UPDATE rate_limits SET count = ? WHERE key = ?").bind(count, key).run();
  return count > limit;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${base64Url(salt)}$${base64Url(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  const salt = base64UrlToBytes(parts[2]);
  const expected = base64UrlToBytes(parts[3]);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, expected.length * 8);
  return constantTimeEqual(new Uint8Array(bits), expected);
}

function isStrongPassword(password, email, displayName) {
  if (typeof password !== "string") return false;
  if (password.length < 15 || password.length > MAX_PASSWORD_LENGTH) return false;
  const lower = password.toLocaleLowerCase();
  const emailLocal = String(email || "").split("@")[0].toLocaleLowerCase();
  const name = String(displayName || "").toLocaleLowerCase();
  const weakTerms = ["password", "test", "user", "12345678", "qwerty", "admin", "quantlog", "quant-log", "tatsuya", APP_NAME.toLocaleLowerCase(), emailLocal, name].filter(Boolean);
  if (weakTerms.some((term) => term.length >= 3 && lower.includes(term))) return false;
  if (/(.)\1{5,}/u.test(password)) return false;
  const sequences = ["0123456789", "1234567890", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  if (sequences.some((seq) => includesSequence(lower, seq, 6))) return false;
  return uniqueChars(password) >= 8;
}

function includesSequence(value, sequence, minLength) {
  for (let i = 0; i <= sequence.length - minLength; i += 1) {
    const part = sequence.slice(i, i + minLength);
    if (value.includes(part) || value.includes(reverse(part))) return true;
  }
  return false;
}

function uniqueChars(value) {
  return new Set(Array.from(value)).size;
}

async function sendMail(env, mail) {
  if (env.MAIL_API_URL && env.MAIL_API_TOKEN) {
    const response = await fetch(env.MAIL_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${env.MAIL_API_TOKEN}`
      },
      body: JSON.stringify({ to: mail.to, subject: mail.subject, text: mail.text })
    });
    if (!response.ok) throw new Error("MailSendFailed");
    return { sent: true, devFallback: false };
  }
  return { sent: false, devFallback: String(env.ENVIRONMENT || "").toLowerCase() !== "production" };
}

async function logEvent(db, eventType, options = {}) {
  await db.prepare("INSERT INTO auth_events (id, user_id, email_hash, event_type, ip, user_agent, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(
      crypto.randomUUID(),
      options.userId || null,
      options.email ? await hashToken(normalizeEmail(options.email)) : null,
      eventType,
      options.ip || null,
      options.userAgent || null,
      new Date().toISOString(),
      options.metadata ? JSON.stringify(options.metadata) : null
    ).run();
}

async function safeFormData(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/x-www-form-urlencoded") && !contentType.includes("multipart/form-data")) {
    return new FormData();
  }
  return request.formData();
}

function neutralMailPage(title, body, devLink = "") {
  return htmlPage(title, `
    <section class="panel">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(body)}</p>
      ${devLink ? `<p class="dev-link">開発環境用リンク: <a href="${escapeAttr(devLink)}">${escapeHtml(devLink)}</a></p>` : ""}
      <p><a class="btn primary" href="/login">ログインへ</a></p>
    </section>
  `);
}

function htmlPage(title, body, options = {}) {
  const status = options.status || 200;
  const headers = new Headers(options.headers || {});
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "same-origin");
  headers.set("x-frame-options", "DENY");
  headers.set("content-security-policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
  return new Response(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} | ${APP_NAME}</title>
  <link rel="icon" type="image/png" href="/assets/favicon_16x16.png">
  <link rel="stylesheet" href="/styles.css?v=serif-sync-06">
  <style>
    .auth-main{width:min(980px,100%);margin:0 auto;padding:clamp(3rem,7vw,5.5rem) clamp(1.25rem,4vw,2.5rem) 5rem}
    .panel{border:1px solid var(--line-soft);background:rgba(7,8,8,.82);padding:clamp(1.35rem,4vw,2.6rem);display:grid;gap:1rem}
    .panel.wide{max-width:860px}.panel:not(.wide){max-width:640px;margin:0 auto}.eyebrow{color:var(--gold-soft);letter-spacing:.08em;text-transform:uppercase;font-size:.82rem}
    .form{display:grid;gap:1rem}.form label{display:grid;gap:.35rem;color:var(--muted)}.form input{width:100%;border:1px solid var(--line-soft);border-radius:0;padding:.8rem .9rem;color:var(--text);background:#070707}
    .form .check{grid-template-columns:auto 1fr;align-items:start}.form .check input{width:auto;margin-top:.45rem}.help,.legal-row,.link-row{color:var(--muted);font-size:.92rem}.error{border:1px solid rgba(220,80,80,.5);padding:.75rem;color:#ffd6d6;background:rgba(120,20,20,.18)}.success{border:1px solid rgba(184,134,24,.55);padding:.75rem;background:rgba(184,134,24,.12)}.actions{display:flex;flex-wrap:wrap;gap:.8rem;align-items:center}.inline-form{display:inline}.account-list{display:grid;gap:.75rem}.account-list div{border-bottom:1px solid var(--line-soft);padding-bottom:.7rem}.account-list dt{color:var(--muted);font-size:.88rem}.account-list dd{margin:0}.dev-link{overflow-wrap:anywhere;color:var(--gold-soft)}
  </style>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/index.html#hero" aria-label="${APP_NAME}">
      <span class="brand-main">QUANT LOG</span>
      <span class="brand-sub">by Tatsuya</span>
    </a>
    <nav>
      <a href="/index.html#services">Services</a>
      <a href="/market.html">Market</a>
      <a href="/index.html#prototype">Prototype</a>
      <a href="/login">Status</a>
      <a href="/register">Interest</a>
    </nav>
  </header>
  <main class="auth-main">${body}</main>
  <footer class="site-footer">
    <img src="/assets/tatsuya-logo.png" alt="Tatsuya">
    <p>©2025 Quant-Log by Tatsuya</p>
    <p class="footer-links"><a href="/terms">利用規約</a> <a href="/privacy">プライバシーポリシー</a> <a href="/contact">問い合わせ・通報</a></p>
  </footer>
</body>
</html>`, { status, headers });
}

function errorMessage(text) {
  return `<p class="error">${escapeHtml(text)}</p>`;
}

function successMessage(html) {
  return `<p class="success">${html}</p>`;
}

function redirect(location, cookie) {
  const headers = new Headers({ location });
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function normalizeDisplayName(value) {
  const name = String(value || "").trim().replace(/[\u0000-\u001F\u007F]/g, "");
  if (name.length < 1 || name.length > 40) return "";
  return name;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}

async function hashToken(value) {
  const data = new TextEncoder().encode(String(value || ""));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64Url(new Uint8Array(hash));
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a[i] ^ b[i];
  return result === 0;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

function clientIp(request) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return truncate(cfIp, 80);
  return truncate((request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown", 80);
}

function truncate(value, length) {
  return String(value || "").slice(0, length);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000);
}

function reverse(value) {
  return Array.from(value).reverse().join("");
}
