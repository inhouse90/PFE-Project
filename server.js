
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// MongoDB Connection
let db;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/admin_dashboard';

async function connectToMongo() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    
    console.log('Connected to MongoDB');
    db = client.db(process.env.MONGODB_DB || 'admin_dashboard');
    
    // Create collections if they don't exist
    if (!(await db.listCollections({ name: 'users' }).hasNext())) {
      await db.createCollection('users');
      // Create admin user if it doesn't exist
      const adminExists = await db.collection('users').findOne({ email: 'admin@example.com' });
      if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await db.collection('users').insertOne({
          name: 'Admin User',
          email: 'admin@example.com',
          password: hashedPassword,
          role: 'admin',
          createdAt: new Date()
        });
        console.log('Admin user created');
      }
    }
    
    if (!(await db.listCollections({ name: 'products' }).hasNext())) {
      await db.createCollection('products');
    }
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

// API Routes

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = {
      name,
      email,
      password: hashedPassword,
      role: 'admin', // Default role for now
      createdAt: new Date()
    };
    
    await db.collection('users').insertOne(newUser);
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.status(201).json({ success: true, user: userWithoutPassword });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({ success: true, user: userWithoutPassword });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Products Routes
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.collection('products').find().toArray();
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'Server error fetching products' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const product = {
      ...req.body,
      createdAt: new Date()
    };
    
    const result = await db.collection('products').insertOne(product);
    res.status(201).json({ ...product, id: result.insertedId });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ message: 'Server error creating product' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await db.collection('products').findOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ message: 'Server error fetching product' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const result = await db.collection('products').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const updatedProduct = await db.collection('products').findOne({
      _id: new ObjectId(req.params.id)
    });
    
    res.json(updatedProduct);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Server error updating product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await db.collection('products').deleteOne({
      _id: new ObjectId(req.params.id)
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'Server error deleting product' });
  }
});

// Handle image uploads (in a real app, you'd use something like multer and store in a cloud service)
// This is a placeholder endpoint
app.post('/api/upload', (req, res) => {
  // This would handle file uploads in a real implementation
  // For now, return a mock URL
  res.json({ 
    imageUrl: `https://images.unsplash.com/photo-${Date.now()}?auto=format&fit=crop&w=500&q=60` 
  });
});

// Serve React app for any request not matching an API route
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    res.json({ message: 'API server running in development mode' });
  }
});

// Start server
async function startServer() {
  await connectToMongo();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
