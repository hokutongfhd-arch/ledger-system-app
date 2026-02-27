import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// .env.localから環境変数を読み込む
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in env.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function cleanupManuals() {
    console.log('Fetching all device manuals from DB...');
    const { data: dbManuals, error: dbError } = await supabase
        .from('device_manuals')
        .select('files');

    if (dbError) {
        console.error('Error fetching DB manuals:', dbError);
        return;
    }

    const registeredFileNames = new Set<string>();
    
    // The `files` column is an array of objects. We need to extract the filename from the URL.
    dbManuals.forEach(manual => {
        if (manual.files && Array.isArray(manual.files)) {
            manual.files.forEach((file: any) => {
                if (file.url) {
                    try {
                        const urlObj = new URL(file.url);
                        const pathParts = urlObj.pathname.split('/');
                        const storageFileName = decodeURIComponent(pathParts[pathParts.length - 1]);
                        registeredFileNames.add(storageFileName);
                    } catch (e) {
                         // Fallback just in case url is malformed
                         registeredFileNames.add(file.name);
                    }
                }
            });
        }
    });

    console.log(`Found ${registeredFileNames.size} registered files in DB.`);

    console.log('Fetching all files from Storage "manuals" bucket...');
    const { data: storageFiles, error: storageError } = await supabase.storage
        .from('manuals')
        .list();

    if (storageError) {
        console.error('Error fetching storage files:', storageError);
        return;
    }

    if (!storageFiles) {
        console.log('No files found in storage.');
        return;
    }

    console.log(`Found ${storageFiles.length} files in Storage.`);

    const filesToDelete: string[] = [];
    storageFiles.forEach(file => {
        // Skip hidden files or folders
        if (file.name === '.emptyFolderPlaceholder' || !file.name) return;

        if (!registeredFileNames.has(file.name)) {
            filesToDelete.push(file.name);
        }
    });

    if (filesToDelete.length === 0) {
        console.log('No orphaned files found. Storage is clean.');
        return;
    }

    console.log(`Found ${filesToDelete.length} orphaned files to delete:`);
    filesToDelete.forEach(f => console.log(` - ${f}`));

    console.log('Deleting orphaned files...');
    const { data: deleteData, error: deleteError } = await supabase.storage
        .from('manuals')
        .remove(filesToDelete);

    if (deleteError) {
        console.error('Error deleting files:', deleteError);
    } else {
        console.log(`Successfully deleted ${deleteData?.length || 0} files.`);
    }
}

cleanupManuals().catch(console.error);
