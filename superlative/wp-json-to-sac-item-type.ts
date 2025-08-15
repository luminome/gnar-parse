// 🅰️ superlative/wp-json-to-sac-item-type.ts

// import { z } from 'zod';
// import pc from 'picocolors';

import path from "path"
import fs from 'fs'

import { type CleanWordPressData, type CleanWordPressItem, WpJsonSchema, type CleanWordChannelData } from './zod-ménage'

import { keyGen, pick, timer, formatMs, get_object_size_bytes } from "./functions";

import type { JsonObject, JsonValue, SacItem, SacItemRootType } from './types';

import slugify from 'slugify';

// init timer for this.
const t = timer('parser');
t.start();


// 🔺 A helper type guard to check if a JsonValue is a JsonObject
export const isJsonObject = (value: JsonValue): value is JsonObject => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 1. Define the strong type for our nodes
type HierarchyNode = {
    uid: string;
    originalId: number;
    originalParentId: number;
    parentUid: string | null;
    childUids: string[];
};

// Define the final structure we're building
type HierarchyMap = Map<number, HierarchyNode>;

const ACCEPTED_TYPES = ['post', 'page', 'attachment', 'custom_css'];
const JSON_DATA_DIR = path.join(process.cwd(), 'dev-products', 'json-data');
const WRITE_INDIVIDUAL_ITEMS = false;

const ItemsMap: Map<string, CleanWordPressItem> = new Map();

/**
 * Builds a hierarchical map from a flat list of WordPress items.
 * @param cleanData The parsed and cleaned WordPress data.
 * @returns A Map where keys are original post IDs and values are HierarchyNode objects.
 */
export const buildHierarchy = (cleanData: CleanWordPressData): HierarchyMap => {
    /// Separate Concerns: The three - pass algorithm(Create, Connect, Order) makes the complex logic simple to read, debug, and extend.

    const items = cleanData.rss.channel.item;
    const relevantItems = items.filter((i) => ACCEPTED_TYPES.includes(i.post_type));
    // 2. Use a single, strongly-typed Map. Key is the original post_id.
    const nodeMap: HierarchyMap = new Map();
    // Create a lookup map for efficient date retrieval during the sort pass
    // const uidToDateLookup: Map<string, Date> = new Map();
    
    // --- PASS 1: Build all nodes ---
    // This loop's single responsibility is to create a node for every item.
    // We start by creating a special "root" node for items with no parent (ID 0).
    nodeMap.set(0, {
        uid: 'root',
        originalId: 0,
        originalParentId: -1, // No parent
        parentUid: null,
        childUids: [],
    });

    // GLUE:
    for (const item of relevantItems) {
        const node: HierarchyNode = {
            uid: `W${keyGen(5)}`, // Generate the new UID
            originalId: item.post_id,
            originalParentId: item.post_parent || 0, // Default parent to 0 if missing
            parentUid: null, // To be filled in the next pass
            childUids: [],   // To be filled in the next pass
        };
        nodeMap.set(item.post_id, node);
        // uidToDateLookup.set(node.uid, item.pubDate || new Date(0));
        ItemsMap.set(node.uid, item);
    }

    // --- PASS 2: Connect all nodes ---
    // This loop's single responsibility is to establish the parent-child links.
    // Because Pass 1 is complete, we can be certain all nodes exist in the map.
    for (const node of nodeMap.values()) {
        // Skip the root node itself as it has no parent
        if (node.uid === 'root') continue;
        // Find the parent node in our map using the original parent ID
        const parentNode = nodeMap.get(node.originalParentId);
        if (parentNode) {
            // Connect the child to the parent
            node.parentUid = parentNode.uid;
            // Connect the parent to the child
            parentNode.childUids.push(node.uid);
        }
    }

    // --- PASS 3 (NEW): Sort all child arrays ---
    // This runs after all links are established.
    for (const node of nodeMap.values()) {
        // No need to sort arrays with 0 or 1 elements
        if (node.childUids.length > 1) {
            node.childUids.sort((uidA, uidB) => {
                const A = ItemsMap.get(uidA);
                const B = ItemsMap.get(uidB);
                const dateA = A ? A.pubDate : new Date(0);
                const dateB = B ? B.pubDate : new Date(0);
                // const dateA = uidToDateLookup.get(uidA);
                // const dateB = uidToDateLookup.get(uidB);
                // Safety check, though our logic should prevent this
                if (!dateA || !dateB) return 0;
                // Sort descending (newest first). For ascending, swap A and B.
                return dateB.getTime() - dateA.getTime();
            });
        }
    }
    return nodeMap;
};





