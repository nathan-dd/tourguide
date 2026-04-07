import type { LanguageModel } from 'ai';
import { generateText, stepCountIs } from 'ai';
import { buildDiscoveryPrompt } from './prompts.js';
import { createTools } from './tools/index.js';
import type { ProgressCallback, StepDetailCallback } from './types.js';

type ResponseMessageLike = { role: string; content?: unknown };

/**
 * When the model ends on a tool-calls finish reason, `generateText` can leave `text` empty
 * even though the last assistant turn contained prose. In that case we take text parts from
 * the final assistant message in `response.messages` (AI SDK 6).
 */
function textFromAssistantMessage(message: ResponseMessageLike): string | undefined {
  if (message.role !== 'assistant') {
    return undefined;
  }
  const { content } = message;
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return undefined;
  }
  const chunks: string[] = [];
  for (const part of content) {
    if (
      part &&
      typeof part === 'object' &&
      'type' in part &&
      part.type === 'text' &&
      'text' in part &&
      typeof (part as { text: unknown }).text === 'string'
    ) {
      chunks.push((part as { text: string }).text);
    }
  }
  return chunks.length > 0 ? chunks.join('') : undefined;
}

function lastAssistantTextFromResponse(messages: ResponseMessageLike[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message === undefined) {
      continue;
    }
    const text = textFromAssistantMessage(message);
    if (text !== undefined && text.length > 0) {
      return text;
    }
  }
  return undefined;
}

export async function runDiscovery(options: {
  model: LanguageModel;
  diff: string;
  repoPath: string;
  maxSteps: number;
  onProgress?: ProgressCallback;
  onStepDetail?: StepDetailCallback;
}): Promise<string> {
  const { model, diff, repoPath, maxSteps, onProgress, onStepDetail } = options;
  const { system, prompt } = buildDiscoveryPrompt(diff);
  const tools = createTools(repoPath);

  const result = await generateText({
    model,
    system,
    prompt,
    tools,
    stopWhen: stepCountIs(maxSteps),
    onStepFinish: (event) => {
      onProgress?.('Discovery step finished', {
        step: event.stepNumber,
        maxSteps,
      });
      onStepDetail?.({
        phase: 'discovery',
        stepNumber: event.stepNumber,
        text: event.text,
        toolCalls: event.toolCalls.map((tc) => ({
          toolName: tc.toolName,
          args: tc.input as Record<string, unknown>,
        })),
        toolResults: event.toolResults.map((tr) => ({
          toolName: tr.toolName,
          result: typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output),
        })),
      });
    },
  });

  const trimmed = result.text.trim();
  if (trimmed.length > 0) {
    return result.text;
  }

  const fromMessages = lastAssistantTextFromResponse(result.response.messages);
  if (fromMessages !== undefined && fromMessages.trim().length > 0) {
    return fromMessages;
  }

  const lastStep = result.steps.at(-1);
  const fromStep = lastStep?.text?.trim();
  if (lastStep && fromStep && fromStep.length > 0) {
    return lastStep.text;
  }

  return result.text;
}
