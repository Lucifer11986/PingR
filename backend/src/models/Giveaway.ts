import { Schema, model, Document, Types } from 'mongoose'

export interface IGiveaway extends Document {
  giveawayId: string
  botId?: string           // Optional - nur bei Bot-Giveaways
  conversationId: string
  channelId?: string
  prize: string
  description?: string
  requirements: string     // Einfacher String statt Objekt
  duration: number
  winnersCount: number
  endsAt: Date
  participants: Types.ObjectId[]   // Einfach nur UserIds
  winners: Types.ObjectId[]
  status: 'active' | 'completed' | 'ended' | 'cancelled'
  createdBy: Types.ObjectId
  developerId?: Types.ObjectId
  messageId?: string
  createdAt: Date
  updatedAt: Date
}

const GiveawaySchema = new Schema<IGiveaway>({
  giveawayId: {
    type: String,
    required: true,
    unique: true,
    default: () => `giveaway_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  botId: { type: String, index: true },               // ? nicht mehr required
  conversationId: { type: String, required: true, index: true },
  channelId: { type: String },
  prize: { type: String, required: true },
  description: { type: String },
  requirements: { type: String, default: 'React mit ?? um teilzunehmen' },  // ? einfacher String
  duration: { type: Number, required: true },
  winnersCount: { type: Number, default: 1 },
  endsAt: { type: Date, required: true, index: true },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],  // ? einfache ObjectId Liste
  winners: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  status: {
    type: String,
    enum: ['active', 'completed', 'ended', 'cancelled'],  // ? 'completed' hinzugefügt
    default: 'active',
    index: true
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  developerId: { type: Schema.Types.ObjectId, ref: 'DevUser' },
  messageId: { type: String }
}, { timestamps: true })

GiveawaySchema.index({ conversationId: 1, status: 1 })
GiveawaySchema.index({ botId: 1, status: 1, endsAt: 1 })

const Giveaway = model<IGiveaway>('Giveaway', GiveawaySchema)
export { Giveaway }
export default Giveaway
