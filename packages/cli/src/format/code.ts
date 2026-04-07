import chalk from 'chalk';

export function formatCodeBlock(code: string, startLine: number): string {
  const lines = code.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  const maxLineNum = startLine + lines.length - 1;
  const gutterWidth = String(maxLineNum).length;

  const formatted = lines.map((line, i) => {
    const lineNum = chalk.dim(String(startLine + i).padStart(gutterWidth));
    return `  ${chalk.dim('│')} ${lineNum}  ${line}`;
  });

  const borderLen = 40;
  return [
    `  ${chalk.dim(`┌${'─'.repeat(borderLen)}`)}`,
    ...formatted,
    `  ${chalk.dim(`└${'─'.repeat(borderLen)}`)}`,
  ].join('\n');
}
