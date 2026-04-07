#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { generate } from './commands/generate.js';
import { play } from './commands/play.js';
import { summary } from './commands/summary.js';
import { validate } from './commands/validate.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program.name('tourguide').description('Guided code understanding').version(version);

program
  .command('validate')
  .description('Validate .tourguide files')
  .argument('<files...>', 'tour files to validate')
  .action(async (files: string[]) => {
    const exitCode = await validate(files);
    process.exit(exitCode);
  });

program
  .command('summary')
  .description('Print a tour summary')
  .argument('<file>', 'tour file')
  .action(async (file: string) => {
    const exitCode = await summary(file);
    process.exit(exitCode);
  });

program
  .command('play')
  .description('Interactively play through a tour')
  .argument('<file>', 'tour file')
  .action(async (file: string) => {
    const exitCode = await play(file);
    process.exit(exitCode);
  });

program
  .command('generate')
  .description('Generate a tour from a git diff')
  .requiredOption('--diff <range>', 'Git ref range (e.g., main..HEAD)')
  .option('--model <model>', 'Model identifier', 'claude-sonnet-4-20250514')
  .option('--provider <name>', 'AI SDK provider', 'anthropic')
  .option('--output <path>', 'Write tour to file')
  .option('--max-steps <n>', 'Max discovery steps', '25')
  .option('--quiet', 'Suppress progress output')
  .action(
    async (opts: {
      diff: string;
      model: string;
      provider: string;
      output?: string;
      maxSteps: string;
      quiet?: boolean;
    }) => {
      const maxSteps = Number.parseInt(opts.maxSteps, 10);
      if (Number.isNaN(maxSteps) || maxSteps < 1) {
        console.error('Invalid --max-steps: expected a positive integer');
        process.exit(1);
      }
      const exitCode = await generate({
        diff: opts.diff,
        model: opts.model,
        provider: opts.provider,
        maxSteps,
        quiet: opts.quiet === true,
        output: opts.output,
        packageVersion: version,
      });
      process.exit(exitCode);
    },
  );

program.parse();
