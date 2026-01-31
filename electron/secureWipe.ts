import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';

export async function secureDeleteFile(filePath: string): Promise<void> {
    try {
        const stats = await fs.stat(filePath);
        const size = stats.size;

        if (size > 0) {
            // 1. Overwrite with random bytes
            const fd = await fs.open(filePath, 'r+');
            // Using a chunked approach for large files to avoid memory spikes
            const CHUNK_SIZE = 64 * 1024; // 64KB
            let bytesWritten = 0;
            
            while (bytesWritten < size) {
                const remaining = size - bytesWritten;
                const toWrite = Math.min(remaining, CHUNK_SIZE);
                const buffer = crypto.randomBytes(toWrite);
                await fs.write(fd, buffer, 0, toWrite, bytesWritten);
                bytesWritten += toWrite;
            }

            // 2. Flush buffers to physical disk
            await fs.fsync(fd);
            await fs.close(fd);
        }

        // 3. Rename to random string (destroy filename metadata)
        const dir = path.dirname(filePath);
        const randomName = crypto.randomBytes(8).toString('hex');
        const newPath = path.join(dir, randomName);
        await fs.rename(filePath, newPath);

        // 4. Delete
        await fs.unlink(newPath);
        
        console.log(`[SecureWipe] Destroyed: ${path.basename(filePath)}`);

    } catch (error) {
        console.error(`[SecureWipe] Failed to wipe ${filePath}:`, error);
        // Fallback: Try force delete if overwrite failed (better than nothing)
        await fs.remove(filePath).catch(e => console.error('Force remove failed:', e));
    }
}

export async function secureWipeSession(dirPath: string): Promise<boolean> {
    if (!fs.existsSync(dirPath)) return true;

    console.log(`[SecureWipe] Starting destruction of: ${dirPath}`);
    
    try {
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            // Recursively handle directories if we supported subfolders (Phase 1 flattened them, but good practice)
            if ((await fs.stat(fullPath)).isDirectory()) {
                 await secureWipeSession(fullPath);
            } else {
                 await secureDeleteFile(fullPath);
            }
        }

        // Remove the empty directory
        await fs.rmdir(dirPath);
        
        // Verification Phase
        if (fs.existsSync(dirPath)) {
            console.error('[SecureWipe] CRITICAL: Directory still exists after wipe!');
            return false;
        }

        console.log('[SecureWipe] Session destroyed successfully.');
        return true;
        
    } catch (error) {
        console.error('[SecureWipe] Session destruction failed:', error);
        return false;
    }
}
