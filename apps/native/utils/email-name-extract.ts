function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1).toLowerCase();
}

export function extractNameFromEmail(email: string): { name: string; surname: string } {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(".");

  if (parts.length >= 2) {
    return { name: capitalize(parts[0]), surname: capitalize(parts[1]) };
  }

  return { name: "", surname: capitalize(parts[0] ?? "") };
}
