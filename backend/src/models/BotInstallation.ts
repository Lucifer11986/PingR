import mongoose, { Document, Schema } from 'mongoose';

export interface IBotInstallation extends Document {
  botId: string;
  channelId: string;
  channelName: string;
  channelType: 'channel' | 'group' | 'dm' | 'nokki_channel';
  installedBy: mongoose.Types.ObjectId;
  installedAt: Date;
  active: boolean;
  permissions: number;  // Bot Permissions Bitfield
  permissionsVersion?: number;
}

const BotInstallationSchema = new Schema<IBotInstallation>({
  botId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  channelName: { type: String, required: true },
  channelType: { type: String, enum: ['channel', 'group', 'dm', 'nokki_channel'], default: 'channel' },
  installedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  installedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  // Standardmäßig nur Nachrichten lesen und senden. Administrative Rechte
  // müssen bei der Installation ausdrücklich vergeben werden.
  permissions: { type: Number, default: 3 },
  permissionsVersion: { type: Number, default: 2 },
});

// Compound Index: Ein Bot kann nur einmal pro Channel installiert sein
BotInstallationSchema.index({ botId: 1, channelId: 1 }, { unique: true });

export default mongoose.model<IBotInstallation>('BotInstallation', BotInstallationSchema);
