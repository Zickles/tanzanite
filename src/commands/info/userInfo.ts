import {
	Arg,
	BotCommand,
	bots,
	colors,
	emojis,
	formatList,
	mappings,
	sleep,
	Time,
	timestampAndDelta,
	type CommandMessage,
	type OptArgType,
	type SlashMessage
} from '#lib';
import { embedField } from '#lib/common/tags.js';
import {
	ActivityType,
	ApplicationCommandOptionType,
	ApplicationFlagsBitField,
	EmbedBuilder,
	escapeMarkdown,
	PermissionFlagsBits,
	UserFlags,
	type APIApplication,
	type ApplicationFlagsString,
	type Guild,
	type GuildMember,
	type User
} from 'discord.js';

export default class UserInfoCommand extends BotCommand {
	public constructor() {
		super('userInfo', {
			aliases: ['user-info', 'user', 'u'],
			category: 'info',
			description: 'Gives information about a specified user.',
			usage: ['user-info [user]'],
			examples: ['user-info 322862723090219008'],
			args: [
				{
					id: 'user',
					description: 'The user you would like to find information about.',
					type: Arg.union('user', 'snowflake'),
					readableType: 'user|snowflake',
					prompt: 'What user would you like to find information about?',
					retry: '{error} Choose a valid user to find information about.',
					optional: true,
					slashType: ApplicationCommandOptionType.User
				}
			],
			slash: true,
			clientPermissions: ['EmbedLinks'],
			clientCheckChannel: true,
			userPermissions: []
		});
	}

	public override async exec(message: CommandMessage | SlashMessage, args: { user: OptArgType<'user' | 'snowflake'> }) {
		const user =
			args.user === null
				? message.author
				: typeof args.user === 'object'
				? args.user
				: await this.client.users.fetch(`${args.user}`).catch(() => undefined);

		if (user === undefined) return message.util.reply(`${emojis.error} Invalid user.`);
		const member = message.guild ? await message.guild.members.fetch(user.id).catch(() => undefined) : undefined;
		await user.fetch(true); // gets banner info and accent color

		const userEmbed = await UserInfoCommand.makeUserInfoEmbed(user, member, message.guild);

		return await message.util.reply({ embeds: [userEmbed] });
	}

	public static async makeUserInfoEmbed(user: User, member?: GuildMember, guild?: Guild | null) {
		const emojis = [];
		const superUsers = user.client.utils.getShared('superUsers');

		const userEmbed = new EmbedBuilder()
			.setTitle(escapeMarkdown(user.tag))
			.setThumbnail(user.displayAvatarURL({ size: 2048, extension: 'png' }))
			.setTimestamp()
			.setFooter({ text: user.tag })
			.setColor(member?.displayColor ?? colors.default);

		// Flags
		if (user.client.config.owners.includes(user.id)) emojis.push(mappings.otherEmojis.Developer);
		if (superUsers.includes(user.id)) emojis.push(mappings.otherEmojis.Superuser);

		if (user.bot && !user.flags?.has('VerifiedBot')) emojis.push(mappings.otherEmojis.Bot);

		const flags = user.flags?.toArray();
		if (flags) {
			flags.forEach((f) => {
				if (mappings.userFlags[f] !== undefined) {
					emojis.push(mappings.userFlags[f]);
				} else emojis.push(`\`${f}\``);
			});
		}

		// discord omits nitro information to bots, this is just guessing
		if (
			Number(user.discriminator) < 10 ||
			mappings.commonNitroDiscriminators.includes(user.discriminator) ||
			user.displayAvatarURL()?.endsWith('.gif') || // animated avatars are nitro only
			user.flags?.has(UserFlags.Partner) ||
			user.flags?.has(UserFlags.Staff) ||
			member?.avatar || // per server avatars are nitro only
			user.banner // banners are nitro only
		) {
			emojis.push(mappings.otherEmojis.Nitro);
		}

		if (guild?.ownerId == user.id) emojis.push(mappings.otherEmojis.Owner);
		else if (member?.permissions.has(PermissionFlagsBits.Administrator)) emojis.push(mappings.otherEmojis.Admin);
		if (member?.premiumSinceTimestamp) emojis.push(mappings.otherEmojis.Booster);

		await this.generateGeneralInfoField(userEmbed, user);

		this.generateServerInfoField(userEmbed, member);

		this.generatePresenceField(userEmbed, member);

		this.generateRolesField(userEmbed, member);

		this.generatePermissionsField(userEmbed, member);

		await this.generateBotField(userEmbed, user);

		if (emojis) {
			userEmbed.setDescription(
				`\u200B${emojis.filter((e) => e).join('  ')}${
					userEmbed.data.description?.length ? `\n\n${userEmbed.data.description}` : ''
				}`
			); // zero width space
		}

		return userEmbed;
	}

	public static async generateGeneralInfoField(embed: EmbedBuilder, user: User, title = '» General Information') {
		const pronouns = await Promise.race([
			user.client.utils.getPronounsOf(user),
			// cut off request after 2 seconds
			sleep(2 * Time.Second)
		]);

		const generalInfo = embedField`
			Mention ${`<@${user.id}>`}
			ID ${user.id}
			Created ${timestampAndDelta(user.createdAt, 'd')}
			Accent Color ${user.hexAccentColor}
			Banner ${user.banner && `[link](${user.bannerURL({ extension: 'png', size: 4096 })})`}
			Pronouns ${typeof pronouns === 'string' && pronouns !== 'Unspecified' && pronouns}`;

		embed.addFields({ name: title, value: generalInfo });
	}

