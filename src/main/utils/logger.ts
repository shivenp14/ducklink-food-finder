const isDev = process.env.NODE_ENV !== 'production';

function formatMessage(level: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    const formatted = formatMessage('INFO', message);
    if (isDev) console.log(formatted, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    const formatted = formatMessage('WARN', message);
    if (isDev) console.warn(formatted, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    const formatted = formatMessage('ERROR', message);
    console.error(formatted, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    const formatted = formatMessage('DEBUG', message);
    if (isDev) console.log(formatted, ...args);
  },
};
