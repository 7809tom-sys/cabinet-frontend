export type HomepageWelcomeUser = {
  name?: string | null;
  companyName?: string | null;
  email?: string | null;
};

function firstReadableWord(value: string): string {
  return value.trim().split(/\s+/)[0] ?? "";
}

export function homepageWelcomeName(user: HomepageWelcomeUser): string {
  const firstName = user.name ? firstReadableWord(user.name) : "";
  if (firstName) return firstName;

  const companyName = user.companyName?.trim();
  if (companyName) return companyName;

  const emailName = user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (emailName) {
    const firstEmailWord = firstReadableWord(emailName);
    return firstEmailWord.charAt(0).toUpperCase() + firstEmailWord.slice(1);
  }

  return "there";
}
