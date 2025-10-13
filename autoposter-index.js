#!/usr/bin/env node

/**
 * JFox Ink Whatnot Auto-Poster
 * Intelligently posts Whatnot listings to relevant social platforms
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();
const chalk = require('chalk');

class WhatnotAutoPoster {
    constructor() {
        this.app = express();
        this.discordClient = null;
        this.platforms = {
            discord: {
                enabled: false,
                servers: []
            },
            facebook: {
                enabled: false,
                groups: []
            },
            reddit: {
                enabled: false,
                subreddits: []
            }
        };
        
        // Product categories and their relevant platforms
        this.categoryMappings = {
            'trading-cards': {
                discord: ['pokemon-tcg', 'yugioh', 'mtg', 'sports-cards'],
                facebook: ['pokemon-card-collectors', 'trading-card-marketplace'],
                reddit: ['PokemonTCG', 'YuGiOhTCG', 'magicTCG', 'sportscards']
            },
            'paintings': {
                discord: ['art-community', 'original-art'],
                facebook: ['art-for-sale', 'local-artists'],
                reddit: ['Art', 'painting', 'ArtForSale']
            },
            'collectibles': {
                discord: ['collectibles', 'vintage-items'],
                facebook: ['collectors-marketplace'],
                reddit: ['collectibles', 'vintage']
            },
            'handmade': {
                discord: ['handmade-crafts', 'art-community'],
                facebook: ['handmade-marketplace', 'local-crafters'],
                reddit: ['handmade', 'crafts', 'ArtisanGifts']
            }
        };
        
        this.init();
    }

    async init() {
        console.log(chalk.green('🚀 JFox Ink Auto-Poster Starting...'));
        
        // Setup Express server for webhook/manual posting
        this.setupExpress();
        
        // Initialize Discord client if enabled
        if (process.env.DISCORD_BOT_TOKEN) {
            await this.initDiscord();
        }
        
        // Start the server
        const PORT = process.env.PORT || 3000;
        this.app.listen(PORT, () => {
            console.log(chalk.blue(`🌐 Auto-Poster running on port ${PORT}`));
            this.showMenu();
        });
    }

    setupExpress() {
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        // Main posting endpoint
        this.app.post('/post', async (req, res) => {
            try {
                const { whatnotUrl, customMessage } = req.body;
                const result = await this.processWhatnotListing(whatnotUrl, customMessage);
                res.json({ success: true, result });
            } catch (error) {
                console.error(chalk.red('❌ Posting error:'), error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Status endpoint
        this.app.get('/status', (req, res) => {
            res.json({
                platforms: this.platforms,
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        });

        // Web interface
        this.app.get('/', (req, res) => {
            res.send(this.getWebInterface());
        });
    }

    async initDiscord() {
        try {
            this.discordClient = new Client({
                intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
            });

            this.discordClient.once('ready', () => {
                console.log(chalk.green('✅ Discord bot connected'));
                this.platforms.discord.enabled = true;
            });

            await this.discordClient.login(process.env.DISCORD_BOT_TOKEN);
        } catch (error) {
            console.error(chalk.red('❌ Discord connection failed:'), error.message);
        }
    }

    async processWhatnotListing(whatnotUrl, customMessage = '') {
        console.log(chalk.yellow('📋 Processing Whatnot listing...'));
        
        // Scrape Whatnot listing data
        const listingData = await this.scrapeWhatnotListing(whatnotUrl);
        
        // Analyze product category
        const category = await this.analyzeProductCategory(listingData);
        
        // Generate posting content
        const postContent = await this.generatePostContent(listingData, customMessage);
        
        // Get relevant platforms for this category
        const relevantPlatforms = this.getRelevantPlatforms(category);
        
        // Post to all relevant platforms
        const results = await this.postToRelevantPlatforms(postContent, relevantPlatforms, whatnotUrl);
        
        return {
            listing: listingData,
            category,
            platforms: relevantPlatforms,
            results
        };
    }

    async scrapeWhatnotListing(url) {
        try {
            console.log(chalk.blue('🔍 Scraping Whatnot listing...'));
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            
            // Extract listing data (adjust selectors based on Whatnot's actual HTML structure)
            const listing = {
                title: $('h1').first().text().trim() || 'Whatnot Listing',
                description: $('.description').text().trim() || '',
                price: $('.price').text().trim() || '',
                images: [],
                seller: $('.seller-name').text().trim() || 'JFox Ink',
                category: $('.category').text().trim() || '',
                url: url
            };
            
            // Extract images
            $('img').each((i, img) => {
                const src = $(img).attr('src');
                if (src && src.includes('whatnot')) {
                    listing.images.push(src);
                }
            });
            
            return listing;
        } catch (error) {
            console.error(chalk.red('❌ Scraping error:'), error.message);
            
            // Fallback data if scraping fails
            return {
                title: 'JFox Ink Listing',
                description: 'Check out this awesome item!',
                price: '',
                images: [],
                seller: 'JFox Ink',
                category: '',
                url: url
            };
        }
    }

    async analyzeProductCategory(listingData) {
        const title = listingData.title.toLowerCase();
        const description = listingData.description.toLowerCase();
        const text = `${title} ${description}`;
        
        // Simple keyword-based categorization
        if (text.includes('pokemon') || text.includes('yugioh') || text.includes('mtg') || 
            text.includes('card') || text.includes('tcg') || text.includes('baseball')) {
            return 'trading-cards';
        }
        
        if (text.includes('painting') || text.includes('canvas') || text.includes('artwork') || 
            text.includes('acrylic') || text.includes('watercolor')) {
            return 'paintings';
        }
        
        if (text.includes('handmade') || text.includes('custom') || text.includes('craft') || 
            text.includes('diy')) {
            return 'handmade';
        }
        
        if (text.includes('vintage') || text.includes('collectible') || text.includes('rare') || 
            text.includes('antique')) {
            return 'collectibles';
        }
        
        return 'general';
    }

    async generatePostContent(listingData, customMessage) {
        const emoji = this.getCategoryEmoji(listingData);
        
        let post = `${emoji} **${listingData.title}** ${emoji}\n\n`;
        
        if (customMessage) {
            post += `${customMessage}\n\n`;
        }
        
        if (listingData.description) {
            post += `${listingData.description}\n\n`;
        }
        
        if (listingData.price) {
            post += `💰 **Price:** ${listingData.price}\n`;
        }
        
        post += `🔗 **Check it out:** ${listingData.url}\n\n`;
        post += `🎨 **Artist:** ${listingData.seller}\n`;
        post += `#JFoxInk #WhatnotFinds #Art`;
        
        return post;
    }

    getCategoryEmoji(listingData) {
        const category = listingData.category?.toLowerCase() || '';
        const title = listingData.title.toLowerCase();
        
        if (title.includes('pokemon') || category.includes('pokemon')) return '⚡';
        if (title.includes('yugioh') || category.includes('yugioh')) return '🃏';
        if (title.includes('painting') || category.includes('art')) return '🎨';
        if (title.includes('card') || category.includes('card')) return '🎯';
        
        return '✨';
    }

    getRelevantPlatforms(category) {
        return this.categoryMappings[category] || this.categoryMappings['general'] || {};
    }

    async postToRelevantPlatforms(content, platforms, originalUrl) {
        const results = [];
        
        // Post to Discord
        if (this.platforms.discord.enabled && platforms.discord) {
            for (const channelName of platforms.discord) {
                try {
                    const result = await this.postToDiscord(content, channelName);
                    results.push({ platform: 'discord', channel: channelName, success: true, result });
                } catch (error) {
                    results.push({ platform: 'discord', channel: channelName, success: false, error: error.message });
                }
            }
        }
        
        // TODO: Add Facebook posting
        // TODO: Add Reddit posting
        
        return results;
    }

    async postToDiscord(content, channelName) {
        if (!this.discordClient) {
            throw new Error('Discord client not initialized');
        }
        
        // Find channel by name across all servers the bot is in
        const channel = this.discordClient.channels.cache.find(ch => 
            ch.name === channelName && ch.type === 0 // Text channel
        );
        
        if (!channel) {
            throw new Error(`Discord channel '${channelName}' not found`);
        }
        
        const message = await channel.send(content);
        console.log(chalk.green(`✅ Posted to Discord #${channelName}`));
        
        return { messageId: message.id, channelId: channel.id };
    }

    showMenu() {
        console.log(chalk.cyan(`
╔════════════════════════════════════════╗
║        JFox Ink Auto-Poster v1.0       ║
╠════════════════════════════════════════╣
║  🌐 Web Interface: http://localhost:3000  ║
║  📋 Post endpoint: POST /post           ║
║  📊 Status: GET /status                ║
╠════════════════════════════════════════╣
║  Commands:                             ║
║  npm start - Start the server          ║
║  npm run setup - Configure platforms   ║
╚════════════════════════════════════════╝
        `));
        
        console.log(chalk.yellow('💡 Usage:'));
        console.log('1. Go to http://localhost:3000 for the web interface');
        console.log('2. Paste your Whatnot URL and click "Auto Post"');
        console.log('3. The system will analyze your listing and post to relevant platforms');
    }

    getWebInterface() {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>JFox Ink Auto-Poster</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f0f0f0; }
                .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                h1 { color: #4CAF50; text-align: center; }
                .form-group { margin: 20px 0; }
                label { display: block; margin-bottom: 5px; font-weight: bold; }
                input, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
                button { background: #4CAF50; color: white; padding: 12px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
                button:hover { background: #45a049; }
                .result { margin-top: 20px; padding: 15px; background: #e8f5e8; border-radius: 5px; display: none; }
                .error { background: #ffe8e8; color: #d32f2f; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 JFox Ink Auto-Poster</h1>
                <p>Drop your Whatnot link below and let the magic happen!</p>
                
                <div class="form-group">
                    <label>Whatnot URL:</label>
                    <input type="url" id="whatnotUrl" placeholder="https://whatnot.com/live/..." required>
                </div>
                
                <div class="form-group">
                    <label>Custom Message (optional):</label>
                    <textarea id="customMessage" rows="3" placeholder="Add your own message here..."></textarea>
                </div>
                
                <button onclick="autoPost()">🎯 Auto Post to Relevant Platforms</button>
                
                <div id="result" class="result"></div>
            </div>
            
            <script>
                async function autoPost() {
                    const url = document.getElementById('whatnotUrl').value;
                    const message = document.getElementById('customMessage').value;
                    const resultDiv = document.getElementById('result');
                    
                    if (!url) {
                        alert('Please enter a Whatnot URL');
                        return;
                    }
                    
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '🔄 Processing your listing...';
                    resultDiv.className = 'result';
                    
                    try {
                        const response = await fetch('/post', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ whatnotUrl: url, customMessage: message })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            resultDiv.innerHTML = \`
                                ✅ <strong>Successfully posted!</strong><br>
                                📦 Product: \${data.result.listing.title}<br>
                                🏷️ Category: \${data.result.category}<br>
                                📊 Posted to \${data.result.results.length} platform(s)
                            \`;
                        } else {
                            resultDiv.innerHTML = '❌ Error: ' + data.error;
                            resultDiv.className = 'result error';
                        }
                    } catch (error) {
                        resultDiv.innerHTML = '❌ Network error: ' + error.message;
                        resultDiv.className = 'result error';
                    }
                }
            </script>
        </body>
        </html>`;
    }
}

// Start the application
if (require.main === module) {
    new WhatnotAutoPoster();
}

module.exports = WhatnotAutoPoster;
