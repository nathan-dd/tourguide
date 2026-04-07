import { runDiscovery } from './discovery.js';
import { execGit } from './tools/git.js';
import type { GenerateResult, GenerateTourOptions } from './types.js';
import { runNarrationWithRetry } from './validation.js';

export async function generateTour(options: GenerateTourOptions): Promise<GenerateResult> {
  const { repoPath, baseRef, headRef, model, maxSteps, onProgress, modelId, packageVersion } =
    options;

  const diff = (await execGit(['diff', `${baseRef}..${headRef}`], repoPath)).trimEnd();
  const synthesis = await runDiscovery({
    model,
    diff,
    repoPath,
    maxSteps: maxSteps ?? 25,
    onProgress,
  });

  const { tour, warnings, semanticErrors } = await runNarrationWithRetry({
    model,
    synthesis,
    diff,
    baseRef,
    headRef,
    modelId,
    packageVersion,
    onProgress,
  });

  return semanticErrors === undefined ? { tour, warnings } : { tour, warnings, semanticErrors };
}
