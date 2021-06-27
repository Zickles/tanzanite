import { ApplicationCommandOptionType } from 'discord-api-types';
import { User } from 'discord.js';
import { BushCommand } from '../../lib/extensions/BushCommand';
import { BushMessage } from '../../lib/extensions/BushMessage';
import { BushSlashMessage } from '../../lib/extensions/BushSlashMessage';
import { Level } from '../../lib/models';
import AllowedMentions from '../../lib/utils/AllowedMentions';

export default class SetLevelCommand extends BushCommand {
	constructor() {
		super('setlevel', {
			aliases: ['setlevel'],
			category: 'dev',
			description: {
				content: 'Sets the level of a user',
				usage: 'setlevel <user> <level>',
				examples: ['setlevel @Moulberry 69'] //nice
			},
			args: [
				{
					id: 'user',
					type: 'user',
					prompt: {
						start: 'What user would you like to change the level of?',
						retry: '{error} Choose a valid user to change the level of.'
					}
				},
				{
					id: 'level',
					type: 'number',
					prompt: {
						start: 'What level would you like to set the user to?',
						retry: '{error} Choose a valid level to set the user to.'
					}
				}
			],
			ownerOnly: true,
			slashOptions: [
				{
					type: /* 'USER' */ ApplicationCommandOptionType.USER,
					name: 'user',
					description: 'The user to change the level of',
					required: true
				},
				{
					type: /* 'INTEGER' */ ApplicationCommandOptionType.INTEGER,
					name: 'level',
					description: 'The level to set the user to',
					required: true
				}
			],
			slash: true
		});
	}

	async exec(message: BushMessage | BushSlashMessage, { user, level }: { user: User; level: number }): Promise<unknown> {
		if (!message.author.isOwner())
			return await message.util.reply(`${this.client.util.emojis.error} Only my developers can run this command.`);

		const [levelEntry] = await Level.findOrBuild({
			where: {
				id: user.id
			},
			defaults: {
				id: user.id
			}
		});
		await levelEntry.update({ xp: Level.convertLevelToXp(level) });
		return await message.util.send({
			content: `Successfully set level of <@${user.id}> to \`${level}\` (\`${levelEntry.xp}\` XP)`,
			allowedMentions: AllowedMentions.none()
		});
	}
}
