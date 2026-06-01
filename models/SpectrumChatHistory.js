import mongoose from 'mongoose';

const SpectrumChatHistorySchema = new mongoose.Schema({
    sessionId: String,
    messages: [mongoose.Schema.Types.Mixed],
}, { strict: false, collection: 'chat_histories_lead' });

export default SpectrumChatHistorySchema;
