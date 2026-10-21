// ===== SUPABASE CLIENT =====
const { createClient } = window.supabase;

let supabaseClient = null;

function initSupabase() {
    if (!supabaseClient && typeof ACORE_CONFIG !== 'undefined') {
        supabaseClient = createClient(
            ACORE_CONFIG.SUPABASE_URL,
            ACORE_CONFIG.SUPABASE_KEY
        );
    }
    return supabaseClient;
}

async function supabaseLogin(email, password) {
    const client = initSupabase();
    if (!client) return { error: 'Config missing' };

    try {
        let result = await client.auth.signInWithPassword({ email, password });
        
        if (result.error) {
            result = await client.auth.signUp({ email, password });
        }
        
        return result;
    } catch (err) {
        return { error: err.message };
    }
}

async function supabaseLogout() {
    const client = initSupabase();
    if (client) await client.auth.signOut();
}

async function uploadToSupabase(file, userId) {
    const client = initSupabase();
    if (!client) return { error: 'Not initialized' };

    try {
        const fileName = `${userId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await client.storage
            .from(ACORE_CONFIG.SUPABASE_BUCKET)
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await client.from('files').insert({
            user_id: userId,
            name: file.name,
            size_mb: (file.size / 1024 / 1024).toFixed(2),
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

        return error ? [] : (data || []);
    } catch {
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
        alert('Помилка: ' + err.message);
    }
}

async function deleteFromSupabase(fileId, filePath) {
    const client = initSupabase();
    if (!client) return;

    try {
        await client.storage
            .from(ACORE_CONFIG.SUPABASE_BUCKET)
            .remove([filePath]);

        await client.from('files').delete().eq('id', fileId);
        return { success: true };
    } catch (err) {
        return { error: err.message };
    }
}
