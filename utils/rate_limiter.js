class RateLimiter {
    constructor(maxRequests, timeWindow) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = new Map();
    }

    async checkLimit(key) {
        const now = Date.now();
        const windowStart = now - this.timeWindow;
        
        // Clean up old requests
        for (const [reqKey, timestamps] of this.requests.entries()) {
            this.requests.set(reqKey, timestamps.filter(time => time > windowStart));
            if (this.requests.get(reqKey).length === 0) {
                this.requests.delete(reqKey);
            }
        }

        // Check current request
        if (!this.requests.has(key)) {
            this.requests.set(key, [now]);
            return true;
        }

        const timestamps = this.requests.get(key);
        if (timestamps.length < this.maxRequests) {
            timestamps.push(now);
            return true;
        }

        // Calculate wait time
        const oldestRequest = timestamps[0];
        const waitTime = this.timeWindow - (now - oldestRequest);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Retry after waiting
        return this.checkLimit(key);
    }
}

// Create rate limiters for different services
export const rateLimiters = {
    telegram: new RateLimiter(20, 60000), // 20 requests per minute
    googleAI: new RateLimiter(60, 60000), // 60 requests per minute
    websites: new RateLimiter(30, 60000)  // 30 requests per minute
};
