import fs from 'fs';
import path from 'path';

const MONITOR_DIR = path.resolve('./logs/monitor');
if (!fs.existsSync(MONITOR_DIR)) {
    fs.mkdirSync(MONITOR_DIR, { recursive: true });
}

class ArticleMonitor {
    constructor() {
        this.logFiles = {
            fetch: path.join(MONITOR_DIR, 'fetch_monitor.log'),
            parse: path.join(MONITOR_DIR, 'parse_monitor.log'),
            ai: path.join(MONITOR_DIR, 'ai_monitor.log'),
            telegram: path.join(MONITOR_DIR, 'telegram_monitor.log'),
            performance: path.join(MONITOR_DIR, 'performance_monitor.log'),
            memory: path.join(MONITOR_DIR, 'memory_monitor.log')
        };
        
        // Start memory monitoring
        this.startMemoryMonitoring();
    }

    startMemoryMonitoring() {
        setInterval(() => {
            const memUsage = process.memoryUsage();
            this.logEvent(this.logFiles.memory, {
                type: 'MEMORY',
                ...memUsage,
                heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
                rssInMB: Math.round(memUsage.rss / 1024 / 1024)
            });
        }, 60000); // Check every minute
    }

    logEvent(file, event) {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = JSON.stringify({
                timestamp,
                ...event,
            });
            fs.appendFileSync(file, logEntry + '\n');
        } catch (error) {
            console.error('Error writing to log:', error);
            // Attempt to log to error file
            try {
                fs.appendFileSync(this.logFiles.performance, JSON.stringify({
                    timestamp: new Date().toISOString(),
                    type: 'LOG_ERROR',
                    error: error.message
                }) + '\n');
            } catch {
                // If all else fails, console.error
                console.error('Critical logging failure:', error);
            }
        }
    }

    // Log fetch attempts, responses, and errors
    logFetch(source, data) {
        this.logEvent(this.logFiles.fetch, {
            source,
            type: 'FETCH',
            ...data
        });
    }

    // Log HTML parsing results and extracted data
    logParse(source, data) {
        this.logEvent(this.logFiles.parse, {
            source,
            type: 'PARSE',
            ...data
        });
    }

    // Log AI processing steps and results
    logAI(source, data) {
        this.logEvent(this.logFiles.ai, {
            source,
            type: 'AI',
            ...data
        });
    }

    // Log Telegram message delivery attempts and results
    logTelegram(source, data) {
        this.logEvent(this.logFiles.telegram, {
            source,
            type: 'TELEGRAM',
            ...data
        });
    }

    // Log performance metrics
    logPerformance(source, data) {
        this.logEvent(this.logFiles.performance, {
            source,
            type: 'PERFORMANCE',
            ...data
        });
    }

    // Get daily summary
    getDailySummary() {
        const summary = {
            fetch: { success: 0, failed: 0 },
            parse: { success: 0, failed: 0 },
            ai: { success: 0, failed: 0 },
            telegram: { success: 0, failed: 0 },
            bySource: {
                ConsortiumNews: { articles: 0, errors: 0 },
                ProPublica: { articles: 0, errors: 0 },
                Truthout: { articles: 0, errors: 0 }
            }
        };

        // Implementation to aggregate logs
        // This will be called manually to analyze logs

        return summary;
    }

    // Add disk space monitoring
    checkDiskSpace() {
        try {
            const stats = fs.statSync(MONITOR_DIR);
            const dirSizeInMB = Math.round(this.getDirSize(MONITOR_DIR) / 1024 / 1024);
            
            this.logEvent(this.logFiles.performance, {
                type: 'DISK',
                dirSizeInMB,
                freeSpace: true // You might want to add proper disk space checking
            });

            // Rotate logs if they get too large
            if (dirSizeInMB > 1000) { // 1GB
                this.rotateLogs();
            }
        } catch (error) {
            console.error('Error checking disk space:', error);
        }
    }

    getDirSize(dirPath) {
        let size = 0;
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                size += stats.size;
            }
        }
        return size;
    }

    rotateLogs() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        for (const [key, file] of Object.entries(this.logFiles)) {
            try {
                if (fs.existsSync(file)) {
                    const backupFile = `${file}.${timestamp}`;
                    fs.renameSync(file, backupFile);
                }
            } catch (error) {
                console.error(`Error rotating ${key} log:`, error);
            }
        }
    }

    // Get recent monitoring events for a source
    getRecentLogs(source) {
        try {
            const fetchLogs = fs.readFileSync(this.logFiles.fetch, 'utf8')
                .split('\n')
                .filter(line => line && line.includes(source))
                .slice(-10);
            
            const parseLogs = fs.readFileSync(this.logFiles.parse, 'utf8')
                .split('\n')
                .filter(line => line && line.includes(source))
                .slice(-10);

            const fetchAttempts = fetchLogs.length;
            const parseAttempts = parseLogs.length;
            const successfulFetches = fetchLogs.filter(log => log.includes('"status":"success"')).length;
            const successfulParses = parseLogs.filter(log => log.includes('"status":"success"')).length;

            return {
                fetches: {
                    total: fetchAttempts,
                    successful: successfulFetches
                },
                parses: {
                    total: parseAttempts,
                    successful: successfulParses
                },
                successRate: ((successfulFetches + successfulParses) / (fetchAttempts + parseAttempts) * 100).toFixed(1) + '%'
            };
        } catch (error) {
            console.error('Error reading monitoring logs:', error);
            return {
                fetches: { total: 0, successful: 0 },
                parses: { total: 0, successful: 0 },
                successRate: '0%'
            };
        }
    }
}

export const monitor = new ArticleMonitor();
