// 🅰️ superlative/zod-ménage.ts

import { z } from 'zod';
import { unserialize } from 'php-unserialize'; // 👈 1. Import the library

///////////
/// ZOD ///
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// This is our new, powerful parser for CDATA fields that might contain
// serialized PHP data.
//🔺Building Block 1: The CdataString Parser
const PhpSerializedCdata = z.preprocess((arg, ctx) => {
    // Stage 1: Unwrap the __cdata object to get the inner value.
    let value = arg;
    if (typeof value === 'object' && value !== null && '__cdata' in value) {
        value = (value as { __cdata: unknown }).__cdata;
    }

    // Stage 2: Check if the value is a string that looks like it needs parsing.
    // If not, just return it as is.
    if (typeof value !== 'string') {
        return value;
    }
    // PHP serialized data starts with a letter, a colon, and a number.
    // This check prevents us from trying to parse normal strings.
    if (!value.match(/^[a-zA-Z]:\d+:/)) {
        return value;
    }

    // Stage 3: Try to unserialize the string.
    try {
        // This is the magic! Convert the string to a JS object.
        return unserialize(value);
    } catch (e) {
        // Stage 4: If parsing fails, add a Zod issue and stop.
        ctx.addIssue({
            code: 'custom',
            message: `Failed to unserialize PHP string. Error: ${(e as Error).message}`,
        });
        return z.NEVER;
    }
}, z.any()); // The result can be anything (object, string, array), so z.any() is correct.


//🔺Building Block 1: The CdataString Parser
const CdataString = z.preprocess((arg) => {
    if (typeof arg === 'object' && arg !== null && '__cdata' in arg) {
        return (arg as { __cdata: unknown }).__cdata;
    }
    return arg;
}, z.string());

//🔺The New, Resilient Schema for pubDate
const OptionalDateSchema = z.preprocess((arg) => {
    // This is our sanitization step. If the input is an empty string,
    // we convert it to `undefined` so that .optional() can handle it.
    if (arg === '') {
        return undefined;
    }
    return arg;
}, z.string().transform((dateString, ctx) => { // The core logic remains the same
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        ctx.addIssue({
            code: 'custom',
            message: `Could not parse pubDate. The provided string was: "${dateString}"`,
        });
        return z.NEVER;
    }
    return date;
}).optional()); // We now make the entire schema optional

//🔺Building Block 1: The Email Parser
// It does the same preprocessing, but validates the result as an email.
const CdataEmail = z.preprocess((arg) => {
    if (typeof arg === 'object' && arg !== null && '__cdata' in arg) {
        return (arg as { __cdata: unknown }).__cdata;
    }
    return arg;
}, z.string().email({ message: "Invalid email address after unwrapping __cdata" }));

//🔺Building Block 2: The Key-Value Array Transformer
const TermMetaSchema = z.preprocess(
    // Some `termmeta` might not exist, so we handle undefined or ensure it's an array
    (arg) => (Array.isArray(arg) ? arg : []),
    z.array(z.object({
        meta_key: CdataString,
        meta_value: CdataString,
    }))
        .transform((metaArray) => {
            // Use reduce to turn the array into a key-value object
            return metaArray.reduce((acc, { meta_key, meta_value }) => {
                acc[meta_key] = meta_value;
                return acc;
            }, {} as Record<string, string>);
        })
);

// Now, let's create the postmeta transformer using this new parser
const PostMetaSchema = z.preprocess(
    (arg) => (Array.isArray(arg) ? arg : []),
    z.array(z.object({
        meta_key: CdataString,
        meta_value: PhpSerializedCdata, // Use our new PHP parser
    }))
        .transform((metaArray) =>
            metaArray.reduce((acc, { meta_key, meta_value }) => {
                acc[meta_key] = meta_value;
                return acc;
            }, {} as Record<string, any>)
        )
);


//🔺 The Solution: The CdataArrayOfStrings Schema
/**
 * A Zod schema that transforms an array of `__cdata` objects into a simple
 * array of strings, filtering out any empty strings.
 */
const CdataArrayOfStrings = z
    // 1. Preprocess: Ensure the input is an array. If it's missing or not an array,
    //    default to an empty array so the rest of the chain doesn't fail.
    .preprocess((arg) => (Array.isArray(arg) ? arg : []),
        // 2. Validate: Expect an array where each element is an object
        //    containing a "__cdata" key with a string value.
        z.array(
            z.object({
                __cdata: z.string(),
            })
        )
    )
    // 3. Transform: After validation, reshape the data.
    .transform((cdataObjectArray) =>
        cdataObjectArray
            // 3a. Use .map() to extract just the string value from each object.
            .map((item) => item.__cdata)
            // 3b. Use .filter() to remove any items that are just empty strings.
            .filter((str) => str !== '')
    );




//🔺ASSEMBLY
// Schema for an <item>
const ItemSchema = z.object({
    title: CdataString,
    link: z.url(),
    pubDate: OptionalDateSchema,
    encoded: CdataArrayOfStrings,
    guid: z.string(),
    post_id: z.number(),
    post_parent: z.number(),
    post_type: CdataString,
    category: CdataArrayOfStrings,
    tag: CdataArrayOfStrings,
    attachment_url: CdataString.optional(), // Not all items have this
    postmeta: PostMetaSchema, // <-- Use our complex transformer
});

// Schema for a <category>
const CategorySchema = z.object({
    term_id: z.number(),
    category_nicename: CdataString,
    category_parent: CdataString,
    cat_name: CdataString,
    termmeta: TermMetaSchema, // <-- Use our key-value transformer
});

// Schema for a <tag>
const TagSchema = z.object({
    term_id: z.number(),
    tag_slug: CdataString,
    tag_name: CdataString,
});

// Schema for the main <channel>
const ChannelSchema = z.object({
    title: z.string(),
    link: z.url(),
    description: z.string(),
    author: z.object({
        author_id: z.number(),
        author_login: CdataString,
        author_email: CdataEmail,
        author_display_name: CdataString,
    }),
    category: z.array(CategorySchema),
    tag: z.array(TagSchema),
    item: z.array(ItemSchema),
});

// The final, top-level schema for the entire file
export const WpJsonSchema = z.object({
    rss: z.object({
        channel: ChannelSchema,
    }),
});

// Infer the final, clean TypeScript type! This is your new source of truth.
export type CleanWordPressData = z.infer<typeof WpJsonSchema>;
export type CleanWordChannelData = z.infer<typeof ChannelSchema>;
export type CleanWordPressItem = z.infer<typeof ItemSchema>;