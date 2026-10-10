import { createInterface, emitKeypressEvents } from 'node:readline';
export async function ask(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return await new Promise(resolve => rl.question(prompt, value => resolve(value.trim()))); }
  finally { rl.close(); }
}
export async function askPassword(prompt) {
  const input = process.stdin;
  if (!input.isTTY) throw new Error('Run this command in a Windows Command Prompt so the password can be entered privately.');
  process.stdout.write(prompt);
  emitKeypressEvents(input); input.setRawMode(true); input.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => { input.off('keypress', handle); input.setRawMode(false); input.pause(); process.stdout.write('\n'); };
    const handle = (text, key) => {
      if (key?.ctrl && key.name === 'c') { finish(); reject(new Error('Cancelled.')); }
      else if (key?.name === 'return' || key?.name === 'enter') { finish(); resolve(value); }
      else if (key?.name === 'backspace') { if (value) { value = value.slice(0, -1); process.stdout.write('\b \b'); } }
      else if (text && !key?.ctrl && !key?.meta && !/[\x00-\x1f\x7f]/.test(text) && value.length < 256) { value += text; process.stdout.write('*'); }
    };
    input.on('keypress', handle);
  });
}
