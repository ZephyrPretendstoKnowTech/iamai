// The feedback channel (prompt 34 §2).
//
// This block is the author's own voice, not IAMAI's, which is why it is in the
// first person. The footer already carries that exception by agreement
// (ux-review-05 §30); `src/copy/lint.test.ts` lists these strings alongside it.
export const FEEDBACK = {
  link: 'Something wrong or unclear? Tell me.',
  title: 'Tell me what is wrong',
  intro: 'This tool is only useful if it is accurate. If something looks wrong, I want to know.',
  includeLabel: 'Include a summary of this scan (counts only)',
  includeHint: 'No names, no sign-in addresses, no tenant id. Everything that would be attached is shown below.',
  previewTitle: 'What the email will contain',
  send: 'Open your mail app',
  issue: 'Open an issue on GitHub',
  nothingAutomatic: 'Nothing is sent from here. Your mail app opens with the text above, and you decide whether to send it.',
  close: 'Close',
  address: 'feedback@getiamai.com',
}
