import { InhibitorHandler } from '@tanzanite/discord-akairo';
import type { TanzaniteClient } from './TanzaniteClient.js';

export class BotInhibitorHandler extends InhibitorHandler {
	public declare readonly client: TanzaniteClient;
}
