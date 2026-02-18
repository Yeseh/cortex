#!/usr/bin/env bun
/**
 * One-time migration script to transfer memories from OpenCode memory system to Cortex.
 *
 * Usage:
 *   bun run scripts/migrate-opencode-memory.ts [options]
 *
 * Options:
 *   --source-cli <path>   Path to OpenCode memory CLI (default: auto-detect)
 *   --target <path>       Target Cortex store path (default: ~/.config/cortex/memory)
 *   --project <name>      Project name for local memories
 *   --dry-run             Preview without writing files
 *   --verbose             Show detailed output
 */

import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { $ } from 'bun';
import { FilesystemStorageAdapter } from '../packages/storage-fs/src/index.ts';
import { CategoryPath } from '../packages/core/src/index.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SourceMemory {
    id: string;
    blockLabel: string;
    content: string;
    tags: string[];
    scope: 'global' | 'local';
}

interface MigrationResult {
    source: SourceMemory;
    targetPath: string;
    slug: string;
    status: 'migrated' | 'skipped' | 'failed';
    error?: string;
}

interface CLIOptions {
    sourceCli: string;
    target: string;
    project?: string;
    dryRun: boolean;
    verbose: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stopwords for slug generation
// ─────────────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
    // Articles
    'a',
    'an',
    'the',
    // Be verbs
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    // Have verbs
    'have',
    'has',
    'had',
    'having',
    // Do verbs
    'do',
    'does',
    'did',
    'doing',
    // Modal verbs
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    // Other common verbs
    'need',
    'dare',
    'ought',
    'used',
    // Pronouns
    'i',
    'you',
    'he',
    'she',
    'it',
    'we',
    'they',
    'me',
    'him',
    'her',
    'us',
    'them',
    'my',
    'your',
    'his',
    'its',
    'our',
    'their',
    'mine',
    'yours',
    'hers',
    'ours',
    'theirs',
    'this',
    'that',
    'these',
    'those',
    'who',
    'whom',
    'which',
    'what',
    'whose',
    // Prepositions
    'in',
    'on',
    'at',
    'by',
    'for',
    'with',
    'about',
    'against',
    'between',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'to',
    'from',
    'up',
    'down',
    'out',
    'off',
    'over',
    'under',
    'again',
    'further',
    'then',
    'once',
    // Conjunctions
    'and',
    'but',
    'or',
    'nor',
    'so',
    'yet',
    'both',
    'either',
    'neither',
    'not',
    'only',
    'own',
    'same',
    'than',
    'too',
    'very',
    'just',
    // Other common words
    'as',
    'if',
    'when',
    'where',
    'why',
    'how',
    'all',
    'each',
    'every',
    'any',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'of',
    // Tech-specific common words to filter
    'use',
    'using',
    'uses',
    'user',
    'users',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Slug generation
// ─────────────────────────────────────────────────────────────────────────────

function generateSlug(content: string, maxWords: number = 5): string {
    // Decode HTML entities
    const decoded = content
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');

    // Extract words: lowercase, remove punctuation, split
    const words = decoded
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2)
        .filter((word) => !STOPWORDS.has(word))
        .filter((word) => !/^\d+$/.test(word)); // Remove pure numbers

    // Take first N significant words
    const significant = words.slice(0, maxWords);

    if (significant.length === 0) {
        return 'memory';
    }

    return significant.join('-');
}

function makeUniqueSlug(baseSlug: string, usedSlugs: Set<string>): string {
    if (!usedSlugs.has(baseSlug)) {
        usedSlugs.add(baseSlug);
        return baseSlug;
    }

    let counter = 2;
    while (usedSlugs.has(`${baseSlug}-${counter}`)) {
        counter++;
    }

    const uniqueSlug = `${baseSlug}-${counter}`;
    usedSlugs.add(uniqueSlug);
    return uniqueSlug;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source data parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseMemoriesFromXml(xmlContent: string, scope: 'global' | 'local'): SourceMemory[] {
    const memories: SourceMemory[] = [];

    // Parse memory blocks
    const blockRegex = /<memory_block\s+label="([^"]+)"[^>]*>([\s\S]*?)<\/memory_block>/g;
    let blockMatch;

    while ((blockMatch = blockRegex.exec(xmlContent)) !== null) {
        const blockLabel = blockMatch[1] ?? '';
        const blockContent = blockMatch[2] ?? '';

        if (!blockLabel) {
            continue;
        }

        // Parse memories within the block
        const memoryRegex =
            /<memory\s+id="([^"]+)">\s*<content>([\s\S]*?)<\/content>\s*<tags>([\s\S]*?)<\/tags>\s*<\/memory>/g;
        let memoryMatch;

        while ((memoryMatch = memoryRegex.exec(blockContent)) !== null) {
            const id = memoryMatch[1] ?? '';
            const content = (memoryMatch[2] ?? '').trim();
            const tagsRaw = (memoryMatch[3] ?? '').trim();

            if (!id || !content) {
                continue;
            }

            // Parse tags (comma-separated)
            const tags = tagsRaw
                .split(',')
                .map((t) => t.trim())
                .filter((t) => t.length > 0);

            memories.push({
                id,
                blockLabel,
                content,
                tags,
                scope,
            });
        }
    }

    return memories;
}

