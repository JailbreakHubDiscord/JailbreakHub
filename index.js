const fs = require('fs');
const { Client, Collection, Intents, MessageActionRow, MessageButton } = require('discord.js');
const config = require('./config.json');
const fetch = require('node-fetch')
const axios = require('axios').default;
const deployCommands = require('./deploy-commands')

const client = new Client({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_VOICE_STATES
	]
});

// Commands
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
}

// On Ready
client.once('ready', async c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
	client.user.setActivity(config.server_name, { type: 'WATCHING' })

	// Setup slash commands
	deployCommands();
});

client.on('unhandledRejection', error => {
	console.log(error);
});

client.on('shardError', error => {
	console.error(error);
});

client.on('error', error => {
	console.error(error);
});

client.on('invalidRequestWarning', error => {
	console.error(error);
})

client.on('messageDelete', async message => {
	if (fs.readFileSync('deleted.txt', 'utf-8') === 'true') {
		return fs.writeFileSync('deleted.txt', 'false', 'utf-8')
	}
	if (!message.guild) return;
	const fetchedLogs = await message.guild.fetchAuditLogs({
		limit: 1,
		type: 'MESSAGE_DELETE',
	});
	const deletionLog = fetchedLogs.entries.first();

	const { executor, target } = deletionLog;
	if (target.id === message.author.id) {
		var embed = {
			color: "#ff4545",
			title: `Message deleted by moderator`,
			fields: [
				{
					"name": "Username",
					"value": message.author.tag || 'Unknown'
				},
				{
					"name": "ID",
					"value": message.author.id || 'Unknown'
				},
				{
					"name": "Message",
					"value": message.content || 'Unknown'
				},
				{
					"name": "Channel",
					"value": `<#${message.channel.id}>` || 'Unknown'
				},
				{
					"name": "Responsible Moderator",
					"value": executor.tag || 'Unknown'
				},
				{
					"name": "Time",
					"value": `<t:${Math.floor(Date.now() / 1000)}:f>\n<t:${Math.floor(Date.now() / 1000)}:R>`
				}
			]
		};;
	} else {
		var embed = {
			color: "#ff4545",
			title: `Message deleted by user`,
			fields: [
				{
					"name": "Username",
					"value": message.author.tag || 'Unknown'
				},
				{
					"name": "ID",
					"value": message.author.id || 'Unknown'
				},
				{
					"name": "Message",
					"value": message.content || 'Unknown'
				},
				{
					"name": "Channel",
					"value": `<#${message.channel.id}>` || 'Unknown'
				},
				{
					"name": "Time",
					"value": `<t:${Math.floor(Date.now() / 1000)}:f>\n<t:${Math.floor(Date.now() / 1000)}:R>`
				}
			]
		};
	}

	message.guild.channels.cache.get(config.channels.logs).send({ embeds: [embed] })
})

