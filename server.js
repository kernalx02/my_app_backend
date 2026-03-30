const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- MIDDLEWARE ---
app.use(express.json()); 
app.use(cors());         

// --- DATABASE CONNECTION ---
// We use a function to handle the connection logic cleanly
const connectDB = async () => {
    try {
        console.log("⏳ Attempting to bridge to MongoDB Atlas...");
        
        // Ensure your MONGO_URI in Render starts with "mongodb+srv://"
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
        });

        console.log("✅ SUCCESS: Connected to MongoDB Atlas");
    } catch (err) {
        console.error("\n❌ --- DATABASE CONNECTION ERROR --- ❌");
        console.error("Message:", err.message);
        console.log("Action: Ensure IP 0.0.0.0/0 is whitelisted in MongoDB Atlas Network Access.");
        console.log("--------------------------------------\n");
        
        // Exit process with failure so Render knows the build/start failed
        process.exit(1); 
    }
};

connectDB();

// --- SCHEMAS ---

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

// --- ROUTES ---

// Health Check
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

// GET User by username
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
const PORT = process.env.PORT || 10000; // Render uses port 10000 by default
app.listen(PORT, () => {
    console.log(`🚀 Server active on port ${PORT}`);
});