const add_valid = (v: JsonValue, k: string, t: JsonObject) => {
    if (v && (!Array.isArray(v) || (Array.isArray(v) && v.length > 0))) {
        t[k] = v;
    }
}

export const toSacItem = (item: CleanWordPressItem, fm: HierarchyMap):SacItem | null => {
    const h = fm.get(item.post_id);

    if (h) {
        const base_data: JsonObject = {};
        base_data.type = item.post_type;

        if (item.postmeta._wp_attachment_metadata) {
            base_data.image = pick(item.postmeta._wp_attachment_metadata, ['width', 'height', 'file']);
        }

        add_valid(item.postmeta.collection, 'collection', base_data);
        add_valid(h.childUids, 'children', base_data);

        const s:SacItem = {
            uid: h.uid,
            parentUid: h.parentUid,
            imageObject: base_data.file as string || null,
            realDate: item.pubDate ? item.pubDate.getTime() : null,
            realDateOriginal: item.pubDate ? item.pubDate.toISOString() : null,
            taxonomy: { category: ['original', ...item.category], tags:[]},
            title: item.title,
            content: item.encoded.join(''),
            data: base_data
        } 
        return s;
    }

    console.warn('no identifier found for post_id', item.post_id);
    return null;
}




const write = (data: jsonDataEntry | SacItemRootType | SacItem[], filename: string) => {
    const packet = JSON.stringify(data, null, 2);
    const file = `${filename}.json`;
    fs.mkdirSync(JSON_DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(JSON_DATA_DIR, file), packet);
    console.log(`🧻 "${file}" ${get_object_size_bytes(packet)}`);
}


type jsonDataEntry = {
    slug: string | null,
    data: CleanWordChannelData | SacItem,
    type: string | null;
    uids?: HierarchyNode
}

// 🔺 
// fucking fancy
export const main = async () => {
    const src = process.cwd();
    const json_lex_path = path.join(src, "dev-only/sac-posts-xmltojson.json");
    const dataArray: JsonObject = JSON.parse(fs.readFileSync(json_lex_path, 'utf-8'));
    
    const sac_items_all: SacItem[] = [];

    // 🔸 empty contents of JSON_DATA_DIR;
    if (fs.existsSync(JSON_DATA_DIR)) {
        fs.readdirSync(JSON_DATA_DIR).forEach(f => fs.rmSync(`${JSON_DATA_DIR}/${f}`));
    }
    

    try {
        const cleanData: CleanWordPressData = WpJsonSchema.parse(dataArray);
        const fm: HierarchyMap = buildHierarchy(cleanData);

        // console.log(fm);
        // return;
        
        // 🔸 handle root element and clean "item" payload:
        const channel = cleanData.rss.channel;
        const allItems: CleanWordPressItem[] = [...channel.item];
        channel.item = [];

        const root: SacItemRootType = {
            uids: fm.get(0)?.childUids
        };

        // 🔸 handle all elements and convert to SacItem[s]:
        for (let i = 0; i < allItems.length; i++){
            try {
                const itm: CleanWordPressItem = allItems[i];
                if (ACCEPTED_TYPES.includes(itm.post_type)) {
                    const Ts = toSacItem(itm, fm)!;
                    const TsData = Ts.data;

                    if (TsData && isJsonObject(TsData)) {
                        TsData.slug = slugify(itm.title, { lower: true })
                    }

                    if (WRITE_INDIVIDUAL_ITEMS) {
                        const Tt: jsonDataEntry = {
                            slug: slugify(itm.title, { lower: true }),
                            data: Ts as SacItem,
                            uids: fm.get(itm.post_id),
                            type: itm.post_type
                        };
                        write(Tt, Ts.uid);
                    }


                    sac_items_all.push(Ts)

                } else {
                    continue;
                }
            } catch (error) {
                console.error("❌", error);
            }
        }

        if (!WRITE_INDIVIDUAL_ITEMS) {
            write(sac_items_all, 'items');
        }

        write(root, 'root');

    } catch (error) {
        console.error("❌", error);
    }

}

main();

console.log("🧱 LMAO.", formatMs(t.stop()));




