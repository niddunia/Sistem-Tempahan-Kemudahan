/**
 * Z.ai SDK helper — supports both local config file and Vercel env vars.
 *
 * Local dev: reads from /etc/.z-ai-config (Z.ai Code sandbox)
 * Vercel prod: reads from ZAI_BASE_URL + ZAI_API_KEY env vars
 */

interface ZAIConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

let cachedConfig: ZAIConfig | null = null;

async function loadZAIConfig(): Promise<ZAIConfig> {
  if (cachedConfig) return cachedConfig;

  // Priority 1: Environment variables (Vercel production)
  if (process.env.ZAI_API_KEY && process.env.ZAI_BASE_URL) {
    cachedConfig = {
      baseUrl: process.env.ZAI_BASE_URL,
      apiKey: process.env.ZAI_API_KEY,
      chatId: process.env.ZAI_CHAT_ID,
      userId: process.env.ZAI_USER_ID,
      token: process.env.ZAI_TOKEN,
    };
    return cachedConfig;
  }

  // Priority 2: Config file (local development / Z.ai sandbox)
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');

  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
    '/etc/.z-ai-config',
  ];

  for (const filePath of configPaths) {
    try {
      const configStr = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(configStr);
      if (config.baseUrl && config.apiKey) {
        cachedConfig = config;
        return cachedConfig;
      }
    } catch {
      // Continue to next path
    }
  }

  throw new Error('Z.ai configuration not found. Set ZAI_API_KEY and ZAI_BASE_URL env vars.');
}

/**
 * Create a ZAI client instance — works on both local and Vercel.
 */
export async function createZAIClient() {
  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  const config = await loadZAIConfig();
  // Use `new ZAI(config)` directly instead of `ZAI.create()` to bypass file loading
  return new ZAI(config);
}