async function fetchSourceMemories(
    cliPath: string,
    scope: 'global' | 'local',
    verbose: boolean
): Promise<SourceMemory[]> {
    if (verbose) {
        console.log(`  Fetching ${scope} memories from: ${cliPath}`);
    }

    try {
        const result =
            await $`bun run ${cliPath} list --scope ${scope} --json --limit 1000`.quiet();
        const output = result.stdout.toString();

        // Parse JSON wrapper
        let jsonData: { success: boolean; output: string };
        try {
            jsonData = JSON.parse(output);
        } catch {
            console.error(`  Failed to parse JSON output for ${scope} scope`);
            return [];
        }

        if (!jsonData.success) {
            console.error(`  CLI returned failure for ${scope} scope`);
            return [];
        }

        // Parse XML content within the JSON output
        const memories = parseMemoriesFromXml(jsonData.output, scope);

        if (verbose) {
            console.log(`  Found ${memories.length} memories in ${scope} scope`);
        }

        return memories;
    } catch (error) {
        if (verbose) {
            console.error(`  Error fetching ${scope} memories:`, error);
        }
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Category mapping
// ─────────────────────────────────────────────────────────────────────────────

function mapBlockToCategory(
    blockLabel: string,
    scope: 'global' | 'local',
    projectName?: string
): string {
    if (scope === 'global') {
        // Global blocks: persona, human → global/persona, global/human
        return `global/${blockLabel}`;
    }

    // Local blocks: project, scratch → projects/<name>/project, projects/<name>/scratch
    const project = projectName ?? 'default';
    return `projects/${project}/${blockLabel}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Memory file generation
// ─────────────────────────────────────────────────────────────────────────────

function generateMemoryFile(memory: SourceMemory): string {
    const now = new Date();
    const timestamp = now.toISOString();

    // Decode HTML entities in content
    const decodedContent = memory.content
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');

    // Format tags as YAML array
    const tagsYaml = memory.tags.length > 0 ? `[${memory.tags.join(', ')}]` : '[]';

    const frontmatter = [
        '---',
        `created_at: ${timestamp}`,
        `updated_at: ${timestamp}`,
        `tags: ${tagsYaml}`,
        `source: opencode-migration`,
        '---',
    ].join('\n');

    return `${frontmatter}\n${decodedContent}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration logic
// ─────────────────────────────────────────────────────────────────────────────

async function migrateMemory(
    memory: SourceMemory,
    targetRoot: string,
    usedSlugsPerCategory: Map<string, Set<string>>,
    options: CLIOptions
): Promise<MigrationResult> {
    const category = mapBlockToCategory(memory.blockLabel, memory.scope, options.project);

    // Get or create slug set for this category
    if (!usedSlugsPerCategory.has(category)) {
        usedSlugsPerCategory.set(category, new Set());
    }
    const usedSlugs = usedSlugsPerCategory.get(category)!;

    // Generate unique slug
    const baseSlug = generateSlug(memory.content);
    const slug = makeUniqueSlug(baseSlug, usedSlugs);

    // Build target path
    const slugPath = `${category}/${slug}`;
    const targetPath = join(targetRoot, 'memories', `${slugPath}.md`);

    if (options.dryRun) {
        return {
            source: memory,
            targetPath: slugPath,
            slug,
            status: 'migrated',
        };
    }

    try {
        // Generate file content
        const fileContent = generateMemoryFile(memory);

        // Ensure directory exists
        await mkdir(dirname(targetPath), { recursive: true });

        // Write file
        await writeFile(targetPath, fileContent, 'utf8');

        return {
            source: memory,
            targetPath: slugPath,
            slug,
            status: 'migrated',
        };
    } catch (error) {
        return {
            source: memory,
            targetPath: slugPath,
            slug,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function runMigration(options: CLIOptions): Promise<void> {
    console.log('OpenCode Memory → Cortex Migration');
    console.log('===================================\n');

    if (options.dryRun) {
        console.log('DRY RUN MODE - No files will be written\n');
    }

    // Collect all memories
    console.log('Step 1: Fetching source memories...');
    const allMemories: SourceMemory[] = [];

    const globalMemories = await fetchSourceMemories(options.sourceCli, 'global', options.verbose);
    allMemories.push(...globalMemories);

    // Only fetch local if project is specified
    if (options.project) {
        const localMemories = await fetchSourceMemories(
            options.sourceCli,
            'local',
            options.verbose
        );
        allMemories.push(...localMemories);
    }

    if (allMemories.length === 0) {
        console.log('\nNo memories found to migrate.');
        return;
    }

    console.log(`\nFound ${allMemories.length} memories to migrate.\n`);

    // Migrate memories
    console.log('Step 2: Migrating memories...');
    const results: MigrationResult[] = [];
    const usedSlugsPerCategory = new Map<string, Set<string>>();

    for (const memory of allMemories) {
        const result = await migrateMemory(memory, options.target, usedSlugsPerCategory, options);
        results.push(result);

        if (options.verbose) {
            const statusIcon =
                result.status === 'migrated' ? '✓' : result.status === 'skipped' ? '○' : '✗';
            console.log(`  ${statusIcon} ${memory.id} → ${result.targetPath}`);
            if (result.error) {
                console.log(`    Error: ${result.error}`);
            }
        }
    }

    // Reindex if not dry run
    if (!options.dryRun) {
        console.log('\nStep 3: Rebuilding indexes...');
        try {
            const adapter = new FilesystemStorageAdapter({ rootDirectory: options.target });
            const reindexResult = await adapter.indexes.reindex(CategoryPath.root());
            if (reindexResult.ok()) {
                console.log('  Indexes rebuilt successfully.');
            } else {
                console.error('  Failed to rebuild indexes:', reindexResult.error.message);
            }
        } catch (error) {
            console.error('  Error rebuilding indexes:', error);
        }
    }

    // Summary
    console.log('\n===================================');
    console.log('Migration Summary');
    console.log('===================================\n');

    const migrated = results.filter((r) => r.status === 'migrated').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped:  ${skipped}`);
    console.log(`  Failed:   ${failed}`);
    console.log(`  Total:    ${results.length}`);

    if (failed > 0) {
        console.log('\nFailed migrations:');
        for (const result of results.filter((r) => r.status === 'failed')) {
            console.log(`  - ${result.source.id}: ${result.error}`);
        }
    }

    if (!options.dryRun) {
        console.log(`\nMemories migrated to: ${options.target}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        options: {
            'source-cli': { type: 'string' },
            target: { type: 'string' },
            project: { type: 'string' },
            'dry-run': { type: 'boolean', default: false },
            verbose: { type: 'boolean', default: false },
            help: { type: 'boolean', default: false },
        },
        strict: true,
    });

    if (values.help) {
        console.log(`
OpenCode Memory → Cortex Migration Script

Usage:
  bun run scripts/migrate-opencode-memory.ts [options]

Options:
  --source-cli <path>   Path to OpenCode memory CLI
                        (default: ~/.config/opencode/skills/memory/cli.ts)
  --target <path>       Target Cortex store path
                        (default: ~/.config/cortex/memory)
  --project <name>      Project name for local memories (required for local)
  --dry-run             Preview without writing files
  --verbose             Show detailed output
  --help                Show this help message

Examples:
  # Migrate global memories only
  bun run scripts/migrate-opencode-memory.ts

  # Migrate with verbose output
  bun run scripts/migrate-opencode-memory.ts --verbose

  # Dry run to preview migration
  bun run scripts/migrate-opencode-memory.ts --dry-run --verbose

  # Migrate including local memories for project "myapp"
  bun run scripts/migrate-opencode-memory.ts --project myapp
`);
        return;
    }

    const defaultSourceCli = join(homedir(), '.config', 'opencode', 'skills', 'memory', 'index.ts');
    const defaultTarget = join(homedir(), '.config', 'context', 'memory');

    const sourceCli = values['source-cli'] ?? defaultSourceCli;
    const target = values['target'] ?? defaultTarget;
    const dryRun = values['dry-run'] ?? false;
    const verbose = values['verbose'] ?? false;

    const options: CLIOptions = {
        sourceCli,
        target,
        project: values['project'],
        dryRun,
        verbose,
    };

    // Validate source CLI exists
    const sourceCliFile = Bun.file(options.sourceCli);
    if (!(await sourceCliFile.exists())) {
        console.error(`Error: Source CLI not found at: ${options.sourceCli}`);
        console.error('Use --source-cli to specify the correct path.');
        process.exit(1);
    }

    await runMigration(options);
}

main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
