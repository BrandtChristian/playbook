const raw = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? "";

export const allowedDomains = raw
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export function isEmailAllowed(email: string): boolean {
  if (allowedDomains.length === 0) return true; // no restriction if unset
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && allowedDomains.includes(domain);
}
