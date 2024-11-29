import fs from 'fs/promises';
import path from 'path';
import { GameStorage } from '../game-server-base';

export class FileSystemStorage implements GameStorage {
    constructor(private storageDir: string) {
        // Ensure storage directory exists
        fs.mkdir(storageDir, { recursive: true }).catch(console.error);
    }

    async list({ prefix }: { prefix: string }): Promise<Map<string, any>> {
        const result = new Map<string, any>();
        try {
            const files = await fs.readdir(this.storageDir);
            for (const file of files) {
                if (file.startsWith(prefix)) {
                    const content = await fs.readFile(
                        path.join(this.storageDir, file),
                        'utf-8'
                    );
                    result.set(file, JSON.parse(content));
                }
            }
        } catch (error) {
            console.error('Error listing files:', error);
        }
        return result;
    }

    async put(key: string, value: any): Promise<void> {
        try {
            await fs.writeFile(
                path.join(this.storageDir, key),
                JSON.stringify(value)
            );
        } catch (error) {
            console.error('Error writing file:', error);
            throw error;
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await fs.unlink(path.join(this.storageDir, key));
        } catch (error) {
            console.error('Error deleting file:', error);
            throw error;
        }
    }
} 