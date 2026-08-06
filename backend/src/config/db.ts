import mongoose from 'mongoose'

export async function connectDB(): Promise<void> {
  const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/pingr'
  await mongoose.connect(mongoUri)
  console.log('✅ MongoDB verbunden')
}