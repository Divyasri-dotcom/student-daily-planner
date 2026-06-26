import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { connectDB } from '@/app/lib/db';
import User from '@/app/models/User';
import Post from '@/app/models/Post';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'standup-wall.json');
const DEFAULT_DATA = { users: [], posts: [] };
const memoryStore = global.__standupWallMemory || (global.__standupWallMemory = structuredClone(DEFAULT_DATA));
let mongoFailed = false;
let localQueue = Promise.resolve();

function wantsLocal() {
  return process.env.STANDUP_STORAGE === 'local' || process.env.STANDUP_STORAGE === 'memory' || !process.env.MONGODB_URI || mongoFailed;
}

function wantsMemoryStore() {
  return process.env.STANDUP_STORAGE === 'memory' || (process.env.NODE_ENV === 'production' && wantsLocal());
}

async function tryMongo(fn) {
  if (wantsLocal()) return { ok: false };
  try {
    await connectDB();
    return { ok: true, value: await fn() };
  } catch (error) {
    mongoFailed = true;
    console.warn(`MongoDB unavailable; using local JSON store. ${error.message}`);
    return { ok: false };
  }
}

async function readData() {
  if (wantsMemoryStore()) return structuredClone(memoryStore);
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return { users: Array.isArray(data.users) ? data.users : [], posts: Array.isArray(data.posts) ? data.posts : [] };
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(DEFAULT_DATA);
    throw error;
  }
}

