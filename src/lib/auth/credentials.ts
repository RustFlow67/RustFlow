export type PasswordMode = "login" | "register";
const USERNAME = /^[\p{L}\p{N}._-]{3,32}$/u;
const EMAIL = /^[^\s@]+@(?:[a-z0-9-]+\.)+[a-z0-9-]{2,}$/i;

export function credentials(data: Record<string, unknown>, mode: PasswordMode) {
  const login = typeof data.login === "string" ? data.login.normalize("NFKC").trim().toLowerCase() : "";
  const password = typeof data.password === "string" ? data.password : "";
  if (login.length > 254 || !(USERNAME.test(login) || (EMAIL.test(login) && !/\p{C}/u.test(login)))) {
    return { error: "Введите email или логин из 3–32 букв, цифр, точек, дефисов или подчёркиваний." } as const;
  }
  const length = Array.from(password).length;
  if (length < 4 || password.length > 128) return { error: "Пароль должен содержать от 4 до 128 символов." } as const;
  if (mode === "register" && data.confirm !== password) return { error: "Пароли не совпадают." } as const;
  return { login, password, name: Array.from(login.split("@")[0]).slice(0, 36).join("") } as const;
}
