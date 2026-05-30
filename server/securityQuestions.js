export const SECURITY_QUESTIONS = [
  'What is the name of your first pet?',
  'What city were you born in?',
  'What is your favorite food?',
  'What was the name of your first school?',
  'What is your mother\'s maiden name?',
];

export function isAllowedSecurityQuestion(question) {
  return SECURITY_QUESTIONS.includes(String(question || '').trim());
}
