import { Schema, model, Document, Types } from 'mongoose'

export interface IContact extends Document {
  owner:       Types.ObjectId
  user:        Types.ObjectId
  identityId?: Types.ObjectId  // Welcher Identity gehört dieser Kontakt
  nickname?:   string
  addedAt:     Date
}

const ContactSchema = new Schema<IContact>({
  owner:      { type: Schema.Types.ObjectId, ref: 'User',     required: true },
  user:       { type: Schema.Types.ObjectId, ref: 'User',     required: true },
  identityId: { type: Schema.Types.ObjectId, ref: 'Identity'                },
  nickname:   { type: String, maxlength: 30 },
  addedAt:    { type: Date, default: Date.now },
}, { timestamps: false })

ContactSchema.index({ owner: 1, user: 1, identityId: 1 }, { unique: true, sparse: true })
ContactSchema.index({ owner: 1, identityId: 1 })

const Contact = model<IContact>('Contact', ContactSchema)
export { Contact }
export default Contact