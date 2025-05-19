import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

// Product type definition
export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrls: string[];
  createdAt: string;
  shopifyProductId?: string;
}

// Order type definition
export interface Order {
  _id: string;
  shopifyOrderId: string;
  orderNumber: number;
  customer: { firstName: string; lastName: string; email: string } | null;
  totalPrice: number;
  currency: string;
  status: string;
  fulfillmentStatus: string;
  lineItems: { productId: string; variantId: string; title: string; quantity: number; price: number }[];
  createdAt: string;
  updatedAt: string;
}

interface ProductContextType {
  products: Product[];
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  getProduct: (id: string) => Product | undefined;
  createProduct: (product: Omit<Product, '_id' | 'createdAt' | 'shopifyProductId'>) => Promise<Product | null>;
  updateProduct: (id: string, updates: Partial<Omit<Product, '_id' | 'shopifyProductId'>>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  uploadImages: (files: File[]) => Promise<string[]>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      Promise.all([fetchProducts(), fetchOrders()])
        .catch(err => setError('Failed to load data: ' + err.message))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
      setError('No authentication token available. Please log in.');
    }
  }, [token]);

  const fetchProducts = async () => {
    if (!token) {
      setError('Cannot fetch products: No authentication token available.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/products', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error((await response.json()).message || `Failed to fetch products: ${response.statusText}`);
      setProducts(await response.json());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products');
      console.error('Error fetching products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrders = async () => {
    if (!token) {
      setError('Cannot fetch orders: No authentication token available.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/orders', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error((await response.json()).message || `Failed to fetch orders: ${response.statusText}`);
      setOrders(await response.json());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
      console.error('Error fetching orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getProduct = (id: string) => products.find((p) => p._id === id);

  const uploadImages = async (files: File[]): Promise<string[]> => {
    if (!token) throw new Error('Cannot upload images: No authentication token available.');
    if (files.length === 0) throw new Error('No files selected for upload.');
    if (files.length > 4) throw new Error('You can only upload up to 4 images.');

    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));

    try {
      const response = await fetch('http://localhost:5000/api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
      if (!response.ok) throw new Error((await response.json()).message || `Failed to upload images: ${response.statusText}`);
      return (await response.json()).imageUrls;
    } catch (err: any) {
      console.error('Error uploading images:', err);
      throw new Error(err.message || 'Failed to upload images');
    }
  };

  const createProduct = async (productData: Omit<Product, '_id' | 'createdAt' | 'shopifyProductId'>): Promise<Product | null> => {
    if (!token) {
      setError('Cannot create product: No authentication token available.');
      return null;
    }
    if (!productData.name || !productData.category) {
      setError('Name and category are required.');
      return null;
    }
    if (productData.price < 0) {
      setError('Price must be a positive number.');
      return null;
    }
    if (productData.stock < 0) {
      setError('Stock must be a positive number.');
      return null;
    }

    try {
      const response = await fetch('http://localhost:5000/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(productData) });
      if (!response.ok) throw new Error((await response.json()).message || `Failed to create product: ${response.statusText}`);
      const newProduct = await response.json();
      await fetchProducts();
      return newProduct;
    } catch (err: any) {
      console.error('Error creating product:', err);
      setError(err.message || 'Failed to create product');
      return null;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Omit<Product, '_id' | 'shopifyProductId'>>): Promise<boolean> => {
    if (!token) {
      setError('Cannot update product: No authentication token available.');
      return false;
    }
    if (updates.name && !updates.name) {
      setError('Name is required.');
      return false;
    }
    if (updates.category && !updates.category) {
      setError('Category is required.');
      return false;
    }
    if (updates.price !== undefined && updates.price < 0) {
      setError('Price must be a positive number.');
      return false;
    }
    if (updates.stock !== undefined && updates.stock < 0) {
      setError('Stock must be a positive number.');
      return false;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(updates) });
      if (!response.ok) throw new Error((await response.json()).message || `Failed to update product: ${response.statusText}`);
      await fetchProducts();
      return true;
    } catch (err: any) {
      console.error('Error updating product:', err);
      setError(err.message || 'Failed to update product');
      return false;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    if (!token) {
      setError('Cannot delete product: No authentication token available.');
      return false;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/products/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error((await response.json()).message || `Failed to delete product: ${response.statusText}`);
      await fetchProducts();
      return true;
    } catch (err: any) {
      console.error('Error deleting product:', err);
      setError(err.message || 'Failed to delete product');
      return false;
    }
  };

  return (
    <ProductContext.Provider
      value={{ products, orders, isLoading, error, fetchProducts, fetchOrders, getProduct, createProduct, updateProduct, deleteProduct, uploadImages }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductContext);
  if (context === undefined) throw new Error('useProducts must be used within a ProductProvider');
  return context;
}