export function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

export function isValidPKPhone(value) {
  if (!String(value || "").trim()) return true;
  return /^(\+92|0092|92|0)?3\d{9}$/.test(String(value).replace(/[\s-]/g, ""));
}

export function parsePrice(value) {
  const digits = String(value || "").replace(/[^\d.]/g, "");
  const number = Number(digits);
  return Number.isFinite(number) ? number : 0;
}

export function passwordIssue(password) {
  const value = String(password || "");
  if (value.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return "Password must include a letter and a number";
  }
  return "";
}

export function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}
