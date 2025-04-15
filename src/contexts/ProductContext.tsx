
import React, { createContext, useContext, useState, useEffect } from 'react';

// Product type definition
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrl?: string;
  createdAt: string;
}

interface ProductContextType {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  getProduct: (id: string) => Product | undefined;
  createProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<Product | null>;
  updateProduct: (id: string, updates: Partial<Omit<Product, 'id'>>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
}

// Mock data for demo purposes
const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Laptop Pro',
    description: 'High performance laptop for professionals',
    price: 1299.99,
    category: 'Electronics',
    stock: 45,
    imageUrl: 'https://placehold.co/600x400',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Smartphone X',
    description: 'Latest smartphone with advanced features',
    price: 899.99,
    category: 'Electronics',
    stock: 120,
    imageUrl: 'https://placehold.co/600x400',
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Desk Chair',
    description: 'Ergonomic office chair for comfort',
    price: 249.99,
    category: 'Furniture',
    stock: 30,
    imageUrl: 'https://placehold.co/600x400',
    createdAt: new Date().toISOString()
  }
];

// Create context
const ProductContext = createContext<ProductContextType | undefined>(undefined);

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // In a real app, we would fetch from MongoDB here
      setProducts(MOCK_PRODUCTS);
    } catch (err) {
      setError('Failed to fetch products');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getProduct = (id: string) => {
    return products.find(p => p.id === id);
  };

  const createProduct = async (productData: Omit<Product, 'id' | 'createdAt'>): Promise<Product | null> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // In a real app, we would save to MongoDB
      const newProduct: Product = {
        ...productData,
        id: String(Date.now()),
        createdAt: new Date().toISOString()
      };
      
      setProducts(prev => [...prev, newProduct]);
      return newProduct;
    } catch (err) {
      console.error('Error creating product:', err);
      return null;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Omit<Product, 'id'>>): Promise<boolean> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // In a real app, we would update in MongoDB
      setProducts(prev => 
        prev.map(product => 
          product.id === id ? { ...product, ...updates } : product
        )
      );
      return true;
    } catch (err) {
      console.error('Error updating product:', err);
      return false;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // In a real app, we would delete from MongoDB
      setProducts(prev => prev.filter(product => product.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting product:', err);
      return false;
    }
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        isLoading,
        error,
        fetchProducts,
        getProduct,
        createProduct,
        updateProduct,
        deleteProduct
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

// Custom hook for using product context
export function useProducts() {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
}
