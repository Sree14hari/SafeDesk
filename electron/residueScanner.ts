import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';
import { secureDeleteFile, WipeResult } from './secureWipe';

export interface ResidueFile {
    path: string;
    name: string;
    location: 'Desktop' | 'Downloads';
}

export interface InspectionReport {
    timestamp: number;
    foundFiles: ResidueFile[];
}

export interface CleanupReport {
    successCount: number;
    failures: string[];
}

const TARGET_EXTENSIONS = ['.pdf', '.jpg', '.png', '.jpeg', '.docx', '.xlsx'];
// Case-insensitive keywords
const SENSITIVE_KEYWORDS = [
    'aadhaar', 'aadhar', 'pan', 'resume', 'id', 'voter', 
    'passport', 'marklist', 'certificate', 'ration', 'cv', 'biodata', 'license'
];

export class ResidueScanner {

    private desktopPath: string;
    private downloadsPath: string;

    constructor() {
        this.desktopPath = app.getPath('desktop');
        this.downloadsPath = app.getPath('downloads');
    }

    public async scan(): Promise<InspectionReport> {
        const foundFiles: ResidueFile[] = [];

        console.log(`[ResidueScanner] Scanning Desktop: ${this.desktopPath}`);
        foundFiles.push(...await this.scanDirectory(this.desktopPath, 'Desktop'));

        console.log(`[ResidueScanner] Scanning Downloads: ${this.downloadsPath}`);
        foundFiles.push(...await this.scanDirectory(this.downloadsPath, 'Downloads'));

        return {
            timestamp: Date.now(),
            foundFiles
        };
    }

    private async scanDirectory(dirPath: string, location: 'Desktop' | 'Downloads'): Promise<ResidueFile[]> {
        const results: ResidueFile[] = [];
        try {
            if (!await fs.exists(dirPath)) return [];

            const files = await fs.readdir(dirPath);
            
            for (const file of files) {
                const fullPath = path.join(dirPath, file);
                try {
                    const stats = await fs.stat(fullPath);
                    if (stats.isDirectory()) continue; // Skip directories (too deep)

                    if (this.isSensitive(file)) {
                        results.push({
                            path: fullPath,
                            name: file,
                            location
                        });
                    }
                } catch (e) {
                    // Ignore access errors
                }
            }
        } catch (error) {
            console.error(`[ResidueScanner] Error scanning ${location}:`, error);
        }
        return results;
    }

    private isSensitive(filename: string): boolean {
        const lowerName = filename.toLowerCase();
        const ext = path.extname(lowerName);

        // 1. Extension Check
        if (!TARGET_EXTENSIONS.includes(ext)) return false;

        // 2. Keyword Check
        return SENSITIVE_KEYWORDS.some(kw => lowerName.includes(kw));
    }

    public async clean(files: ResidueFile[]): Promise<CleanupReport> {
        let successCount = 0;
        const failures: string[] = [];

        console.log(`[ResidueScanner] Cleaning ${files.length} detected files...`);

        for (const file of files) {
            const result = await secureDeleteFile(file.path);
            if (result.success) {
                successCount++;
            } else {
                failures.push(`${file.name} (${result.error})`);
            }
        }

        return { successCount, failures };
    }
}
