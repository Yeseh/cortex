import z from 'zod';

/**
 * Schema for parsing date values from frontmatter.
 * Accepts both Date objects and ISO 8601 strings.
 */
export const dateSchema = z
    .union([
        z.date(),
        z.string().transform((val, ctx) => {
            const parsed = new Date(val);
            if (Number.isNaN(parsed.getTime())) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid timestamp' });
                return z.NEVER;
            }
            return parsed;
        }),
    ])
    .refine((d) => !Number.isNaN(d.getTime()), { message: 'Invalid timestamp' });

/**
 * Schema for non-empty strings (trimmed and at least 1 character).
 */
export const nonEmptyStringSchema = z.string().trim().min(1);

/**
 * Schema for tags array, handling null/undefined as empty arrays.
 */
export const tagsSchema = z
    .union([
        z.null().transform(() => []),
        z.undefined().transform(() => []),
        z.array(nonEmptyStringSchema),
    ])
    .pipe(z.array(z.string()));

/**
 * Schema for settings section of config.yaml.
 */
const settingsSchema = z
    .object({
        outputFormat: z.enum([
            'yaml', 'json',
        ]).optional(),
        autoSummaryThreshold: z.number().int().nonnegative().optional(),
        strictLocal: z.boolean().optional(),
    })
    .strict()
    .optional();

/**
 * Schema for a single store definition.
 */
const storeDefinitionSchema = z.object({
    path: z.string().min(1, 'Store path must be a non-empty string'),
    description: z.string().optional(),
});

/**
 * Schema for stores section of config.yaml.
 */
const storesSchema = z
    .record(
        z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Store name must be a lowercase slug'),
        storeDefinitionSchema,
    )
    .optional();

/**
 * Schema for the entire config.yaml file.
 */
export const configFileSchema = z.object({
    settings: settingsSchema,
    stores: storesSchema,
});
    