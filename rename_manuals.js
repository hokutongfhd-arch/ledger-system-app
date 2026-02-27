import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Setup env and client
config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in env.');
    process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function renameManuals() {
    console.log('Fetching all device manuals from DB...');
    const { data: dbManuals, error: dbError } = await supabase
        .from('device_manuals')
        .select('*');

    if (dbError) {
        console.error('Error fetching DB manuals:', dbError);
        return;
    }

    let updatedCount = 0;

    for (const manual of dbManuals) {
        if (!manual.files || !Array.isArray(manual.files)) continue;

        let needsUpdate = false;
        const newFiles = [...manual.files];

        for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i];
            if (!file.url || !file.name) continue;

            try {
                // Determine if file.name is the random one AND there's an original name in the URL params
                const urlObj = new URL(file.url);
                const pathParts = urlObj.pathname.split('/');
                const storageFileName = decodeURIComponent(pathParts[pathParts.length - 1]);

                const searchParams = urlObj.searchParams;
                const originalNameParam = searchParams.get('download') || '';

                if (originalNameParam) {
                    // Check if file.name on screen is still showing the random storage string
                    // Example storage string: 1766018561939_0soit.pdf
                    // Example original param: 利用申請書_iPhone(新規用).xls
                    if (file.name !== originalNameParam) {
                        console.log(`Fixing screen display name for Manual ID ${manual.id}. Changing '${file.name}' to '${originalNameParam}'`);
                        newFiles[i] = {
                            ...file,
                            name: originalNameParam // Assigning the proper human-readable name to the UI object
                        };
                        needsUpdate = true;
                    }
                } else if (file.name === storageFileName) {
                    // If there's NO download param, we have to strip the prefix
                    // match format: 1712341234123_abcde.ext
                    const match = file.name.match(/^17\d{11}_[a-z0-9]+\.(.+)$/);
                    if (match) {
                        // we don't know the exact original name (it might have been purely Japanese before the extension)
                        // but the extension is preserved.
                        // Usually this happens if we uploaded it blindly.
                    }
                }

            } catch (e) {
                console.error(`Error processing URL for ${file.name}:`, e);
            }
        }

        if (needsUpdate) {
            const { error: updateError } = await supabase
                .from('device_manuals')
                .update({ files: newFiles })
                .eq('id', manual.id);

            if (updateError) {
                console.error(`Error updating DB for manual ID: ${manual.id}`, updateError);
            } else {
                console.log(`Successfully updated DB for manual ID: ${manual.id}`);
                updatedCount++;
            }
        }
    }
    console.log(`Finished updating screen names. ${updatedCount} records modified.`);
}

renameManuals().catch(console.error);
