// types.ts


export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]   // <-- Can be an array of any other JsonValue
    | { [key: string]: JsonValue }; // <-- Can be an object with JsonValue properties

/**
 * A type specifically for a JSON object structure.
 * This is often the type you'll use for function parameters or return types.
 */
export type JsonObject = {
    [key: string]: JsonValue;
};


export interface SacItem {
    uid: string;
    parentUid: string | null;
    imageObject: string | null;
    realDate: number | null;
    realDateOriginal: string | null;
    taxonomy: JsonObject | null;
    title: string | null;
    content: string | null;
    data: JsonObject | null;
}


export type SacItemRootType = {
    uids: string[] | undefined;
}





// // Schema for the main <channel>
// const ChannelSchema = z.object({
//     title: z.string(),
//     link: z.url(),
//     description: z.string(),
//     author: z.object({
//         author_id: z.number(),
//         author_login: CdataString,
//         author_email: CdataEmail,
//         author_display_name: CdataString,
//     }),
//     category: z.array(CategorySchema),
//     tag: z.array(TagSchema),
//     item: z.array(ItemSchema),
// });

// }









export type dbMeta = {
    "tags": string[];
    "categories": string[];
    "items": JsonObject[];
}

export type item = {
    'accept': Boolean,
    'uid': string,
    'pid': number,
    'date': string,
    'title': string,
    'link': string,
    'type': string,
    'data': { [key: string]: string | string[] | number | undefined },
}

export type generic = { [key: string]: generic | unknown | undefined };