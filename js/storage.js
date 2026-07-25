// Zen Stack 3D Storage Manager
class StorageManager {
    constructor() {
        this.KEY = 'ZEN_STACK_3D_SAVE_V1';
    }

    getDefaults() {
        return {
            highScore: 0,
            coins: 0,
            selectedSkin: 'classic',
            unlockedSkins: ['classic']
        };
    }

    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return this.getDefaults();
            return { ...this.getDefaults(), ...JSON.parse(raw) };
        } catch (e) {
            console.error('Failed to load Zen Stack data:', e);
            return this.getDefaults();
        }
    }

    save(data) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save Zen Stack data:', e);
        }
    }
}

window.storageManager = new StorageManager();
