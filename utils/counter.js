export class FetchCounter {
    constructor() {
        this.counts = {
            'ProPublica': 0,
            'Truthout': 0,
            'ConsortiumNews': 0
        };
        this.lastPrint = {
            'ProPublica': 0,
            'Truthout': 0,
            'ConsortiumNews': 0
        };
    }

    increment(source) {
        this.counts[source]++;
        // Only print if count has changed and it's been at least 10 fetches since last print
        if (this.counts[source] - this.lastPrint[source] >= 10) {
            console.clear(); // Clear console to keep it clean
            Object.entries(this.counts).forEach(([src, count]) => {
                console.log(`Successfully fetched ${src}: ${count} times`);
            });
            this.lastPrint[source] = this.counts[source];
        }
    }
}

export class Stats {
    constructor() {
        this.reset();
    }

    reset() {
        this.stats = {
            fetches: {
                'ProPublica': 0,
                'Truthout': 0,
                'ConsortiumNews': 0
            },
            newArticles: {
                'ProPublica': 0,
                'Truthout': 0,
                'ConsortiumNews': 0
            },
            aiMessages: 0,
            telegramMessages: 0
        };
    }

    incrementFetch(source) {
        this.stats.fetches[source]++;
        this.logStats();
    }

    addNewArticles(source, count) {
        this.stats.newArticles[source] += count;
        this.logStats();
    }

    incrementAiMessages() {
        this.stats.aiMessages++;
        this.logStats();
    }

    incrementTelegramMessages() {
        this.stats.telegramMessages++;
        this.logStats();
    }

    getTotalNewArticles() {
        return Object.values(this.stats.newArticles).reduce((a, b) => a + b, 0);
    }

    logStats() {
        console.clear();
        console.log('=== CURRENT STATISTICS ===');
        console.log(`Fetches - ConsortiumNews: ${this.stats.fetches['ConsortiumNews']}`);
        console.log(`Fetches - ProPublica: ${this.stats.fetches['ProPublica']}`);
        console.log(`Fetches - Truthout: ${this.stats.fetches['Truthout']}`);
        console.log(`New articles found: ${this.getTotalNewArticles()}`);
        console.log(`AI messages generated: ${this.stats.aiMessages}`);
        console.log(`Telegram messages sent: ${this.stats.telegramMessages}`);
    }
}

// Create a singleton instance
export const globalStats = new Stats();
