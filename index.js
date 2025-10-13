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
            },
            'general': {
                discord: ['general', 'marketplace'],
                facebook: ['general-marketplace'],
                reddit: ['Art', 'crafts']
            }
        };
        
        this.init();
    }

    async init() {
        console.log(chalk.green('🚀 JFox Ink Auto-Poster Starting...'));
        
        // Setup Express server for webhook/manual posting
        this.setupExpress();
        
        // Initialize Discord client if enabled (non-blocking)
        if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_BOT_TOKEN !== 'your_discord_bot_token_here') {
            this.initDiscord().catch(error => {
                console.error(chalk.red('❌ Discord initialization failed:'), error.message);
            });
        }
        
        // Start the server
        const PORT = process.env.PORT || 3000;
        this.app.listen(PORT, (error) => {
            if (error) {
                console.error(chalk.red('❌ Server failed to start:'), error);
                return;
            }
            console.log(chalk.blue(`🌐 Auto-Poster running on port ${PORT}`));
            this.showMenu();
        }).on('error', (error) => {
            console.error(chalk.red('❌ Server error:'), error);
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

        // Manual listing input endpoint for when scraping fails
        this.app.post('/manual', async (req, res) => {
            try {
                const { whatnotUrl, title, description, price, customMessage } = req.body;
                
                // Create listing from manual input
                const listingData = {
                    title: title || 'Manual Listing',
                    description: description || '',
                    price: price || '',
                    images: [],
                    seller: 'JFox Ink',
                    category: '',
                    url: whatnotUrl
                };
                
                // Analyze product category
                const category = await this.analyzeProductCategory(listingData);
                
                // Generate posting content
                const postContent = await this.generatePostContent(listingData, customMessage);
                
                // Get relevant platforms for this category
                const relevantPlatforms = this.getRelevantPlatforms(category);
                
                // Post to all relevant platforms
                const results = await this.postToRelevantPlatforms(postContent, relevantPlatforms, whatnotUrl);
                
                res.json({ 
                    success: true, 
                    result: {
                        listing: listingData,
                        category,
                        platforms: relevantPlatforms,
                        results
                    }
                });
            } catch (error) {
                console.error(chalk.red('❌ Manual posting error:'), error.message);
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
            console.log(chalk.yellow('🎮 Initializing Discord bot...'));
            
            this.discordClient = new Client({
                intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
            });

            this.discordClient.once('ready', () => {
                console.log(chalk.green('✅ Discord bot connected'));
                this.platforms.discord.enabled = true;
            });

            this.discordClient.on('error', (error) => {
                console.error(chalk.red('❌ Discord client error:'), error.message);
            });

            // Set a timeout for Discord login
            const loginTimeout = setTimeout(() => {
                console.log(chalk.yellow('⚠️ Discord login timeout, continuing without Discord'));
                this.discordClient = null;
            }, 10000);

            await this.discordClient.login(process.env.DISCORD_BOT_TOKEN);
            clearTimeout(loginTimeout);
            
        } catch (error) {
            console.error(chalk.red('❌ Discord connection failed:'), error.message);
            this.discordClient = null;
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
            
            // Try multiple scraping approaches
            let listing = await this.tryAdvancedScraping(url);
            
            if (!listing) {
                listing = await this.tryBasicScraping(url);
            }
            
            if (!listing) {
                listing = this.createFallbackListing(url);
            }
            
            // Enhance with URL analysis if scraping failed
            if (listing.title === 'JFox Ink Listing') {
                listing = this.enhanceFromUrl(url, listing);
            }
            
            return listing;
            
        } catch (error) {
            console.error(chalk.red('❌ Scraping error:'), error.message);
            return this.createFallbackListing(url);
        }
    }

    async tryAdvancedScraping(url) {
        try {
            // Multiple user agents to try
            const userAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            ];

            for (const userAgent of userAgents) {
                try {
                    console.log(chalk.yellow(`🔄 Trying user agent: ${userAgent.split(' ')[0]}...`));
                    
                    const response = await axios.get(url, {
                        headers: {
                            'User-Agent': userAgent,
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Connection': 'keep-alive',
                            'Upgrade-Insecure-Requests': '1',
                            'Sec-Fetch-Dest': 'document',
                            'Sec-Fetch-Mode': 'navigate',
                            'Sec-Fetch-Site': 'none',
                            'Cache-Control': 'max-age=0'
                        },
                        timeout: 15000,
                        maxRedirects: 5,
                        validateStatus: (status) => status < 400
                    });
                    
                    if (response.data && response.data.length > 100) {
                        console.log(chalk.green('✅ Successfully fetched page data'));
                        return this.extractListingData(response.data, url);
                    }
                } catch (error) {
                    console.log(chalk.yellow(`⚠️ User agent failed: ${error.response?.status || error.message}`));
                    continue;
                }
            }
            
            return null;
        } catch (error) {
            console.log(chalk.red('❌ Advanced scraping failed:', error.message));
            return null;
        }
    }

    async tryBasicScraping(url) {
        try {
            console.log(chalk.yellow('🔄 Trying basic scraping approach...'));
            
            // Simple fetch with minimal headers
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'PostmanRuntime/7.32.0'
                },
                timeout: 10000
            });
            
            return this.extractListingData(response.data, url);
        } catch (error) {
            console.log(chalk.red('❌ Basic scraping failed:', error.message));
            return null;
        }
    }

    extractListingData(html, url) {
        const $ = cheerio.load(html);
        
        // Multiple selectors to try for each field
        const titleSelectors = [
            'h1',
            '[data-testid="title"]',
            '.listing-title',
            '.title',
            'title',
            '[class*="title"]',
            '[class*="heading"]'
        ];
        
        const descriptionSelectors = [
            '.description',
            '[data-testid="description"]',
            '.listing-description',
            '[class*="description"]',
            'meta[name="description"]',
            '.content',
            '.details'
        ];
        
        const priceSelectors = [
            '.price',
            '[data-testid="price"]',
            '.listing-price',
            '[class*="price"]',
            '.cost',
            '.amount'
        ];
        
        const sellerSelectors = [
            '.seller-name',
            '[data-testid="seller"]',
            '.username',
            '.host',
            '[class*="seller"]',
            '[class*="user"]'
        ];

        // Extract title
        let title = '';
        for (const selector of titleSelectors) {
            const element = $(selector).first();
            if (selector === 'meta[name="description"]') {
                title = element.attr('content') || '';
            } else {
                title = element.text().trim();
            }
            if (title && title.length > 3) break;
        }
        
        // Extract description
        let description = '';
        for (const selector of descriptionSelectors) {
            const element = $(selector).first();
            if (selector === 'meta[name="description"]') {
                description = element.attr('content') || '';
            } else {
                description = element.text().trim();
            }
            if (description && description.length > 10) break;
        }
        
        // Extract price
        let price = '';
        for (const selector of priceSelectors) {
            price = $(selector).first().text().trim();
            if (price && (price.includes('$') || price.includes('price'))) break;
        }
        
        // Extract seller
        let seller = 'JFox Ink';
        for (const selector of sellerSelectors) {
            const sellerText = $(selector).first().text().trim();
            if (sellerText && sellerText.length > 1) {
                seller = sellerText;
                break;
            }
        }
        
        // Extract images
        const images = [];
        $('img').each((i, img) => {
            const src = $(img).attr('src');
            if (src && (src.includes('http') || src.startsWith('//'))) {
                images.push(src.startsWith('//') ? 'https:' + src : src);
            }
        });

        const listing = {
            title: title || 'Whatnot Listing',
            description: description || '',
            price: price || '',
            images: images,
            seller: seller,
            category: '',
            url: url
        };

        console.log(chalk.green('✅ Extracted listing data:'));
        console.log(chalk.cyan(`Title: ${listing.title}`));
        console.log(chalk.cyan(`Description: ${listing.description.substring(0, 100)}...`));
        console.log(chalk.cyan(`Price: ${listing.price}`));
        console.log(chalk.cyan(`Seller: ${listing.seller}`));
        
        return listing;
    }

    enhanceFromUrl(url, baseListing) {
        try {
            console.log(chalk.yellow('🔍 Enhancing from URL analysis...'));
            
            // Extract information from URL patterns
            const urlLower = url.toLowerCase();
            let enhancedTitle = baseListing.title;
            let enhancedDescription = baseListing.description;
            
            // Common Whatnot URL patterns
            if (urlLower.includes('pokemon')) {
                enhancedTitle = 'Pokemon TCG Cards';
                enhancedDescription = 'Check out these amazing Pokemon trading cards!';
            } else if (urlLower.includes('yugioh') || urlLower.includes('yu-gi-oh')) {
                enhancedTitle = 'Yu-Gi-Oh Trading Cards';
                enhancedDescription = 'Rare Yu-Gi-Oh cards and collectibles!';
            } else if (urlLower.includes('mtg') || urlLower.includes('magic')) {
                enhancedTitle = 'Magic The Gathering Cards';
                enhancedDescription = 'MTG cards and booster packs!';
            } else if (urlLower.includes('art') || urlLower.includes('painting')) {
                enhancedTitle = 'Original Artwork';
                enhancedDescription = 'Beautiful original art pieces!';
            } else if (urlLower.includes('vintage') || urlLower.includes('collectible')) {
                enhancedTitle = 'Vintage Collectibles';
                enhancedDescription = 'Rare vintage collectible items!';
            } else if (urlLower.includes('handmade') || urlLower.includes('craft')) {
                enhancedTitle = 'Handmade Crafts';
                enhancedDescription = 'Beautiful handcrafted items!';
            }
            
            return {
                ...baseListing,
                title: enhancedTitle,
                description: enhancedDescription
            };
        } catch (error) {
            console.log(chalk.yellow('⚠️ URL enhancement failed:', error.message));
            return baseListing;
        }
    }

    createFallbackListing(url) {
        console.log(chalk.yellow('📝 Creating fallback listing...'));
        
        return {
            title: 'JFox Ink Listing',
            description: 'Check out this awesome item! Visit the link to see more details.',
            price: '',
            images: [],
            seller: 'JFox Ink',
            category: '',
            url: url
        };
    }

    async analyzeProductCategory(listingData) {
        const title = listingData.title.toLowerCase();
        const description = listingData.description.toLowerCase();
        const text = `${title} ${description}`;
        
        // Enhanced keyword-based categorization with more specific matches
        const tradingCardKeywords = ['pokemon', 'yugioh', 'mtg', 'magic the gathering', 'card', 'tcg', 'baseball', 'football', 'basketball', 'sports card', 'booster', 'pack'];
        const paintingKeywords = ['painting', 'canvas', 'artwork', 'acrylic', 'watercolor', 'oil painting', 'art', 'original art', 'hand painted'];
        const handmadeKeywords = ['handmade', 'custom', 'craft', 'diy', 'artisan', 'handcrafted', 'made to order'];
        const collectibleKeywords = ['vintage', 'collectible', 'rare', 'antique', 'limited edition', 'exclusive'];
        
        if (tradingCardKeywords.some(keyword => text.includes(keyword))) {
            return 'trading-cards';
        }
        
        if (paintingKeywords.some(keyword => text.includes(keyword))) {
            return 'paintings';
        }
        
        if (handmadeKeywords.some(keyword => text.includes(keyword))) {
            return 'handmade';
        }
        
        if (collectibleKeywords.some(keyword => text.includes(keyword))) {
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
        
        if (listingData.description && listingData.description.length > 0) {
            // Truncate description if too long
            const maxDescLength = 200;
            let desc = listingData.description;
            if (desc.length > maxDescLength) {
                desc = desc.substring(0, maxDescLength) + '...';
            }
            post += `${desc}\n\n`;
        }
        
        if (listingData.price && listingData.price.length > 0) {
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
        if (title.includes('mtg') || title.includes('magic')) return '🎭';
        if (title.includes('painting') || category.includes('art')) return '🎨';
        if (title.includes('card') || category.includes('card')) return '🎯';
        if (title.includes('vintage') || title.includes('collectible')) return '🏆';
        if (title.includes('handmade') || title.includes('custom')) return '✋';
        
        return '✨';
    }

    getRelevantPlatforms(category) {
        return this.categoryMappings[category] || this.categoryMappings['general'];
    }

    async postToRelevantPlatforms(content, platforms, originalUrl) {
        const results = [];
        
        // Post to Discord
        if (this.platforms.discord.enabled && platforms.discord) {
            for (const channelName of platforms.discord) {
                try {
                    const result = await this.postToDiscord(content, channelName);
                    results.push({ platform: 'discord', channel: channelName, success: true, result });
                    console.log(chalk.green(`✅ Posted to Discord #${channelName}`));
                } catch (error) {
                    console.error(chalk.red(`❌ Failed to post to Discord #${channelName}:`), error.message);
                    results.push({ platform: 'discord', channel: channelName, success: false, error: error.message });
                }
                
                // Add delay between posts to avoid rate limiting
                await this.delay(2000);
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
        
        if (!this.discordClient.isReady()) {
            throw new Error('Discord client not ready');
        }
        
        // Find channel by name across all servers the bot is in
        const channel = this.discordClient.channels.cache.find(ch => 
            ch.name === channelName && ch.type === 0 // Text channel
        );
        
        if (!channel) {
            throw new Error(`Discord channel '${channelName}' not found`);
        }
        
        // Check if bot has permission to send messages in this channel
        if (!channel.permissionsFor(this.discordClient.user).has('SendMessages')) {
            throw new Error(`No permission to send messages in #${channelName}`);
        }
        
        const message = await channel.send(content);
        
        return { messageId: message.id, channelId: channel.id };
    }

    // Utility function to add delay
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
        console.log('3. If scraping fails, use Manual Input mode');
        console.log('4. The system will analyze your listing and post to relevant platforms');
        
        if (!process.env.DISCORD_BOT_TOKEN) {
            console.log(chalk.red('\n⚠️  Discord bot token not configured. Run "npm run setup" to configure.'));
        }
        
        console.log(chalk.cyan('\n📝 Note: If Whatnot blocks scraping (403 error), use Manual Input mode in the web interface.'));
    }

    getWebInterface() {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>JFox Ink Auto-Poster</title>
            <style>
                * { box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    max-width: 900px; 
                    margin: 0 auto; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                }
                .container { 
                    background: white; 
                    padding: 30px; 
                    border-radius: 15px; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                }
                h1 { 
                    color: #4CAF50; 
                    text-align: center; 
                    margin-bottom: 10px;
                    font-size: 2.5em;
                }
                .subtitle {
                    text-align: center;
                    color: #666;
                    margin-bottom: 30px;
                    font-style: italic;
                }
                .tabs {
                    display: flex;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #ddd;
                }
                .tab {
                    flex: 1;
                    padding: 12px;
                    text-align: center;
                    cursor: pointer;
                    background: #f5f5f5;
                    border: none;
                    font-size: 16px;
                    font-weight: bold;
                    transition: all 0.3s;
                }
                .tab.active {
                    background: #4CAF50;
                    color: white;
                }
                .tab-content {
                    display: none;
                }
                .tab-content.active {
                    display: block;
                }
                .form-group { 
                    margin: 20px 0; 
                }
                label { 
                    display: block; 
                    margin-bottom: 8px; 
                    font-weight: bold; 
                    color: #333;
                }
                input, textarea { 
                    width: 100%; 
                    padding: 12px; 
                    border: 2px solid #ddd; 
                    border-radius: 8px; 
                    font-size: 16px;
                    transition: border-color 0.3s;
                }
                input:focus, textarea:focus {
                    outline: none;
                    border-color: #4CAF50;
                }
                button { 
                    background: linear-gradient(45deg, #4CAF50, #45a049);
                    color: white; 
                    padding: 15px 30px; 
                    border: none; 
                    border-radius: 8px; 
                    cursor: pointer; 
                    font-size: 18px; 
                    font-weight: bold;
                    width: 100%;
                    transition: transform 0.2s;
                    margin-top: 10px;
                }
                button:hover { 
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                }
                button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }
                .result { 
                    margin-top: 20px; 
                    padding: 15px; 
                    background: #e8f5e8; 
                    border-radius: 8px; 
                    display: none;
                    border-left: 5px solid #4CAF50;
                }
                .error { 
                    background: #ffe8e8; 
                    color: #d32f2f;
                    border-left-color: #d32f2f;
                }
                .warning {
                    background: #fff3cd;
                    color: #856404;
                    border-left-color: #ffc107;
                }
                .loading {
                    background: #e3f2fd;
                    color: #1976d2;
                    border-left-color: #1976d2;
                }
                .feature-list {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .feature-list h3 {
                    color: #333;
                    margin-top: 0;
                }
                .feature-list ul {
                    margin: 0;
                    padding-left: 20px;
                }
                .feature-list li {
                    margin: 5px 0;
                    color: #555;
                }
                .two-column {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }
                @media (max-width: 768px) {
                    .two-column {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 JFox Ink Auto-Poster</h1>
                <p class="subtitle">Intelligent auto-posting for your Whatnot listings</p>
                
                <div class="tabs">
                    <button class="tab active" onclick="switchTab('auto')">🔄 Auto Scrape</button>
                    <button class="tab" onclick="switchTab('manual')">✋ Manual Input</button>
                </div>
                
                <!-- Auto Scraping Tab -->
                <div id="auto-tab" class="tab-content active">
                    <div class="feature-list">
                        <h3>🎯 Auto Mode - Let AI Do The Work</h3>
                        <ul>
                            <li>Automatically scrapes your Whatnot listing</li>
                            <li>Analyzes product type and generates content</li>
                            <li>Posts to relevant communities automatically</li>
                        </ul>
                    </div>
                    
                    <div class="form-group">
                        <label>Whatnot URL:</label>
                        <input type="url" id="whatnotUrl" placeholder="https://whatnot.com/live/..." required>
                    </div>
                    
                    <div class="form-group">
                        <label>Custom Message (optional):</label>
                        <textarea id="customMessage" rows="3" placeholder="Add your own promotional message here..."></textarea>
                    </div>
                    
                    <button onclick="autoPost()" id="autoPostButton">🎯 Auto Post to Relevant Platforms</button>
                </div>
                
                <!-- Manual Input Tab -->
                <div id="manual-tab" class="tab-content">
                    <div class="feature-list">
                        <h3>✋ Manual Mode - Full Control</h3>
                        <ul>
                            <li>Use when auto-scraping fails or is blocked</li>
                            <li>Manually enter your listing details</li>
                            <li>Still gets intelligent platform targeting</li>
                        </ul>
                    </div>
                    
                    <div class="form-group">
                        <label>Whatnot URL:</label>
                        <input type="url" id="manualUrl" placeholder="https://whatnot.com/live/..." required>
                    </div>
                    
                    <div class="two-column">
                        <div class="form-group">
                            <label>Title:</label>
                            <input type="text" id="manualTitle" placeholder="Pokemon Booster Box Opening..." required>
                        </div>
                        
                        <div class="form-group">
                            <label>Price (optional):</label>
                            <input type="text" id="manualPrice" placeholder="$50">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Description:</label>
                        <textarea id="manualDescription" rows="3" placeholder="Amazing rare cards and collectibles..." required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Custom Message (optional):</label>
                        <textarea id="manualCustomMessage" rows="2" placeholder="Add your own promotional message here..."></textarea>
                    </div>
                    
                    <button onclick="manualPost()" id="manualPostButton">🎯 Post with Manual Details</button>
                </div>
                
                <div id="result" class="result"></div>
            </div>
            
            <script>
                function switchTab(tabName) {
                    // Hide all tabs
                    document.querySelectorAll('.tab-content').forEach(tab => {
                        tab.classList.remove('active');
                    });
                    document.querySelectorAll('.tab').forEach(tab => {
                        tab.classList.remove('active');
                    });
                    
                    // Show selected tab
                    document.getElementById(tabName + '-tab').classList.add('active');
                    event.target.classList.add('active');
                    
                    // Clear result
                    document.getElementById('result').style.display = 'none';
                }
                
                async function autoPost() {
                    const url = document.getElementById('whatnotUrl').value;
                    const message = document.getElementById('customMessage').value;
                    
                    await postListing('/post', {
                        whatnotUrl: url,
                        customMessage: message
                    }, 'autoPostButton');
                }
                
                async function manualPost() {
                    const url = document.getElementById('manualUrl').value;
                    const title = document.getElementById('manualTitle').value;
                    const description = document.getElementById('manualDescription').value;
                    const price = document.getElementById('manualPrice').value;
                    const message = document.getElementById('manualCustomMessage').value;
                    
                    if (!url || !title || !description) {
                        alert('Please fill in URL, title, and description');
                        return;
                    }
                    
                    await postListing('/manual', {
                        whatnotUrl: url,
                        title: title,
                        description: description,
                        price: price,
                        customMessage: message
                    }, 'manualPostButton');
                }
                
                async function postListing(endpoint, data, buttonId) {
                    const resultDiv = document.getElementById('result');
                    const button = document.getElementById(buttonId);
                    
                    if (!data.whatnotUrl) {
                        alert('Please enter a Whatnot URL');
                        return;
                    }
                    
                    // Validate URL format
                    try {
                        new URL(data.whatnotUrl);
                    } catch (e) {
                        alert('Please enter a valid URL');
                        return;
                    }
                    
                    // Show loading state
                    button.disabled = true;
                    button.textContent = '🔄 Processing...';
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '🔄 Analyzing your listing and finding relevant communities...';
                    resultDiv.className = 'result loading';
                    
                    try {
                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            const successCount = result.result.results.filter(r => r.success).length;
                            const totalAttempts = result.result.results.length;
                            
                            let resultHtml = \`
                                ✅ <strong>Successfully processed!</strong><br><br>
                                📦 <strong>Product:</strong> \${result.result.listing.title}<br>
                                🏷️ <strong>Category:</strong> \${result.result.category}<br>
                                📊 <strong>Posted to:</strong> \${successCount}/\${totalAttempts} platform(s)<br><br>
                            \`;
                            
                            if (result.result.results.length > 0) {
                                resultHtml += result.result.results.map(r => 
                                    \`\${r.success ? '✅' : '❌'} \${r.platform}: #\${r.channel}\`
                                ).join('<br>');
                            } else {
                                resultHtml += '⚠️ No platforms configured. Run "npm run setup" to configure Discord.';
                            }
                            
                            resultDiv.innerHTML = resultHtml;
                            resultDiv.className = 'result';
                        } else {
                            if (result.error && result.error.includes('403')) {
                                resultDiv.innerHTML = \`
                                    ⚠️ <strong>Scraping Blocked</strong><br><br>
                                    Whatnot blocked automatic scraping. Please use the <strong>Manual Input</strong> tab instead.<br><br>
                                    <button onclick="switchTab('manual')" style="padding: 8px 16px; margin-top: 10px;">Switch to Manual Mode</button>
                                \`;
                                resultDiv.className = 'result warning';
                            } else {
                                resultDiv.innerHTML = '❌ <strong>Error:</strong> ' + result.error;
                                resultDiv.className = 'result error';
                            }
                        }
                    } catch (error) {
                        resultDiv.innerHTML = '❌ <strong>Network error:</strong> ' + error.message;
                        resultDiv.className = 'result error';
                    } finally {
                        // Reset button state
                        button.disabled = false;
                        button.textContent = endpoint === '/post' ? '🎯 Auto Post to Relevant Platforms' : '🎯 Post with Manual Details';
                    }
                }
                
                // Allow Enter key to submit in auto mode
                document.getElementById('whatnotUrl').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        autoPost();
                    }
                });
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
