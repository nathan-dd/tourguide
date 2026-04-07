#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
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

program.parse();
