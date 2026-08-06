const mongoose = require('mongoose');
require('dotenv').config();

const ConversationSchema = new mongoose.Schema({}, { strict: false });
const IdentitySchema = new mongoose.Schema({}, { strict: false });

const Conversation = mongoose.model('Conversation', ConversationSchema, 'conversations');
const Identity = mongoose.model('Identity', IdentitySchema, 'identities');

async function run() {
  try {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://mongo:27017/pingr';
    await mongoose.connect(mongoUrl);
    console.log('✅ Connected to MongoDB');

    const conversations = await Conversation.find({
      $or: [
        { identityParticipants: { $exists: false } },
        { identityParticipants: { $size: 0 } }
      ]
    });

    console.log(`🔍 Found ${conversations.length} conversations to fix`);

    let fixed = 0;
    let skipped = 0;

    for (const conv of conversations) {
      try {
        console.log(`\n📝 Processing conversation ${conv._id}`);
        console.log(`   Participants (User IDs): ${conv.participants.join(', ')}`);

        const identities = await Identity.find({
          userId: { $in: conv.participants }
        }).select('_id userId username');

        if (!identities.length) {
          console.warn(`   ⚠️ No identities found`);
          skipped++;
          continue;
        }

        console.log(`   Found ${identities.length} identities`);
        identities.forEach(i => {
          console.log(`     - ${i._id} (User: ${i.userId})`);
        });

        conv.identityParticipants = identities.map(i => i._id);
        await conv.save();

        console.log(`   ✅ Fixed!`);
        fixed++;

      } catch (err) {
        console.error(`   ❌ Error:`, err.message);
        skipped++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Migration complete!');
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ⚠️ Skipped: ${skipped}`);
    console.log('='.repeat(60));

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}

run();
