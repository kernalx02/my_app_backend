const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- MIDDLEWARE ---
app.use(express.json()); 
app.use(cors());         

// --- DATABASE CONNECTION WITH EXCEPTION HANDLING ---
const connectDB = async () => {
  try {
    console.log("⏳ Attempting to bridge to MongoDB Atlas...");
    
    // Setting a 5-second timeout so it doesn't hang forever
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000 
    });

    console.log("✅ SUCCESS: Security Guard connected to MongoDB (Expose DB)");
  } catch (err) {
    console.log("\n❌ --- DETAILED DATABASE ERROR --- ❌");
    console.error("Type:", err.name);
    console.error("Message:", err.message);
    
    // This helps us see if it's a Whitelist (IP) issue or a DNS issue
    if (err.reason) {
      console.log("Technical Reason:", JSON.stringify(err.reason, null, 2));
    }
    
    console.log("--------------------------------------\n");
    console.log("💡 TIP: If you see 'ECONNREFUSED', your internet/DNS is blocking the connection.");
    console.log("💡 TIP: If you see 'bad auth', check your password in the .env file.");
    process.exit(1); 
  }
};

connectDB();

// --- SCHEMAS (Your Data Blueprints) ---

// 1. User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  profilePic: String,
  posts: { type: Array, default: [] }
});
const User = mongoose.model('User', userSchema);

// 2. Post Schema
const postSchema = new mongoose.Schema({
  username: String,
  profilePic: String,
  content: String,
  image: String,     
  mediaType: String, 
  ups: { type: Array, default: [] },
  downs: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// --- ROUTES (The API Endpoints) ---

// TEST ROUTE: Check if server is alive
app.get('/', (req, res) => {
  res.send("The Expose Backend is running!");
});

// GET all posts
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// CREATE a new post
app.post('/api/posts', async (req, res) => {
  try {
    const newPost = new Post(req.body);
    const savedPost = await newPost.save();
    res.status(201).json(savedPost);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// LOGIN / GET User (Simple version for now)
app.get('/api/users/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server active on http://localhost:${PORT}`);
});