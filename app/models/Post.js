import mongoose from 'mongoose';

const ReactionSchema = new mongoose.Schema({
  emoji: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const PostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: String,
  name: String,
  yesterday: { type: String, required: true },
  today: { type: String, required: true },
  blockersText: String,
  confidence: { type: String, default: 'Medium' },
  clarityScore: Number,
  summary: String,
  blockers: [String],
  nextAction: String,
  riskLevel: String,
  followUpQuestion: String,
  aiMode: String,
  reactions: [ReactionSchema]
}, { timestamps: true });

export default mongoose.models.Post || mongoose.model('Post', PostSchema);
