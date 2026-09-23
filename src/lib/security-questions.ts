export const SECURITY_QUESTIONS = [
  "What is your favorite Bible verse?",
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
] as const;

export type SecurityQuestion = (typeof SECURITY_QUESTIONS)[number];

export const DEFAULT_ADMIN = {
  full_name: "Michelle delos Reyes",
  email: "michelle.delos.reyes@bfbc.internal",
  password: "Bethel2026!",
  security_question: "What is your favorite Bible verse?" as SecurityQuestion,
  security_answer: "John 3:16",
};

export function isSecurityQuestion(value: string): value is SecurityQuestion {
  return (SECURITY_QUESTIONS as readonly string[]).includes(value);
}

export function namesMatch(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
