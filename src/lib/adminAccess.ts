const hardcodedAdminEmails = new Set(["rusvlad1010@gmail.com"]);

export function isHardcodedAdminEmail(email?: string | null) {
  return Boolean(email && hardcodedAdminEmails.has(email.trim().toLowerCase()));
}
