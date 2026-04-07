import type { LanguageModel } from 'ai';

function isModuleNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as NodeJS.ErrnoException).code;
  return (
    code === 'ERR_MODULE_NOT_FOUND' ||
    code === 'MODULE_NOT_FOUND' ||
    error.message.includes('Cannot find module') ||
    error.message.includes('Cannot find package')
  );
}

function missingProviderPackageMessage(provider: string): string {
  return `Provider package @ai-sdk/${provider} not installed. Run: pnpm add @ai-sdk/${provider}`;
}

function resolveModelFromModule(
  mod: Record<string, unknown>,
  provider: string,
  modelId: string,
): LanguageModel {
  const factory = mod[provider] ?? mod.default;
  if (typeof factory === 'function') {
    return factory(modelId) as LanguageModel;
  }
  if (
    factory &&
    typeof factory === 'object' &&
    typeof (factory as { languageModel?: unknown }).languageModel === 'function'
  ) {
    return (factory as { languageModel: (id: string) => LanguageModel }).languageModel(modelId);
  }
  throw new Error(
    `Provider "@ai-sdk/${provider}" is installed but no model factory was found (expected export "${provider}" or a default callable).`,
  );
}

/**
 * Resolves a provider name and model id into an AI SDK {@link LanguageModel}.
 */
export async function createModel(providerName: string, modelId: string): Promise<LanguageModel> {
  const provider = providerName.toLowerCase();

  if (provider === 'anthropic') {
    try {
      const { anthropic } = await import('@ai-sdk/anthropic');
      return anthropic(modelId);
    } catch (error) {
      if (isModuleNotFound(error)) {
        throw new Error(missingProviderPackageMessage(provider), { cause: error });
      }
      throw error;
    }
  }

  try {
    const mod = (await import(`@ai-sdk/${provider}`)) as Record<string, unknown>;
    return resolveModelFromModule(mod, provider, modelId);
  } catch (error) {
    if (isModuleNotFound(error)) {
      throw new Error(missingProviderPackageMessage(provider), { cause: error });
    }
    throw error;
  }
}
