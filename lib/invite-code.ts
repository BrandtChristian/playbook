const signupCode = (process.env.NEXT_PUBLIC_SIGNUP_CODE ?? "").trim();

export function isInviteCodeValid(code: string): boolean {
  if (!signupCode) return false; // no code configured = signup blocked
  return code.trim().toLowerCase() === signupCode.toLowerCase();
}

export const signupEnabled = !!signupCode;
