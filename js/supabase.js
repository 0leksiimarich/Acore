// ===== SUPABASE ІНТЕГРАЦІЯ =====
let supabaseClient = null;

function initSupabase() {
    if (!supabaseClient && typeof ACORE_CONFIG !== 'undefined' && window.supabase) {
        const { createClient } = window.supabase;
        supabaseClient = createClient(
            ACORE_CONFIG.SUPABASE_URL,
            ACORE_CONFIG.SUPABASE_KEY
        );
    }
    return supabaseClient;
}

async function supabaseLogin(email, password) {
    const client = initSupabase();
    if (!client) return { error: { message: 'Supabase не ініціалізовано' } };

    try {
        let result = await client.auth.signInWithPassword({ email, password });
        
        if (result.error && result.error.message.includes('Invalid login credentials')) {
            result = await client.auth.signUp({ 
                email, 
                password,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });
        }
        
        return result;
    } catch (err) {
        return { error: { message: err.message } };
    }
}

async function supabaseLogout() {
    const client = initSupabase();
    if (client) {
        await client.auth.signOut();
    }
}

async function uploadToSupabase(file, userId) {
    const client = initSupabase();
    if (!client) return { error: 'Supabase не ініціалізовано' };

    try {
        const fileName = `${userId}/${Date.now()}-${file.name}`;
        
        const { error: uploadError } = await client.storage
            .from(ACORE_CONFIG.SUPABASE_BUCKET)
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await client
            .from('files')
            .insert({
                user_id: userId,
                name: file.name,
                size_mb: parseFloat((file.size / 1024 / 1024).toFixed(2)),
                file_path: fileName
            });

        if (dbError) throw dbError;
        
        return { success: true };
    } catch (err) {
        return { error: err.message };
    }
}

async function getFilesFromSupabase(userId) {
    const client = initSupabase();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from('files')
            .select('*')
            .eq('user_id', userId)
            .order('uploaded_at', { ascending: false });

        if (error) {
            console.error('Error getting files:', error);
            return [];
        }
        
        return data || [];
    } catch (err) {
        console.error('Error:', err);
        return [];
    }
}

async function downloadFromSupabase(filePath, fileName) {
    const client = initSupabase();
    if (!client) return;

    try {
        const { data, error } = await client.storage
            .from(ACORE_CONFIG.SUPABASE_BUCKET)
            .download(filePath);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('❌ Помилка скачування: ' + err.message);
    }
}

async function deleteFromSupabase(fileId, filePath) {
    const client = initSupabase();
    if (!client) return { error: 'Supabase не ініціалізовано' };

    try {
        const { error: deleteStorageError } = await client.storage
            .from(ACORE_CONFIG.SUPABASE_BUCKET)
            .remove([filePath]);

        if (deleteStorageError) throw deleteStorageError;

        const { error: deleteDbError } = await client
            .from('files')
            .delete()
            .eq('id', fileId);

        if (deleteDbError) throw deleteDbError;

        return { success: true };
    } catch (err) {
        return { error: err.message };
    }
}
