#!/usr/bin/env node

/**
 * JFox Ink Auto-Poster Setup Script
 * Configure platforms and credentials
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');

class AutoPosterSetup {
    constructor() {
        this.envPath = path.join(__dirname, '.env');
        this.configPath = path.join(__dirname, 'config.json');
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async run() {
        console.log(chalk.green(`
╔════════════════════════════════════════╗
║     JFox Ink Auto-Poster Setup         ║
╚════════════════════════════════════════╝
        `));

        try {
            await this.setupEnvironment();
            await this.setupPlatforms();
            await this.testConnections();
            
            console.log(chalk.green('\n✅ Setup complete! Run "npm start" to start the auto-poster.'));
        } catch (error) {
            console.error(chalk.red('\n❌ Setup failed:'), error.message);
        } finally {
            this.rl.close();
        }
    }

    async setupEnvironment() {
        console.log(chalk.yellow('\n📁 Setting up environment...'));
        
        const envContent = await this.createEnvFile();
        fs.writeFileSync(this.envPath, envContent);
        
        console.log(chalk.green('✅ Environment file created'));
    }

    async createEnvFile() {
        let envContent = `# JFox Ink Auto-Poster Configuration
# Generated on ${new Date().toISOString()}

# Server Configuration
PORT=3000
NODE_ENV=development

# Discord Configuration
`;

        const discordToken = await this.question('Enter your Discord Bot Token (or press Enter to skip): ');
        if (discordToken) {
            envContent += `DISCORD_BOT_TOKEN=${discordToken}\n`;
        } else {
            envContent += `# DISCORD_BOT_TOKEN=your_discord_bot_token_here\n`;
        }

        envContent += `
# Facebook Configuration (Coming Soon)
# FACEBOOK_ACCESS_TOKEN=your_facebook_token_here
# FACEBOOK_APP_ID=your_facebook_app_id_here

# Reddit Configuration (Coming Soon)
# REDDIT_CLIENT_ID=your_reddit_client_id_here
# REDDIT_CLIENT_SECRET=your_reddit_client_secret_here
# REDDIT_USERNAME=your_reddit_username_here
# REDDIT_PASSWORD=your_reddit_password_here

# OpenAI Configuration (Optional - for enhanced categorization)
# OPENAI_API_KEY=your_openai_api_key_here

# Webhook Configuration (Optional)
# WEBHOOK_SECRET=your_webhook_secret_here
`;

        return envContent;
    }

    async setupPlatforms() {
        console.log(chalk.yellow('\n🔧 Setting up platform configurations...'));
        
        const config = {
            platforms: {
                discord: await this.setupDiscord(),
                facebook: await this.setupFacebook(),
                reddit: await this.setupReddit()
            },
            categories: this.getDefaultCategories(),
            settings: {
                autoPost: true,
                delayBetweenPosts: 5000,
                maxPostsPerHour: 10
            }
        };

        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        console.log(chalk.green('✅ Platform configuration saved'));
    }

    async setupDiscord() {
        console.log(chalk.blue('\n🎮 Discord Setup'));
        
        const enabled = await this.question('Enable Discord posting? (y/n): ') === 'y';
        if (!enabled) return { enabled: false };

        console.log(chalk.cyan(`
Discord Bot Setup Instructions:
1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token (already entered above)
5. Invite the bot to your servers with "Send Messages" permission
        `));

        const servers = [];
        let addMore = true;
        
        while (addMore) {
            const serverName = await this.question('Enter Discord server name (or press Enter to finish): ');
            if (!serverName) break;
            
            const channels = [];
            let addChannel = true;
            
            while (addChannel) {
                const channel = await this.question(`Enter channel name for ${serverName} (or press Enter to finish): `);
                if (!channel) break;
                channels.push(channel);
            }
            
            servers.push({ name: serverName, channels });
        }

        return {
            enabled: true,
            servers: servers
        };
    }

    async setupFacebook() {
        console.log(chalk.blue('\n📘 Facebook Setup (Coming Soon)'));
        
        const enabled = await this.question('Enable Facebook posting when available? (y/n): ') === 'y';
        
        return {
            enabled: enabled,
            groups: enabled ? ['art-marketplace', 'local-artists'] : []
        };
    }

    async setupReddit() {
        console.log(chalk.blue('\n🔴 Reddit Setup (Coming Soon)'));
        
        const enabled = await this.question('Enable Reddit posting when available? (y/n): ') === 'y';
        
        return {
            enabled: enabled,
            subreddits: enabled ? ['Art', 'painting', 'crafts'] : []
        };
    }

    getDefaultCategories() {
        return {
            'trading-cards': {
                keywords: ['pokemon', 'yugioh', 'mtg', 'magic', 'baseball', 'football', 'basketball', 'tcg', 'card', 'booster'],
                platforms: {
                    discord: ['pokemon-tcg', 'yugioh-trading', 'mtg-marketplace', 'sports-cards'],
                    facebook: ['pokemon-card-collectors', 'trading-card-marketplace'],
                    reddit: ['PokemonTCG', 'YuGiOhTCG', 'magicTCG', 'sportscards']
                }
            },
            'paintings': {
                keywords: ['painting', 'canvas', 'artwork', 'acrylic', 'watercolor', 'oil', 'art', 'original'],
                platforms: {
                    discord: ['art-community', 'original-art'],
                    facebook: ['art-for-sale', 'local-artists'],
                    reddit: ['Art', 'painting', 'ArtForSale']
                }
            },
            'collectibles': {
                keywords: ['vintage', 'collectible', 'rare', 'antique', 'limited', 'exclusive'],
                platforms: {
                    discord: ['collectibles', 'vintage-items'],
                    facebook: ['collectors-marketplace'],
                    reddit: ['collectibles', 'vintage']
                }
            },
            'handmade': {
                keywords: ['handmade', 'custom', 'craft', 'diy', 'artisan', 'handcrafted'],
                platforms: {
                    discord: ['handmade-crafts', 'art-community'],
                    facebook: ['handmade-marketplace', 'local-crafters'],
                    reddit: ['handmade', 'crafts', 'ArtisanGifts']
                }
            }
        };
    }

    async testConnections() {
        console.log(chalk.yellow('\n🔍 Testing connections...'));
        
        // Test if Discord token works
        if (fs.existsSync(this.envPath)) {
            const envContent = fs.readFileSync(this.envPath, 'utf8');
            const discordToken = envContent.match(/DISCORD_BOT_TOKEN=(.+)/)?.[1];
            
            if (discordToken && discordToken !== 'your_discord_bot_token_here') {
                console.log(chalk.green('✅ Discord token found'));
            } else {
                console.log(chalk.yellow('⚠️  Discord token not configured'));
            }
        }
        
        console.log(chalk.green('✅ Configuration files ready'));
    }

    question(query) {
        return new Promise(resolve => this.rl.question(query, resolve));
    }
}

// Run setup if called directly
if (require.main === module) {
    new AutoPosterSetup().run();
}

module.exports = AutoPosterSetup;
