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
  imageUrl: string;
  createdAt: string;
}

interface ProductContextType {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  getProduct: (id: string) => Product | undefined;
  createProduct: (product: Omit<Product, '_id' | 'createdAt'>) => Promise<Product | null>;
  updateProduct: (id: string, updates: Partial<Omit<Product, '_id'>>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  uploadImage: (file: File) => Promise<string>;
}

// Create context
const ProductContext = createContext<ProductContextType | undefined>(undefined);

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch products on mount and when token changes
  useEffect(() => {
    if (token) {
      fetchProducts();
    } else {
      setIsLoading(false);
      setError('No authentication token available. Please log in.');
    }
  }, [token]);

  const fetchProducts = async () => {
    if (!token) {
      setError('Cannot fetch products: No authentication token available.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/api/products', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Invalid or expired token. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('Forbidden: You do not have permission to access this resource.');
        } else {
          throw new Error(`Failed to fetch products: ${response.statusText}`);
        }
      }

      const data = await response.json();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products');
      console.error('Error fetching products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getProduct = (id: string) => {
    return products.find((p) => p._id === id);
  };

  const uploadImage = async (file: File): Promise<string> => {
    if (!token) {
      throw new Error('Cannot upload image: No authentication token available.');
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Invalid or expired token. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('Forbidden: You do not have permission to access this resource.');
        } else {
          throw new Error(`Failed to upload image: ${response.statusText}`);
        }
      }

      const data = await response.json();
      return data.imageUrl;
    } catch (err: any) {
      console.error('Error uploading image:', err);
      throw new Error(err.message || 'Failed to upload image');
    }
  };

  const createProduct = async (productData: Omit<Product, '_id' | 'createdAt'>): Promise<Product | null> => {
    if (!token) {
      setError('Cannot create product: No authentication token available.');
      return null;
    }

    try {
      const response = await fetch('http://localhost:5000/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Invalid or expired token. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('Forbidden: You do not have permission to access this resource.');
        } else {
          throw new Error(`Failed to create product: ${response.statusText}`);
        }
      }

      const newProduct = await response.json();
      // Refresh the product list from the backend to ensure consistency
      await fetchProducts();
      return newProduct;
    } catch (err: any) {
      console.error('Error creating product:', err);
      setError(err.message || 'Failed to create product');
      return null;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Omit<Product, '_id'>>): Promise<boolean> => {
    if (!token) {
      setError('Cannot update product: No authentication token available.');
      return false;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Invalid or expired token. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('Forbidden: You do not have permission to access this resource.');
        } else if (response.status === 404) {
          throw new Error('Product not found.');
        } else {
          throw new Error(`Failed to update product: ${response.statusText}`);
        }
      }

      // Refresh the product list from the backend
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
      const response = await fetch(`http://localhost:5000/api/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Invalid or expired token. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('Forbidden: You do not have permission to access this resource.');
        } else if (response.status === 404) {
          throw new Error('Product not found.');
        } else {
          throw new Error(`Failed to delete product: ${response.statusText}`);
        }
      }

      // Refresh the product list from the backend
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
      value={{
        products,
        isLoading,
        error,
        fetchProducts,
        getProduct,
        createProduct,
        updateProduct,
        deleteProduct,
        uploadImage,
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