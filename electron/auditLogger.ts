import * as fs from 'fs-extra';
import * as path from 'path';

export interface AuditEntry {
    timestamp: number;
    type: 'SESSION_START' | 'SESSION_END' | 'WIPE_SUCCESS' | 'WIPE_FAILURE' | 'RESIDUE_CLEAN';
    details: string;
}

const LOG_FILE = 'C:\\SafeDesk\\audit_log.json';

export class AuditLogger {

    constructor() {
        fs.ensureFileSync(LOG_FILE);
    }

    public async log(type: AuditEntry['type'], details: string) {
        const entry: AuditEntry = {
            timestamp: Date.now(),
            type,
            details
        };

        const line = JSON.stringify(entry) + '\n';
        
        try {
            await fs.appendFile(LOG_FILE, line);
        } catch (error) {
            console.error('[AuditLogger] Failed to write log:', error);
        }
    }

    public async getLogs(limit: number = 50): Promise<AuditEntry[]> {
        try {
            if (!fs.existsSync(LOG_FILE)) return [];
            
            const content = await fs.readFile(LOG_FILE, 'utf-8');
            const lines = content.trim().split('\n');
            
            // Return last N logs, reversed (newest first)
            return lines
                .slice(-limit)
                .map(line => {
                    try { return JSON.parse(line); } catch { return null; }
                })
                .filter(Boolean)
                .reverse();
        } catch (error) {
            console.error('[AuditLogger] Failed to read logs:', error);
            return [];
        }
    }
}
