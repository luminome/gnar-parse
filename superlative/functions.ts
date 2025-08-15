import path from "path"
import fs from 'fs'
import type { item, generic } from './types.ts'

/**
 * Converts PHP serialized CDATA string to valid JSON
 * @param cdataString - The PHP serialized string from CDATA
 * @returns Parsed JSON object
 */
export function parseCDataToJson(cdataString: string): any {
  // Remove the outer quotes if present and clean up the string
  let cleanString = cdataString.trim();
  if (cleanString.startsWith("'") && cleanString.endsWith("'")) {
    cleanString = cleanString.slice(1, -1);
  }
  
  // Remove line breaks and normalize whitespace
  cleanString = cleanString.replace(/\s+/g, ' ').trim();
  
  // Fix the malformed serialized format by adding missing semicolons and fixing spacing
  cleanString = cleanString.replace(/a: (\d+): \{/g, 'a:$1:{');
  cleanString = cleanString.replace(/s: (\d+): "/g, 's:$1:"');
  cleanString = cleanString.replace(/i: (\d+);/g, 'i:$1;');
  cleanString = cleanString.replace(/";s:/g, '";s:');
  cleanString = cleanString.replace(/;a:/g, ';a:');
  cleanString = cleanString.replace(/}s:/g, '}s:');
  cleanString = cleanString.replace(/}a:/g, '}a:');
  
  console.log('Cleaned string preview:', cleanString.substring(0, 200) + '...');
  
  // Parse PHP serialized format
  function parsePhpSerialized(str: string, index: number = 0): { value: any; nextIndex: number } {
    // Skip whitespace
    while (index < str.length && /\s/.test(str[index])) {
      index++;
    }
    
    if (index >= str.length) {
      throw new Error('Unexpected end of string');
    }
    
    const char = str[index];
    
    switch (char) {
      case 'a': {
        // Array format: a:length:{...}
        const match = str.substring(index).match(/^a:(\d+):\{/);
        if (!match) {
          throw new Error(`Invalid array format at position ${index}: "${str.substring(index, index + 20)}"`);
        }
        
        const length = parseInt(match[1]);
        let currentIndex = index + match[0].length;
        const result: any = {};
        
        for (let i = 0; i < length; i++) {
          // Parse key
          const keyResult = parsePhpSerialized(str, currentIndex);
          currentIndex = keyResult.nextIndex;
          
          // Parse value
          const valueResult = parsePhpSerialized(str, currentIndex);
          currentIndex = valueResult.nextIndex;
          
          result[keyResult.value] = valueResult.value;
        }
        
        // Skip closing brace
        while (currentIndex < str.length && str[currentIndex] !== '}') {
          currentIndex++;
        }
        if (str[currentIndex] === '}') {
          currentIndex++;
        }
        
        return { value: result, nextIndex: currentIndex };
      }
      
      case 's': {
        // String format: s:length:"value"
        const match = str.substring(index).match(/^s:(\d+):"(.*?)"/);
        if (!match) {
          throw new Error(`Invalid string format at position ${index}: "${str.substring(index, index + 30)}"`);
        }
        
        const expectedLength = parseInt(match[1]);
        let value = match[2];
        
        // Handle cases where the string might contain quotes or special characters
        if (value.length < expectedLength) {
          // Try to find the actual end of the string by counting characters
          const startQuote = str.indexOf('"', index + match[0].indexOf('"'));
          value = str.substring(startQuote + 1, startQuote + 1 + expectedLength);
        }
        
        const nextIndex = index + `s:${expectedLength}:"${value}"`.length;
        // Skip semicolon if present
        const finalIndex = str[nextIndex] === ';' ? nextIndex + 1 : nextIndex;
        
        return { value, nextIndex: finalIndex };
      }
      
      case 'i': {
        // Integer format: i:value;
        const match = str.substring(index).match(/^i:(-?\d+);/);
        if (!match) {
          throw new Error(`Invalid integer format at position ${index}: "${str.substring(index, index + 20)}"`);
        }
        
        const value = parseInt(match[1]);
        const nextIndex = index + match[0].length;
        
        return { value, nextIndex };
      }
      
      default:
        throw new Error(`Unsupported PHP serialized type: '${char}' at position ${index}. Context: "${str.substring(Math.max(0, index - 10), index + 20)}"`);
    }
  }
  
  try {
    const result = parsePhpSerialized(cleanString);
    return result.value;
  } catch (error) {
    console.error('Error parsing CDATA string:', error);
    console.error('String context around error:', cleanString.substring(0, 500));
    throw error;
  }
}


const filtered = (array:string[]) => array.filter(function (el) {
  return el != null && el != '';
});

export const flatten_encoded = (cf: []): string | undefined => {
  const agg: string[] = [];
  for (let i = 0; i < cf.length; i++) {
    agg.push(`${Object.values(cf[i])}`);
  }

  const b = filtered(agg).join('\n');
  console.log([b]);

  return b != "" ? b : undefined;
}

// const dateWorker = new Date;

const timestamp = (d: string) => {
  const cd = new Date(d);
  return cd.getTime();
}

export const date_sort = (e:item[]) => {
  e.sort((a, b) => timestamp(a.date) - timestamp(b.date));
}



//🅾️ /// how many copies of this function are there ?!
export async function loader(list: string[][]): Promise<generic> {
  const container: Promise<string | void>[] = [];
  list.forEach((a: string[]) => {
    const part = fetch(`${a[1]}`)
      .then(r => a[1].indexOf('.json') === -1 ? r.text() : r.json())
      .catch((error) => { console.error(a, error) });
    container.push(part);
  });
  const dict: generic = {};
  const done = await Promise.all(container);
  list.forEach((a: string[], n) => dict[a[0]] = done[n]);
  return dict;
}



export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!+bytes) return '0 Bytes';
  const k = 1000; // 1024
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatMs(ms: number, decimals: number = 3): string {
  if (!+ms) return '0 ms';
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['ms', 'secs', 'mins', 'hrs', 'days'];
  const scales = [1, 1000, 60000, 3600000, 86400000];
  let i = 0;
  if (ms >= 1000) i = 1;
  if (ms >= 60000) i = 2;
  if (ms >= 3600000) i = 3;
  if (ms >= 86400000) i = 4;
  return `${i === 0 ? ms : (ms / scales[i]).toFixed(dm)} ${sizes[i]}`;
}

export function keyGen(len: number = 6): string {
  return (Math.random() + 1).toString(36).substring(2, 2 + len).toUpperCase();
}



export type timer_model = {
  var_name: string,
  T0: Date,
  T1: number;
  T2: number;
  start: Function;
  stop: Function;
};

export const timer = (var_name: string): timer_model => {
  function start() {
    T.T1 = Date.now();
    return T;
  }
  function stop() {
    T.T2 = Date.now() - T.T1;
    return T.T2;
  }
  const T = {
    var_name: var_name,
    T0: new Date(),
    T1: 0.0,
    T2: 0.0,
    start,
    stop,
  }
  return T
}

export const newEL = (tag: string, prop?: { [key: string]: string }, cla?: string | string[]): HTMLElement => {
    const el = document.createElement(tag);
    Object.assign(el, prop);
    // console.console.log(typeof cla);
    if (cla !== undefined) {
        const kpa = cla && typeof cla === 'string' ? [cla,] : [...cla as string[]];
        cla && el.classList.add(...kpa);
    }
    return el;
}


export const get_object_size_bytes = (obj: unknown) => formatBytes(new Blob([JSON.stringify(obj)]).size, 2);






/**
 * Converts the CDATA file to JSON and optionally saves it
 */
export function convertCDataFile(): void {
  try {
    const cdataPath = path.join(process.cwd(), 'backend/cdata.txt');
    const cdataContent = fs.readFileSync(cdataPath, 'utf-8');
    
    const jsonResult = parseCDataToJson(cdataContent);
    console.log('Converted CDATA to JSON:', JSON.stringify(jsonResult, null, 2));
    
    // Optionally save to file
    const outputPath = path.join(process.cwd(), 'backend/cdata-converted.json');
    fs.writeFileSync(outputPath, JSON.stringify(jsonResult, null, 2));
    console.log(`JSON saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error converting CDATA file:', error);
  }
}

// Uncomment the line below to run the conversion
// convertCDataFile();





//🔁 how many copies of this function are there ?!
class HttpError extends Error {
  response: Response;
  constructor(response: Response) {
    super(`HTTP error! Status: ${response.status}`);
    this.name = 'HttpError';
    this.response = response;
  }
}

//🔁 Our generic API client function
async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const defaultHeaders: { [key: string]: string } = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  // if (token) defaultHeaders['Authorization'] = `Bearer ${token}`;
  const config: RequestInit = {
    ...options, // Allow overriding defaults
    headers: {
      ...defaultHeaders,
      ...options?.headers,
    },
  };
  const response = await fetch(endpoint, config);
  if (!response.ok) {
    throw new HttpError(response);
  }
  return response.json() as Promise<T>;
}


// 🔁 NEW GENERIC WRAPPER FUNCTION
export async function fetchWithHandling<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T | null> {
  try {
    // We pass the generic type and arguments directly to our apiClient
    const data = await apiClient<T>(endpoint, options);
    return data;
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(`HTTP Error ${error.response.status} for endpoint: ${endpoint}`);
    } else {
      console.error(`A network or unexpected error occurred for endpoint: ${endpoint}`, error);
    }
    return null;
  }
}




//🔺 PICK THIS !
/**
 * Creates a new object with specified keys picked from a source object.
 * @param obj The source object.
 * @param keys An array of key names to pick.
 */
export const pick = <T extends object, K extends keyof T> (obj: T, keys: K[]): Pick<T, K> => {
  const newObj = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      newObj[key] = obj[key];
    }
  });
  return newObj;
}

/*
// --- How to use it ---
const pm = firstItemPostMeta._wp_attachment_metadata;
const keysToPick = ['width', 'height', 'file'];
const pk = pick(pm, keysToPick);
*/