import { Schema, model, Document, Types } from 'mongoose'

export interface IPollOption {
  text:  string
  votes: Types.ObjectId[]
}

export interface IPoll extends Document {
  conversationId: Types.ObjectId
  createdBy:       Types.ObjectId
  question:        string
  options:         IPollOption[]
  multipleChoice:  boolean
  endsAt?:         Date
  createdAt:       Date
  updatedAt:       Date
}

const PollSchema = new Schema<IPoll>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  createdBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  question:        { type: String, required: true, trim: true, maxlength: 500 },
  options: [{
    text:  { type: String, required: true, trim: true, maxlength: 200 },
    votes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  }],
  multipleChoice:  { type: Boolean, default: false },
  endsAt:          { type: Date },
}, { timestamps: true })

export const Poll = model<IPoll>('Poll', PollSchema)
export default Poll
