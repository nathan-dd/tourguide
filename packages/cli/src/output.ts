export type Output = {
  log: (text: string) => void;
  error: (text: string) => void;
};

export const consoleOutput: Output = {
  log: (text) => console.log(text),
  error: (text) => console.error(text),
};
