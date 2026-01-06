/**
 * Formats a zip code string into "XXX-XXXX" format.
 * If the input already contains a hyphen, it returns it as is (normalized).
 * If the input is a 7-digit numeric string, it inserts a hyphen.
 * @param zip The zip code string to format.
 * @returns Formatted zip code or original string if it doesn't match 7 digits.
 */
export const formatZipCode = (zip: string | null | undefined): string => {
    if (!zip) return '';

    // Remove non-numeric characters to check length
    const digits = zip.replace(/[^0-9]/g, '');

    if (digits.length === 7) {
        return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }

    return zip;
};