async function writeData(data) {
  if (wantsMemoryStore()) {
    memoryStore.users = data.users;
    memoryStore.posts = data.posts;
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

async function updateData(mutator) {
  const run = localQueue.then(async () => {
    const data = await readData();
    const result = await mutator(data);
    await writeData(data);
    return result;
  });
  localQueue = run.catch(() => {});
  return run;
}

function newId() {
  return crypto.randomUUID?.() || crypto.randomBytes(16).toString('hex');
}

function normalizeUser(user) {
  if (!user) return null;
  const plain = user.toObject ? user.toObject() : user;
  const id = String(plain.id || plain._id);
  return { _id: id, id, name: plain.name, username: plain.username, password: plain.password };
}

function migrateLegacyPost(plain) {
  if (plain.today || plain.yesterday) return plain;
  return {
    ...plain,
    yesterday: 'Legacy update imported from the first wall version.',
    today: plain.statement || 'No update text available.',
    blockersText: '',
    confidence: 'Medium',
    clarityScore: Number(plain.score) || 5,
    summary: plain.verdict || plain.statement || 'Imported standup update.',
    blockers: [],
    nextAction: plain.challenge || 'Add a clearer next action.',
    riskLevel: 'Low',
    followUpQuestion: plain.challenge || 'What is the next measurable result?',
    aiMode: 'Legacy import'
  };
}

function normalizePost(post) {
  if (!post) return null;
  const raw = post.toObject ? post.toObject() : post;
  const plain = migrateLegacyPost(raw);
  const id = String(plain.id || plain._id);
  return {
    ...plain,
    _id: id,
    id,
    userId: String(plain.userId),
    yesterday: plain.yesterday || '',
    today: plain.today || '',
    blockersText: plain.blockersText || '',
    confidence: plain.confidence || 'Medium',
    clarityScore: Number(plain.clarityScore) || 5,
    blockers: Array.isArray(plain.blockers) ? plain.blockers : [],
    riskLevel: plain.riskLevel || 'Low',
    aiMode: plain.aiMode || 'Unknown',
    createdAt: plain.createdAt || new Date().toISOString(),
    updatedAt: plain.updatedAt || plain.createdAt || new Date().toISOString(),
    reactions: (plain.reactions || []).map((reaction) => ({
      emoji: reaction.emoji,
      userId: String(reaction.userId)
    }))
  };
}

export async function findUserByUsername(username) {
  const clean = String(username || '').trim().toLowerCase();
  const mongo = await tryMongo(async () => User.findOne({ username: clean }).lean());
  if (mongo.ok) return normalizeUser(mongo.value);
  const data = await readData();
  return normalizeUser(data.users.find((user) => user.username === clean));
}

export async function createUser({ name, username, password }) {
  const clean = String(username || '').trim().toLowerCase();
  const displayName = String(name || '').trim();
  const mongo = await tryMongo(async () => User.create({ name: displayName, username: clean, password }));
  if (mongo.ok) return normalizeUser(mongo.value);
  return updateData((data) => {
    if (data.users.some((user) => user.username === clean)) return null;
    const now = new Date().toISOString();
    const user = { _id: newId(), name: displayName, username: clean, password, createdAt: now, updatedAt: now };
    user.id = user._id;
    data.users.push(user);
    return normalizeUser(user);
  });
}

export async function listPosts() {
  const mongo = await tryMongo(async () => Post.find({}).sort({ createdAt: -1 }).limit(60).lean());
  if (mongo.ok) return mongo.value.map(normalizePost);
  await localQueue;
  const data = await readData();
  return data.posts
    .map(normalizePost)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 60);
}

export async function createPost({ user, standup, ai }) {
  const payload = {
    userId: user.id,
    username: user.username,
    name: user.name,
    yesterday: standup.yesterday,
    today: standup.today,
    blockersText: standup.blockers,
    confidence: standup.confidence,
    ...ai,
    reactions: []
  };
  const mongo = await tryMongo(async () => Post.create(payload));
  if (mongo.ok) return normalizePost(mongo.value);
  return updateData((data) => {
    const now = new Date().toISOString();
    const post = { _id: newId(), ...payload, createdAt: now, updatedAt: now };
    post.id = post._id;
    data.posts.unshift(post);
    data.posts = data.posts.slice(0, 120);
    return normalizePost(post);
  });
}

export async function reactToPost({ postId, userId, emoji }) {
  const mongo = await tryMongo(async () => {
    const post = await Post.findById(postId);
    if (!post) return null;
    post.reactions = post.reactions.filter((reaction) => String(reaction.userId) !== String(userId));
    post.reactions.push({ emoji, userId });
    await post.save();
    return post;
  });
  if (mongo.ok) return normalizePost(mongo.value);
  return updateData((data) => {
    const post = data.posts.find((item) => String(item._id) === String(postId) || String(item.id) === String(postId));
    if (!post) return null;
    post.reactions = (post.reactions || []).filter((reaction) => String(reaction.userId) !== String(userId));
    post.reactions.push({ emoji, userId: String(userId) });
    post.updatedAt = new Date().toISOString();
    return normalizePost(post);
  });
}

export async function updatePost({ postId, user, standup, ai }) {
  const mongo = await tryMongo(async () => {
    const post = await Post.findById(postId);
    if (!post || String(post.userId) !== String(user.id)) return null;
    post.yesterday = standup.yesterday;
    post.today = standup.today;
    post.blockersText = standup.blockers;
    post.confidence = standup.confidence;
    post.clarityScore = ai.clarityScore;
    post.summary = ai.summary;
    post.blockers = ai.blockers;
    post.nextAction = ai.nextAction;
    post.riskLevel = ai.riskLevel;
    post.followUpQuestion = ai.followUpQuestion;
    post.aiMode = ai.aiMode;
    await post.save();
    return post;
  });
  if (mongo.ok) return normalizePost(mongo.value);
  return updateData((data) => {
    const post = data.posts.find((item) => String(item._id) === String(postId) || String(item.id) === String(postId));
    if (!post || String(post.userId) !== String(user.id)) return null;
    post.yesterday = standup.yesterday;
    post.today = standup.today;
    post.blockersText = standup.blockers;
    post.confidence = standup.confidence;
    post.clarityScore = ai.clarityScore;
    post.summary = ai.summary;
    post.blockers = ai.blockers;
    post.nextAction = ai.nextAction;
    post.riskLevel = ai.riskLevel;
    post.followUpQuestion = ai.followUpQuestion;
    post.aiMode = ai.aiMode;
    post.updatedAt = new Date().toISOString();
    return normalizePost(post);
  });
}

export async function deletePost({ postId, userId }) {
  const mongo = await tryMongo(async () => {
    const post = await Post.findById(postId);
    if (!post || String(post.userId) !== String(userId)) return false;
    await post.deleteOne();
    return true;
  });
  if (mongo.ok) return mongo.value;
  return updateData((data) => {
    const index = data.posts.findIndex((item) => (String(item._id) === String(postId) || String(item.id) === String(postId)) && String(item.userId) === String(userId));
    if (index === -1) return false;
    data.posts.splice(index, 1);
    return true;
  });
}
