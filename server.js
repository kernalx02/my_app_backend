const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- MIDDLEWARE ---
app.use(express.json()); 

// --- CORS CONFIGURATION ---
app.use(cors({
    origin: ["https://epcoran.netlify.app", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

// --- DATABASE CONNECTION ---
const connectDB = async () => {
    try {
        console.log("⏳ Attempting to bridge to MongoDB Atlas...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ SUCCESS: Connected to MongoDB Atlas");
    } catch (err) {
        console.error("❌ DATABASE ERROR:", err.message);
        process.exit(1); 
    }
};
connectDB();

// --- SCHEMAS ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true }, 
    role: { type: String, default: 'user' },
    profilePic: { type: String, default: '' },
    posts: { type: Array, default: [] }
});
const User = mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
    username: String,
    profilePic: String,
    content: String,
    image: String,     
    mediaType: String, 
    ups: { type: Array, default: [] },
    downs: { type: Array, default: [] },
    comments: [
      {
        username: String,
        text: String,
        likes: { type: Array, default: [] },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// --- ROUTES ---

app.get('/', (req, res) => res.send("The Expose Backend is running!"));

// 1. SIGNUP & LOGIN
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
        if (existingUser) return res.status(400).json({ message: "Username or Email already exists." });
        const newUser = new User({ username, email, password });
        await newUser.save();
        const { password: _, ...userData } = newUser._doc;
        res.status(201).json(userData);
    } catch (err) {
        res.status(500).json({ message: "Error creating account." });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.password !== password) return res.status(401).json({ message: "Invalid email or password." });
        const { password: _, ...userData } = user._doc;
        res.json(userData);
    } catch (err) {
        res.status(500).json({ message: "Server error during login." });
    }
});

// 2. POSTS (GET & CREATE)
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch posts" });
    }
});

app.post('/api/posts', async (req, res) => {
    try {
        const newPost = new Post(req.body);
        const savedPost = await newPost.save();
        res.status(201).json(savedPost);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 3. VOTING (UP/DOWN)
app.post('/api/posts/:id/vote', async (req, res) => {
    try {
        const { username, voteType } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });

        if (voteType === 'up') {
            if (post.ups.includes(username)) {
                post.ups = post.ups.filter(u => u !== username);
            } else {
                post.ups.push(username);
                post.downs = post.downs.filter(u => u !== username);
            }
        } else {
            if (post.downs.includes(username)) {
                post.downs = post.downs.filter(u => u !== username);
            } else {
                post.downs.push(username);
                post.ups = post.ups.filter(u => u !== username);
            }
        }
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 4. COMMENTS & COMMENT LIKES
app.post('/api/posts/:id/comment', async (req, res) => {
    try {
        const { username, text } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });
        post.comments.push({ username, text, likes: [] });
        await post.save();
        res.status(201).json(post);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/posts/:id/comment/:index/like', async (req, res) => {
    try {
        const { username } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });
        const comment = post.comments[req.params.index];
        if (!comment) return res.status(404).json({ message: "Comment not found" });

        const likeIndex = comment.likes.indexOf(username);
        if (likeIndex === -1) {
            comment.likes.push(username);
        } else {
            comment.likes.splice(likeIndex, 1);
        }
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server active on port ${PORT}`));