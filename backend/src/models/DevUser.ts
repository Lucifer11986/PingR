import mongoose, { Schema, Document } from 'mongoose';

export interface IDevUser extends Document {
  username: string;
  email: string;
  password: string;
  apiKey?: string;
  apiKeyHash?: string;
  apiKeyPrefix?: string;
  plan: 'free' | 'pro' | 'enterprise';
  paypalSubscriptionId?: string;
  planStartDate?: Date;
  apiCallsLimit: number;
  createdAt: Date;
  // OAuth
  githubId?: string;
  googleId?: string;
  avatar?: string;
  // Misc
  emailVerified?: boolean;
  emailVerifyTokenHash?: string;
  emailVerifyExpires?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  bots?: string[];
  warningCount?: number;
  mutedUntil?: Date;
  isBanned?: boolean;
  bannedReason?: string;
  bannedUntil?: Date;
  notifications?: { apiErrors: boolean; installs: boolean; weekly: boolean };
}

const DevUserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // apiKey ist nur für bestehende Accounts vorhanden und wird beim nächsten
  // Einsatz in apiKeyHash migriert.
  apiKey: { type: String, sparse: true, unique: true, select: false },
  apiKeyHash: { type: String, sparse: true, unique: true, select: false },
  apiKeyPrefix: { type: String, default: '' },
  
  // Payment & Plan (PayPal)
  plan: { 
    type: String, 
    enum: ['free', 'pro', 'enterprise'], 
    default: 'free' 
  },
  paypalSubscriptionId: { 
    type: String, 
    sparse: true 
  },
  planStartDate: { 
    type: Date 
  },
  apiCallsLimit: { 
    type: Number, 
    default: 60000 // Free: 1000/min * 60min = 60k/hour
  },
  
  createdAt: { type: Date, default: Date.now },

  // OAuth
  githubId: { type: String, sparse: true, index: true },
  googleId: { type: String, sparse: true, index: true },
  avatar:   { type: String, default: null },

  // Misc
  emailVerified: { type: Boolean, default: false },
  emailVerifyTokenHash: { type: String, select: false },
  emailVerifyExpires: { type: Date, select: false },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  bots:          [{ type: String }],
  warningCount:  { type: Number, default: 0 },
  mutedUntil:    { type: Date },
  isBanned:      { type: Boolean, default: false },
  bannedReason:  { type: String },
  bannedUntil:   { type: Date },
  notifications: {
    apiErrors: { type: Boolean, default: true },
    installs:  { type: Boolean, default: true },
    weekly:    { type: Boolean, default: false },
  },
});

export default mongoose.model<IDevUser>('DevUser', DevUserSchema);