// message action
client.on('messageCreate', async message => {
	if (message.author.bot) return

	// Shortlinks
	if (String(message.content).includes('://bit.ly/')) {
		var link = String(message.content).split('bit.ly/').pop().split(' ').shift().split('\n').shift()
		const res = await axios.get(`https://bit.ly/${link}`, {
			maxRedirects: 0,
			validateStatus: false
		})
		const embed = {
			color: "#e25c21",
			title: 'Shortlink detected!',
			description: "Here is the original link. Stay safe on the Internet!",
			fields: [
				{
					"name": "Long URL",
					"value": res.headers.location || 'Unknown'
				},
				{
					"name": "Username",
					"value": message.author.tag || 'Unknown'
				},
				{
					"name": "Time",
					"value": `<t:${Math.floor(Date.now() / 1000)}:f>\n<t:${Math.floor(Date.now() / 1000)}:R>`
				}
			]
		};
		message.reply({ embeds: [embed] })
	}


	// Harmful websites
	if (String(message.content).includes('http://') || String(message.content).includes('https://')) {
		if (!config.gAPIToken) return
		if (String(message.content).includes('http://')) {
			var site = String(message.content).split('http://').pop().split(' ').shift()
		}
		else {
			var site = String(message.content).split('https://').pop().split(' ').shift()
		}
		const res = await axios.post(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${config.gAPIToken}`, {
			client: {
				clientId: "BluBot",
				clientVersion: "0.0.1"
			},
			threatInfo: {
				threatTypes: ["THREAT_TYPE_UNSPECIFIED", "MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
				platformTypes: ["ANY_PLATFORM"],
				threatEntryTypes: ["URL"],
				threatEntries: [
					{ "url": site }
				]
			}
		})
		if (res.data.matches) {
			fs.writeFileSync('deleted.txt', 'true', 'utf-8')
			message.delete()
			const embed = {
				color: "#ff4545",
				title: 'Unsafe site detected!',
				description: "This message has been hidden and reported to the staff team.",
				fields: [
					{
						"name": "Username",
						"value": message.author.tag || 'Unknown'
					},
					{
						"name": "Time",
						"value": `<t:${Math.floor(Date.now() / 1000)}:f>\n<t:${Math.floor(Date.now() / 1000)}:R>`
					}
				],
				footer: {
					"text": "Powered by Google Safe Browsing!"
				}
			};
			message.channel.send({ embeds: [embed] })
			function titleCase(string) {
				return string.split(' ')
					.map(w => w[0].toUpperCase() + w.substring(1).toLowerCase())
					.join(' ');
			}
			const logembed = {
				color: "#ff4545",
				title: `Unsafe site detected by ${message.author.username}!`,
				fields: [
					{
						"name": "Username",
						"value": message.author.tag || 'Unknown'
					},
					{
						"name": "ID",
						"value": message.author.id || 'Unknown'
					},
					{
						"name": "Message",
						"value": message.content || 'Unknown'
					},
					{
						"name": "Channel",
						"value": `<#${message.channel.id}>` || 'Unknown'
					},
					{
						"name": "URL",
						"value": res.data.matches[0].threat.url || 'Unknown'
					},
					{
						"name": "Threat Type",
						"value": titleCase(String(res.data.matches[0].threatType).replace('_', ' ')) || 'Unknown'
					},
					{
						"name": "Threat Platform",
						"value": titleCase(String(res.data.matches[0].platformType).replace('_', ' ')) || 'Unknown'
					},
					{
						"name": "Time",
						"value": `<t:${Math.floor(Date.now() / 1000)}:f>\n<t:${Math.floor(Date.now() / 1000)}:R>`
					}
				]
			};
			message.guild.channels.cache.get(config.channels.logs).send({ embeds: [logembed] })
		}
	}

	// Phishing links
	if (String(message.content).includes('http://') || String(message.content).includes('https://')) {
		if (String(message.content).includes('http://')) {
			var site = String(message.content).split('http://').pop().split('/').shift()
		}
		else {
			var site = String(message.content).split('https://').pop().split('/').shift()
		}
		const res = await axios.get(`https://phish.sinking.yachts/v2/check/${site}`)
		if (res.data === true) {
			fs.writeFileSync('deleted.txt', 'true', 'utf-8')
			message.delete()
			const embed = {
				color: "#ff4545",
				title: 'Phishing site detected!',
				description: "This message has been hidden and reported to the staff team.",
				fields: [
					{
						"name": "Username",
						"value": message.author.tag || 'Unknown'
					},
					{
						"name": "Time",
						"value": `<t:${Math.floor(Date.now() / 1000)}:f>\n<t:${Math.floor(Date.now() / 1000)}:R>`
					}
				],
				footer: {
					"icon_url": client.user.avatarURL(),
					"text": "Powered by phish.sinking.yachts!"
				}
			};
			message.channel.send({ embeds: [embed] })
			const logembed = {
				color: "#ff4545",
				title: `Phishing site detected by ${message.author.username}!`,
				fields: [
					{
						"name": "Username",
						"value": message.author.tag || 'Unknown'
					},
					{
						"name": "ID",
						"value": message.author.id || 'Unknown'
					},
					{
						"name": "Message",
						"value": message.content || 'Unknown'
					},
					{
						"name": "Channel",
						"value": `<#${message.channel.id}>` || 'Unknown'
					},
					{
						"name": "Harmful Site",
						"value": site || 'Unknown'
					},
					{
						"name": "Time",
						"value": `<t:${Math.floor(Date.now() / 1000)}:f>\n<t:${Math.floor(Date.now() / 1000)}:R>`
					}
				]
			};
			message.guild.channels.cache.get(config.channels.logs).send({ embeds: [logembed] })
		}
	}

	// Censors
	const censored = JSON.parse(fs.readFileSync('./censored.json'))
	for (i in censored) {
		if (message.content.includes(censored[i])) {
			fs.writeFileSync('deleted.txt', 'true', 'utf-8')
			const embed = {
				color: "#ff8000",
				title: `Deleted message with censored word from ${message.author.username}`,
				fields: [
					{
						"name": "Username",
						"value": message.author.tag || 'Unknown'
					},
					{
						"name": "ID",
						"value": message.author.id || 'Unknown'
					},
					{
						"name": "Message",
						"value": message.content || 'Unknown'
					},
					{
						"name": "Censored Word",
						"value": censored[i] || 'Unknown'
					},
					{
						"name": "Channel",
						"value": `<#${message.channel.id}>` || 'Unknown'
					},
					{
						"name": "Time",
						"value": `<t:${Math.floor(Date.now() / 1000)}:f>\n<t:${Math.floor(Date.now() / 1000)}:R>`
					}
				]
			};
			message.guild.channels.cache.get(config.channels.logs).send({ embeds: [embed] })
			return message.delete();
		}
	}

	// Triggers
	const triggers = JSON.parse(fs.readFileSync('./triggers.json'))
	triggers.forEach(trigger => {
		if (message.content.includes(trigger.trigger)) {
			message.reply(trigger.response)
		}
	});

	// Tweak search
	if (message.content.startsWith("[[") && message.content.includes("]]")) {
		var tweak = String(message.content).replace("[[", "").split("]]")[0]
		var page = String(message.content).replace("[[", "").split("]] ")[1] || 1
		async function getData() {
			const data = await fetch(`https://api.parcility.co/db/search?q=${tweak}`)
			return data.json()
		}
		var data = await getData()
		if (data.status === false) return message.reply("Error in finding tweak. Are you sure you spelled it correctly?")
		var items = data.data.length
		var currentPage = data.data[page - 1]
		if (page <= 0) return message.reply("Invalid page number.")
		if (page > items) return message.reply("Could not find that page!")
		if (String(currentPage.Icon).includes("file:")) {
			var icon = currentPage.repo.icon
		} else {
			var icon = currentPage.Icon
		}
		const embed = {
			color: "#0064FF",
			title: `Tweak Search for ${tweak} | Page ${page}`,
			thumbnail: {
				url: icon
			},
			fields: [
				{
					"name": "Name",
					"value": currentPage.Name
				},
				{
					"name": "Author",
					"value": currentPage.Author
				},
				{
					"name": "Repo",
					"value": currentPage.repo.url
				}
			],
			footer: {
				text: `Page ${page}/${items} | Switch pages with [[${tweak}]] <number>\nPowered by Parcility`,
			},
		};
		const buttons = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setURL(currentPage.repo.url)
					.setLabel('Repo')
					.setStyle('LINK'),
			);
		message.reply({ embeds: [embed], components: [buttons] })
	}
});

// Events
client.on('interactionCreate', async interaction => {
	const command = client.commands.get(interaction.commandName);
	if (command) {
		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
		}
	}
});

client.login(config.token);
