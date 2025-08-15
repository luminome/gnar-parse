// File: php-unserialize.d.ts

/**
 * Declares the module 'php-unserialize' for TypeScript.
 */
declare module 'php-unserialize' {
    /**
     * Unserializes a string from PHP's serialize() format into a JavaScript value.
     *
     * @param data The serialized string to be unserialized.
     * @returns The unserialized JavaScript value. The type is `any` because a
     *          serialized string can represent any PHP type (string, number,
     *          boolean, array, object, null).
     */
    export function unserialize(data: string): any;
}