import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const RETRY_ATTEMPTS = 10;
const RETRY_DELAY_MS = 500; // Increased delay

export interface WipeResult {
    success: boolean;
    error?: string;
}

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

export async function secureDeleteFile(filePath: string): Promise<WipeResult> {
    // If file doesn't exist, we consider it "wiped"
    if (!await fs.pathExists(filePath)) return { success: true };

    try {
        // 0. Force Permissions (Windows: attrib; POSIX: chmod)
        if (process.platform === 'win32') {
            try {
                // Clear Read-Only, Hidden, System attributes
                await execPromise(`attrib -r -h -s "${filePath}"`);
            } catch (e) {
                console.warn('[SecureWipe] Failed to clear attributes:', e);
            }
        }
        
        try {
            await fs.chmod(filePath, 0o666);
        } catch (e) {
            // Ignore chmod errors
        }

        const stats = await fs.stat(filePath);
        const size = stats.size;

        if (size > 0) {
            // 1. Overwrite with random bytes
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
        return { success: true };

    } catch (error: any) {
        console.error(`[SecureWipe] Failed to wipe ${filePath}:`, error);
        
        // Fallback: Force remove (fs-extra)
        try {
            await withRetry(() => fs.remove(filePath), 'Force Remove');
            return { success: true };
        } catch (e: any) {
            console.error('[SecureWipe] fs.remove failed, trying PowerShell Force Delete:', filePath);
            try {
                // Final Resort: PowerShell Force Delete
                await execPromise(`powershell -Command "Remove-Item -LiteralPath '${filePath}' -Force"`);
                return { success: true };
            } catch (psError: any) {
                 console.error('[SecureWipe] PowerShell delete failed:', psError);
                 return { success: false, error: `${e.message} (PowerShell: ${psError.message})` };
            }
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

        await withRetry(() => fs.rmdir(dirPath), 'Remove Session Dir');
        
        if (fs.existsSync(dirPath)) {
             await sleep(200);
             if (fs.existsSync(dirPath)) return false;
        }

        console.log('[SecureWipe] Clean.');
        return true;
        
    } catch (error) {
        console.error('[SecureWipe] Session destruction failed:', error);
        return false;
    }
}
