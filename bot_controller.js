import TelegramBot from 'node-telegram-bot-api';
import { config } from './utils/config.js';
import { monitor } from './utils/monitoring.js';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

class BotController {
    constructor() {
        this.bot = new TelegramBot(config.telegram.botToken, { polling: true });
        this.mainProcess = null;
        this.setupCommands();
        console.log('Telegram Bot started with enhanced commands');
    }

    setupCommands() {
        // /log command - Download various log files
        this.bot.onText(/\/log( (.+))?/, async (msg, match) => {
            const chatId = msg.chat.id;
            const logType = match[2] || 'help';

            // Only allow admin chat
            if (chatId.toString() !== config.telegram.chatId) {
                await this.bot.sendMessage(chatId, 'Unauthorized access');
                return;
            }

            try {
                await this.handleLogCommand(chatId, logType);
            } catch (error) {
                console.error('Error handling log command:', error);
                await this.bot.sendMessage(chatId, `Error retrieving logs: ${error.message}`);
            }
        });

        // /stop command - Completely shut down the bot
        this.bot.onText(/\/stop/, async (msg) => {
            const chatId = msg.chat.id;

            // Only allow admin chat
            if (chatId.toString() !== config.telegram.chatId) {
                await this.bot.sendMessage(chatId, 'Unauthorized access');
                return;
            }

            try {
                await this.handleStopCommand(chatId);
            } catch (error) {
                console.error('Error handling stop command:', error);
            }
        });

        // /rerun command - Restart the entire process
        this.bot.onText(/\/rerun/, async (msg) => {
            const chatId = msg.chat.id;

            // Only allow admin chat
            if (chatId.toString() !== config.telegram.chatId) {
                await this.bot.sendMessage(chatId, 'Unauthorized access');
                return;
            }

            try {
                await this.handleRerunCommand(chatId);
            } catch (error) {
                console.error('Error handling rerun command:', error);
                await this.bot.sendMessage(chatId, `Error restarting: ${error.message}`);
            }
        });

        // /status command - Show bot status
        this.bot.onText(/\/status/, async (msg) => {
            const chatId = msg.chat.id;

            // Only allow admin chat
            if (chatId.toString() !== config.telegram.chatId) {
                await this.bot.sendMessage(chatId, 'Unauthorized access');
                return;
            }

            try {
                await this.handleStatusCommand(chatId);
            } catch (error) {
                console.error('Error handling status command:', error);
                await this.bot.sendMessage(chatId, `Error getting status: ${error.message}`);
            }
        });

        // /help command - Show available commands
        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id;

            // Only allow admin chat
            if (chatId.toString() !== config.telegram.chatId) {
                await this.bot.sendMessage(chatId, 'Unauthorized access');
                return;
            }

            await this.handleHelpCommand(chatId);
        });
    }

    async handleLogCommand(chatId, logType) {
        const logTypes = {
            'activity': {
                file: './logs/debug.log',
                name: 'activity_log.txt',
                description: 'Full activity log'
            },
            'errors': {
                file: './logs/errors.log',
                name: 'error_log.txt',
                description: 'Error log'
            },
            'articles': {
                file: './logs/new_articles.log',
                name: 'published_articles.txt',
                description: 'Published articles log'
            },
            'fetch': {
                file: './logs/monitor/fetch_monitor.log',
                name: 'fetch_monitor.txt',
                description: 'Article fetch monitoring'
            },
            'parse': {
                file: './logs/monitor/parse_monitor.log',
                name: 'parse_monitor.txt',
                description: 'Article parse monitoring'
            },
            'ai': {
                file: './logs/monitor/ai_monitor.log',
                name: 'ai_monitor.txt',
                description: 'AI processing monitoring'
            },
            'telegram': {
                file: './logs/monitor/telegram_monitor.log',
                name: 'telegram_monitor.txt',
                description: 'Telegram message monitoring'
            },
            'memory': {
                file: './logs/monitor/memory_monitor.log',
                name: 'memory_monitor.txt',
                description: 'Memory usage monitoring'
            },
            'performance': {
                file: './logs/monitor/performance_monitor.log',
                name: 'performance_monitor.txt',
                description: 'Performance monitoring'
            }
        };

        if (logType === 'help' || logType === 'list') {
            const helpText = `Available Log Types:\n\n` +
                Object.entries(logTypes).map(([key, info]) => 
                    `• /log ${key} - ${info.description}`
                ).join('\n') +
                `\n\nUsage: /log <type>\nExample: /log activity`;
            
            await this.bot.sendMessage(chatId, helpText);
            return;
        }

        const logConfig = logTypes[logType];
        if (!logConfig) {
            const availableTypes = Object.keys(logTypes).join(', ');
            await this.bot.sendMessage(chatId, 
                `Unknown log type: ${logType}\n\n` +
                `Available types: ${availableTypes}\n\n` +
                `Use /log help to see descriptions.`
            );
            return;
        }

        const logPath = path.resolve(logConfig.file);
        
        if (!fs.existsSync(logPath)) {
            await this.bot.sendMessage(chatId, `Log file not found: ${logConfig.description}`);
            return;
        }

        const stats = fs.statSync(logPath);
        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

        // Check file size (Telegram has a 50MB limit for documents)
        if (stats.size > 50 * 1024 * 1024) {
            await this.bot.sendMessage(chatId, 
                `Log file too large (${fileSizeMB}MB). ` +
                `Sending last 1000 lines instead...`
            );
            
            // Send last 1000 lines as text
            const content = fs.readFileSync(logPath, 'utf8');
            const lines = content.split('\n').slice(-1000).join('\n');
            const truncatedContent = lines.length > 4000 ? 
                '...(truncated)\n' + lines.slice(-4000) : lines;
                
            await this.bot.sendMessage(chatId, 
                `${logConfig.description} (last 1000 lines)\n\n` +
                `\`\`\`\n${truncatedContent}\n\`\`\``, 
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Send the log file as document
        await this.bot.sendMessage(chatId, 
            `Sending ${logConfig.description} (${fileSizeMB}MB)...`
        );
        
        await this.bot.sendDocument(chatId, logPath, {
            caption: `${logConfig.description}\nFile size: ${fileSizeMB}MB`
        }, {
            filename: logConfig.name,
            contentType: 'text/plain'
        });
    }

    async handleStopCommand(chatId) {
        await this.bot.sendMessage(chatId, 'Shutting down bot and all processes...');
        
        // Stop the main process if running
        if (this.mainProcess) {
            this.mainProcess.kill('SIGTERM');
            this.mainProcess = null;
        }

        // Log the shutdown
        monitor.logPerformance('Bot', {
            action: 'shutdown',
            timestamp: new Date().toISOString(),
            reason: 'manual_stop_command'
        });

        // Stop bot polling
        await this.bot.stopPolling();
        
        console.log('Bot shutdown initiated by /stop command');
        
        // Exit the process
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }

    async handleRerunCommand(chatId) {
        await this.bot.sendMessage(chatId, 'Restarting news aggregation process...');
        
        // Stop current main process if running
        if (this.mainProcess) {
            this.mainProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Log the restart
        monitor.logPerformance('Bot', {
            action: 'restart',
            timestamp: new Date().toISOString(),
            reason: 'manual_rerun_command'
        });

        try {
            // Start new main process
            this.mainProcess = spawn('node', ['main.js'], {
                stdio: ['inherit', 'pipe', 'pipe'],
                detached: false
            });

            let output = '';
            this.mainProcess.stdout.on('data', (data) => {
                output += data.toString();
                console.log(`[Main Process] ${data.toString().trim()}`);
            });

            this.mainProcess.stderr.on('data', (data) => {
                console.error(`[Main Process Error] ${data.toString().trim()}`);
            });

            this.mainProcess.on('close', (code) => {
                console.log(`Main process exited with code ${code}`);
                this.mainProcess = null;
            });

            // Wait a bit and report status
            setTimeout(async () => {
                if (this.mainProcess && !this.mainProcess.killed) {
                    await this.bot.sendMessage(chatId, 'News aggregation process restarted successfully');
                } else {
                    await this.bot.sendMessage(chatId, 'Failed to restart news aggregation process');
                }
            }, 3000);

        } catch (error) {
            await this.bot.sendMessage(chatId, `Error restarting process: ${error.message}`);
        }
    }

    async handleStatusCommand(chatId) {
        const uptime = process.uptime();
        const uptimeHours = (uptime / 3600).toFixed(1);
        const memory = process.memoryUsage();
        const memoryMB = (memory.heapUsed / 1024 / 1024).toFixed(1);

        // Check if main process is running
        const mainStatus = this.mainProcess ? 
            (this.mainProcess.killed ? 'Stopped' : 'Running') : 
            'Not started';

        // Get recent activity from logs
        let recentActivity = 'No recent activity';
        try {
            const activityLog = path.resolve('./logs/debug.log');
            if (fs.existsSync(activityLog)) {
                const content = fs.readFileSync(activityLog, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                if (lines.length > 0) {
                    const lastLine = lines[lines.length - 1];
                    recentActivity = lastLine.substring(0, 100) + '...';
                }
            }
        } catch (error) {
            recentActivity = 'Error reading activity log';
        }

        const statusText = `Bot Status Report\n\n` +
            `Uptime: ${uptimeHours} hours\n` +
            `Memory: ${memoryMB} MB\n` +
            `Main Process: ${mainStatus}\n\n` +
            `Recent Activity:\n${recentActivity}\n\n` +
            `Report Time: ${new Date().toLocaleString()}`;

        await this.bot.sendMessage(chatId, statusText);
    }

    async handleHelpCommand(chatId) {
        const helpText = `Telegram News Bot Commands\n\n` +
            `Available Commands:\n\n` +
            `• /log <type> - Download log files\n` +
            `• /log help - Show available log types\n` +
            `• /status - Show bot and process status\n` +
            `• /rerun - Restart news aggregation\n` +
            `• /stop - Shutdown bot completely\n` +
            `• /help - Show this help message\n\n` +
            `Log Types:\n` +
            `• activity - Full activity log\n` +
            `• errors - Error messages\n` +
            `• articles - Published articles\n` +
            `• fetch, parse, ai, telegram - Detailed monitoring\n\n` +
            `Examples:\n` +
            `• /log activity - Download activity log\n` +
            `• /status - Check system status\n` +
            `• /rerun - Restart if stuck`;

        await this.bot.sendMessage(chatId, helpText);
    }

    // Method to start main process from external call
    startMainProcess() {
        if (this.mainProcess) {
            console.log('Main process already running');
            return;
        }

        try {
            this.mainProcess = spawn('node', ['main.js'], {
                stdio: ['inherit', 'pipe', 'pipe'],
                detached: false
            });

            this.mainProcess.stdout.on('data', (data) => {
                console.log(`[Main Process] ${data.toString().trim()}`);
            });

            this.mainProcess.stderr.on('data', (data) => {
                console.error(`[Main Process Error] ${data.toString().trim()}`);
            });

            this.mainProcess.on('close', (code) => {
                console.log(`Main process exited with code ${code}`);
                this.mainProcess = null;
            });

            console.log('Main process started');
        } catch (error) {
            console.error('Error starting main process:', error);
        }
    }

    // Method to stop the bot gracefully
    async stop() {
        if (this.mainProcess) {
            this.mainProcess.kill('SIGTERM');
        }
        await this.bot.stopPolling();
    }
}

export { BotController };
