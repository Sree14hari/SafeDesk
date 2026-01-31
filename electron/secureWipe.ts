import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';

const RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 300;

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(operation: () => Promise<T>, opName: string): Promise<T> {
    let lastError: any;
    for (let i = 0; i < RETRY_ATTEMPTS; i++) {
        try {
            return await operation();
        } catch (err: any) {
            lastError = err;
            if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') {
                console.log(`[SecureWipe] ${opName} locked/busy (Attempt ${i + 1}/${RETRY_ATTEMPTS}). Retrying...`);
                await sleep(RETRY_DELAY_MS);
            } else {
                throw err;
            }
        }
    }
    throw lastError;
}

export async function secureDeleteFile(filePath: string): Promise<void> {
    // If file doesn't exist, we consider it "wiped"
    if (!await fs.pathExists(filePath)) return;

    try {
        const stats = await fs.stat(filePath);
        const size = stats.size;

        if (size > 0) {
            // 1. Overwrite with random bytes
            // Ensure we handle file open/close robustly
            let fd: number | null = null;
            try {
                fd = await withRetry(() => fs.open(filePath, 'r+'), `Open ${path.basename(filePath)}`);
                
                const CHUNK_SIZE = 64 * 1024; // 64KB
                let bytesWritten = 0;
                
                while (bytesWritten < size) {
                    const remaining = size - bytesWritten;
                    const toWrite = Math.min(remaining, CHUNK_SIZE);
                    const buffer = crypto.randomBytes(toWrite);
                    await fs.write(fd, buffer, 0, toWrite, bytesWritten);
                    bytesWritten += toWrite;
                }

                await fs.fsync(fd);
            } finally {
                if (fd !== null) await fs.close(fd);
            }
        }

        // 2. Rename
        const dir = path.dirname(filePath);
        const randomName = crypto.randomBytes(8).toString('hex');
        const newPath = path.join(dir, randomName);
        
        await withRetry(() => fs.rename(filePath, newPath), 'Rename Obfuscation');

        // 3. Delete
        await withRetry(() => fs.unlink(newPath), 'Final Unlink');
        
        console.log(`[SecureWipe] DESTROYED: ${filePath}`);

    } catch (error) {
        console.error(`[SecureWipe] Failed to wipe ${filePath}:`, error);
        // Fallback: Force remove (fs-extra)
        try {
            await fs.remove(filePath);
        } catch (e) {
            console.error('[SecureWipe] Absolute failure to remove:', filePath, e);
        }
    }
}

export async function secureWipeSession(dirPath: string): Promise<boolean> {
    if (!fs.existsSync(dirPath)) return true;

    console.log(`[SecureWipe] Starting destruction of: ${dirPath}`);
    
    try {
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            if ((await fs.stat(fullPath)).isDirectory()) {
                 await secureWipeSession(fullPath);
            } else {
                 await secureDeleteFile(fullPath);
            }
        }

        // Drop the directory
        await withRetry(() => fs.rmdir(dirPath), 'Remove Session Dir');
        
        if (fs.existsSync(dirPath)) {
             // Final sanity check - sometimes slight delay in FS update
             await sleep(200);
             if (fs.existsSync(dirPath)) {
                 console.error('[SecureWipe] CRITICAL: Directory persists.');
                 return false;
             }
        }

        console.log('[SecureWipe] Clean.');
        return true;
        
    } catch (error) {
        console.error('[SecureWipe] Session destruction failed:', error);
        return false;
    }
}
