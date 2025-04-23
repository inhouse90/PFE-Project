const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN ;
const SHOPIFY_STORE_NAME = process.env.SHOPIFY_STORE_NAME || 'jaaagd-tz';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploaded images
const uploadDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

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
      const adminExists = await db.collection('users').findOne({ email: 'admin@example.com' });
      if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await db.collection('users').insertOne({
          name: 'Admin User',
          email: 'admin@example.com',
          password: hashedPassword,
          role: 'admin',
          createdAt: new Date(),
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

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png) are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Shopify API Helper Functions
const shopifyApiBaseUrl = `https://${SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2024-10`;

// Log the base URL to debug
console.log('Shopify API Base URL:', shopifyApiBaseUrl);

// Validate the URL format
try {
  new URL(shopifyApiBaseUrl);
} catch (err) {
  console.error('Invalid Shopify API Base URL:', shopifyApiBaseUrl);
  throw new Error('Invalid Shopify API Base URL configuration');
}

const shopifyApi = axios.create({
  baseURL: shopifyApiBaseUrl,
  headers: {
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json',
  },
});

// Sync product with Shopify
const syncProductToShopify = async (product) => {
  try {
    // Validate product data
    if (!product.name) {
      throw new Error('Product name is required');
    }
    if (!product.price || product.price < 0) {
      throw new Error('Valid product price is required');
    }

    const shopifyProduct = {
      product: {
        title: product.name,
        body_html: product.description || '',
        vendor: 'Your Vendor Name',
        product_type: product.category || 'Uncategorized',
        images: product.imageUrl ? [{ src: product.imageUrl }] : [],
        variants: [
          {
            price: product.price.toFixed(2),
            inventory_quantity: product.stock || 0,
            inventory_management: 'shopify',
          },
        ],
        status: 'active', // Ensure product is published
      },
    };

    console.log('Syncing product to Shopify:', JSON.stringify(shopifyProduct, null, 2));

    const response = await shopifyApi.post('/products.json', shopifyProduct);
    const shopifyProductId = response.data.product.id;

    console.log(`Product created in Shopify with ID: ${shopifyProductId}`);

    // Update MongoDB with Shopify product ID
    await db.collection('products').updateOne(
      { _id: new ObjectId(product._id) },
      { $set: { shopifyProductId: shopifyProductId.toString() } }
    );

    return shopifyProductId;
  } catch (err) {
    console.error('Error syncing product to Shopify:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    throw new Error(`Failed to sync product with Shopify: ${err.message}`);
  }
};

// Update product on Shopify
const updateProductOnShopify = async (shopifyProductId, product) => {
  try {
    // Validate product data
    if (!product.name) {
      throw new Error('Product name is required');
    }
    if (product.price !== undefined && product.price < 0) {
      throw new Error('Valid product price is required');
    }

    const shopifyProduct = {
      product: {
        id: shopifyProductId,
        title: product.name,
        body_html: product.description || '',
        product_type: product.category || 'Uncategorized',
        variants: [
          {
            price: product.price.toFixed(2),
            inventory_quantity: product.stock || 0,
          },
        ],
      },
    };

    if (product.imageUrl) {
      shopifyProduct.product.images = [{ src: product.imageUrl }];
    }

    console.log(`Updating product ${shopifyProductId} in Shopify:`, JSON.stringify(shopifyProduct, null, 2));

    const response = await shopifyApi.put(`/products/${shopifyProductId}.json`, shopifyProduct);
    console.log(`Product ${shopifyProductId} updated in Shopify`);

    return response.data;
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn(`Product with ID ${shopifyProductId} not found in Shopify, attempting to create new product`);
      return await syncProductToShopify({ ...product, _id: product._id });
    }
    console.error('Error updating product on Shopify:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    throw new Error(`Failed to update product on Shopify: ${err.message}`);
  }
};

// Delete product from Shopify
const deleteProductFromShopify = async (shopifyProductId) => {
  try {
    await shopifyApi.delete(`/products/${shopifyProductId}.json`);
    console.log(`Product ${shopifyProductId} deleted from Shopify`);
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn(`Product with ID ${shopifyProductId} not found in Shopify, proceeding with local deletion`);
      return;
    }
    console.error('Error deleting product from Shopify:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    throw new Error(`Failed to delete product from Shopify: ${err.message}`);
  }
};

// Fetch products from Shopify and sync with MongoDB
const syncProductsFromShopify = async () => {
  try {
    console.log('Attempting to fetch products from Shopify...');
    const response = await shopifyApi.get('/products.json');
    console.log('Shopify API Response:', response.data);
    const shopifyProducts = response.data.products;

    // Get all shopifyProductIds from Shopify
    const shopifyProductIds = shopifyProducts.map(p => p.id.toString());

    // Remove products from MongoDB that no longer exist in Shopify
    await db.collection('products').deleteMany({
      shopifyProductId: { $nin: shopifyProductIds }
    });

    for (const shopifyProduct of shopifyProducts) {
      const existingProduct = await db.collection('products').findOne({ shopifyProductId: shopifyProduct.id.toString() });

      const productData = {
        name: shopifyProduct.title,
        description: shopifyProduct.body_html || '',
        price: parseFloat(shopifyProduct.variants[0].price) || 0,
        category: shopifyProduct.product_type || 'Uncategorized',
        stock: shopifyProduct.variants[0].inventory_quantity || 0,
        imageUrl: shopifyProduct.images[0]?.src || '',
        createdAt: new Date(shopifyProduct.created_at),
        shopifyProductId: shopifyProduct.id.toString(),
      };

      if (existingProduct) {
        // Update existing product
        await db.collection('products').updateOne(
          { shopifyProductId: shopifyProduct.id.toString() },
          { $set: productData }
        );
      } else {
        // Insert new product
        await db.collection('products').insertOne(productData);
      }
    }
  } catch (err) {
    console.error('Error syncing products from Shopify:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    throw new Error(`Failed to sync products from Shopify: ${err.message}`);
  }
};

// API Routes

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      name,
      email,
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date(),
    };

    const result = await db.collection('users').insertOne(newUser);

    const token = jwt.sign(
      { id: result.insertedId.toString(), email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { password: _, ...userWithoutPassword } = newUser;
    userWithoutPassword._id = result.insertedId;

    res.status(201).json({ success: true, user: userWithoutPassword, token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({ success: true, user: userWithoutPassword, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Products Routes (Protected with JWT)
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    // Sync with Shopify before returning products
    await syncProductsFromShopify();
    const products = await db.collection('products').find().toArray();
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'Server error fetching products', error: err.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const product = {
      ...req.body,
      createdAt: new Date(),
    };

    // Validate required fields
    if (!product.name || !product.category) {
      return res.status(400).json({ message: 'Name and category are required' });
    }
    if (product.price < 0 || product.stock < 0) {
      return res.status(400).json({ message: 'Price and stock must be positive numbers' });
    }

    const result = await db.collection('products').insertOne(product);
    const insertedProduct = { ...product, _id: result.insertedId };

    // Sync with Shopify
    try {
      const shopifyProductId = await syncProductToShopify(insertedProduct);
      insertedProduct.shopifyProductId = shopifyProductId.toString();
    } catch (shopifyErr) {
      console.error('Shopify sync failed, rolling back MongoDB insertion:', shopifyErr.message);
      await db.collection('products').deleteOne({ _id: result.insertedId });
      return res.status(500).json({ message: 'Failed to sync product with Shopify', error: shopifyErr.message });
    }

    res.status(201).json(insertedProduct);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ message: 'Server error creating product', error: err.message });
  }
});

app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await db.collection('products').findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ message: 'Server error fetching product', error: err.message });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = { ...req.body };
    delete product._id;

    // Validate required fields
    if (product.name && !product.name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (product.category && !product.category) {
      return res.status(400).json({ message: 'Category is required' });
    }
    if (product.price !== undefined && product.price < 0) {
      return res.status(400).json({ message: 'Price must be a positive number' });
    }
    if (product.stock !== undefined && product.stock < 0) {
      return res.status(400).json({ message: 'Stock must be a positive number' });
    }

    const existingProduct = await db.collection('products').findOne({ _id: new ObjectId(req.params.id) });

    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const result = await db.collection('products').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: product }
    );

    try {
      if (existingProduct.shopifyProductId) {
        const shopifyProductId = await updateProductOnShopify(existingProduct.shopifyProductId, { ...product, _id: req.params.id });
        if (shopifyProductId) {
          // Update MongoDB with new shopifyProductId if a new product was created
          await db.collection('products').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { shopifyProductId: shopifyProductId.toString() } }
          );
        }
      } else {
        // If no Shopify ID exists, sync as a new product
        const shopifyProductId = await syncProductToShopify({ ...product, _id: req.params.id });
        await db.collection('products').updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { shopifyProductId: shopifyProductId.toString() } }
        );
      }
    } catch (shopifyErr) {
      console.error('Shopify update failed, but product updated locally:', shopifyErr.message);
      return res.status(500).json({ message: 'Failed to sync product with Shopify', error: shopifyErr.message });
    }

    res.json({ message: 'Product updated successfully', result });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Error updating product', error: err.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const existingProduct = await db.collection('products').findOne({ _id: new ObjectId(req.params.id) });

    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log('Attempting to delete product with shopifyProductId:', existingProduct.shopifyProductId);

    if (existingProduct.shopifyProductId) {
      await deleteProductFromShopify(existingProduct.shopifyProductId);
    }

    const result = await db.collection('products').deleteOne({
      _id: new ObjectId(req.params.id),
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'Server error deleting product', error: err.message });
  }
});

// Image Upload Route
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (err) {
    console.error('Error uploading image:', err);
    res.status(500).json({ message: 'Server error uploading image', error: err.message });
  }
});

// Serve React frontend (in production)
app.get(/^\/(?!api).*/, (req, res) => {
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