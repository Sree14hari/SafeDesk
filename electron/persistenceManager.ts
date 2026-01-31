import * as fs from 'fs-extra';
import * as path from 'path';

const STORE_FILE = 'C:\\SafeDesk\\session-store.json';

export interface PersistentState {
    lastSessionId: string | null;
    status: 'ACTIVE' | 'ENDED' | 'WIPE_FAILED';
    path: string | null;
    timestamp: number;
}

export class PersistenceManager {
    constructor() {
        fs.ensureDirSync(path.dirname(STORE_FILE));
        if (!fs.existsSync(STORE_FILE)) {
            this.saveState({ lastSessionId: null, status: 'ENDED', path: null, timestamp: Date.now() });
        }
    }

    public syncSave_State(state: PersistentState) {
        try {
            fs.writeJsonSync(STORE_FILE, state);
        } catch (error) {
            console.error('[Persistence] Failed to save state:', error);
        }
    }
    
    // Using simple synchronous writes for safety/atomic-like behavior in this MVP context
    public saveState(state: PersistentState) {
        this.syncSave_State(state);
    }

    public loadState(): PersistentState {
        try {
            return fs.readJsonSync(STORE_FILE);
        } catch (error) {
            console.error('[Persistence] Failed to load state, resetting:', error);
            return { lastSessionId: null, status: 'ENDED', path: null, timestamp: Date.now() };
        }
    }
}
