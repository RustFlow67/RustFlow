import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminOrigin, endAdminSession, hasAdminToken, isAdminSession, startAdminSession } from "@/lib/admin-session";

export const metadata: Metadata = {
  title: "Активация ADMIN",
  robots: { index: false, follow: false },
};

async function activate(form: FormData) {
  "use server";
  const error = await startAdminSession(form.get("token"));
  redirect(error ? `/admin?error=${error}` : "/admin");
}

async function deactivate() {
  "use server";
  await endAdminSession();
  redirect("/admin");
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const origin = adminOrigin(await headers());
  const admin = await isAdminSession();
  return <section className="glass glass-blur mx-auto max-w-md p-5 sm:p-7" aria-labelledby="admin-title">
    <h1 id="admin-title" className="headline text-xl sm:text-2xl">Активация ADMIN</h1>
    {admin ? <>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">Бейдж ADMIN активен в «Профиле». Сессия действует в этом браузере до 8 часов.</p>
      <form action={deactivate} className="mt-4">
        <button type="submit" className="btn btn-sm">Завершить сессию</button>
      </form>
    </> : !origin ? <p className="mt-3 text-sm text-ink-2">Вход доступен по HTTPS или при локальном запуске.</p>
      : !hasAdminToken() ? <p className="mt-3 text-sm text-ink-2">На сервере не настроена активация ADMIN.</p>
      : <form action={activate} className="mt-4 space-y-3">
        <label className="block text-sm font-semibold" htmlFor="admin-token">Токен RustFlow</label>
        <input id="admin-token" name="token" type="password" className="field" autoComplete="off"
          spellCheck={false} maxLength={64} required aria-invalid={error === "token" ? true : undefined} />
        {error === "token" && <p role="alert" className="text-sm text-danger">Токен не принят.</p>}
        {error === "blocked" && <p role="alert" className="text-sm text-danger">Слишком много неверных попыток. Вход заблокирован на час.</p>}
        {error === "connection" && <p role="alert" className="text-sm text-danger">Откройте /admin на том же сайте через HTTPS.</p>}
        <button type="submit" className="btn btn-primary btn-sm">Активировать ADMIN</button>
      </form>}
  </section>;
}