	public static generateServerInfoField(embed: EmbedBuilder, member?: GuildMember | undefined, title = '» Server Information') {
		if (!member) return;

		const isGuildOwner = member.guild.ownerId === member.id;

		const deletions = (() => {
			if (member.guild.id !== mappings.guilds["Moulberry's Bush"]) return null;

			switch (member.id) {
				case mappings.users['IRONM00N']:
					return '1⅓';
				case mappings.users['nopo']:
				case mappings.users['Bestower']:
					return '⅓';
				default:
					return null;
			}
		})();

		const serverUserInfo = embedField`
			Created Server ${member.joinedAt && isGuildOwner && timestampAndDelta(member.joinedAt!, 'd')}
			Joined ${member.joinedAt && !isGuildOwner && timestampAndDelta(member.joinedAt!, 'd')}
			Booster Since ${member.premiumSince && timestampAndDelta(member.premiumSince, 'd')}
			Display Color ${member.displayHexColor}
			#general Deletions ${deletions}
			Nickname ${member.nickname && escapeMarkdown(member.nickname)}`;

		if (serverUserInfo.length) embed.addFields({ name: title, value: serverUserInfo });
	}

	public static generatePresenceField(embed: EmbedBuilder, member?: GuildMember | undefined, title = '» Presence') {
		if (!member || !member.presence) return;
		if (!member.presence.status && !member.presence.clientStatus && !member.presence.activities) return;

		let customStatus = '';
		const activitiesNames: string[] = [];
		if (member.presence.activities) {
			member.presence.activities.forEach((a) => {
				if (a.type == ActivityType.Custom && a.state) {
					const emoji = `${a.emoji ? `${a.emoji.toString()} ` : ''}`;
					customStatus = `${emoji}${a.state}`;
				}
				activitiesNames.push(`\`${a.name}\``);
			});
		}
		let devices;
		if (member?.presence.clientStatus) devices = Object.keys(member.presence.clientStatus);
		const presenceInfo = [];
		if (member?.presence.status) presenceInfo.push(`**Status:** ${member.presence.status}`);
		if (devices && devices.length)
			presenceInfo.push(`**${devices.length - 1 ? 'Devices' : 'Device'}:** ${formatList(devices, 'and')}`);
		if (activitiesNames.length)
			presenceInfo.push(`**Activit${activitiesNames.length - 1 ? 'ies' : 'y'}:** ${formatList(activitiesNames, 'and')}`);
		if (customStatus && customStatus.length) presenceInfo.push(`**Custom Status:** ${escapeMarkdown(customStatus)}`);
		embed.addFields({ name: title, value: presenceInfo.join('\n') });

		enum statusEmojis {
			online = '787550449435803658',
			idle = '787550520956551218',
			dnd = '787550487633330176',
			offline = '787550565382750239',
			invisible = '787550565382750239'
		}
		embed.setFooter({
			text: member.user.tag,
			iconURL: member.client.emojis.cache.get(statusEmojis[member?.presence.status])?.url ?? undefined
		});
	}

	public static generateRolesField(embed: EmbedBuilder, member?: GuildMember | undefined) {
		if (!member || member.roles.cache.size <= 1) return;

		// roles
		const roles = member.roles.cache
			.filter((role) => role.name !== '@everyone')
			.sort((role1, role2) => role2.position - role1.position)
			.map((role) => `${role}`);

		const joined = roles.join(', ');
		embed.addFields({
			name: `» Role${roles.length - 1 ? 's' : ''} [${roles.length}]`,
			value: joined.length > 1024 ? 'Too Many Roles to Display...' : joined
		});
	}

	public static generatePermissionsField(
		embed: EmbedBuilder,
		member: GuildMember | undefined,
		title = '» Important Permissions'
	) {
		if (!member) return;

		const perms = this.getImportantPermissions(member);

		if (perms.length) embed.addFields({ name: title, value: perms.join(' ') });
	}

	private static getImportantPermissions(member: GuildMember | undefined) {
		if (member == null || member.guild == null) return [];

		if (member.permissions.has('Administrator') || member.guild.ownerId === member.user.id) {
			return ['`Administrator`'];
		}

		const important = member.permissions
			.toArray()
			.filter((p) => mappings.permissions[p]?.important === true)
			.map((p) => `\`${mappings.permissions[p].name}\``);

		return important;
	}

	public static async generateBotField(embed: EmbedBuilder, user: User, title = '» Bot Information') {
		if (!user.bot) return;

		// very old bots have different bot vs user ids
		const applicationId = bots[user.id]?.applicationId ?? user.id;

		const applicationInfo = (await user.client.rest
			.get(`/applications/${applicationId}/rpc`)
			.catch(() => null)) as APIApplication | null;
		if (!applicationInfo) return;

		const flags = new ApplicationFlagsBitField(applicationInfo.flags);

		const intent = (check: ApplicationFlagsString, warn: ApplicationFlagsString) => {
			if (flags.has(check)) return emojis.check;
			if (flags.has(warn)) return emojis.warn;
			return emojis.cross;
		};

		const botInfo = embedField`
			Publicity ${applicationInfo.bot_public ? 'Public' : 'Private'}
			Code Grant ${applicationInfo.bot_require_code_grant ? 'Required' : 'Not Required'}
			Server Members Intent ${intent('GatewayGuildMembers', 'GatewayGuildMembersLimited')}
			Presence Intent ${intent('GatewayPresence', 'GatewayPresenceLimited')}
			Message Content Intent ${intent('GatewayMessageContent', 'GatewayMessageContentLimited')}`;

		embed.addFields({ name: title, value: botInfo });
	}
}
