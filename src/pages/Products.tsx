import { useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useProducts, Product } from '@/contexts/ProductContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Package, Plus, MoreHorizontal, Pencil, Trash2, Search, Filter, ArrowDown, ArrowUp, Upload, RefreshCw, X, Wand2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

const Products = () => {
  const { products, isLoading, error, fetchProducts, createProduct, updateProduct, deleteProduct, uploadImages } = useProducts();
  const { token } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: 0,
    category: '',
    stock: 0,
    imageUrls: [] as string[],
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generationType, setGenerationType] = useState<'text' | 'image-description'>('text');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Product;
    direction: 'asc' | 'desc';
  } | null>(null);

  console.log('Products state:', { products, isLoading, error }); // Débogage

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortConfig) return 0;
    const key = sortConfig.key;
    if (a[key] < b[key]) return sortConfig.direction === 'asc' ? -1 : 1;
    if (a[key] > b[key]) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    if (newProduct.imageUrls.length + files.length > 4) {
      toast({
        title: 'Too many images',
        description: 'You can only upload up to 4 images.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const uploadedImageUrls = await uploadImages(files);
      setNewProduct({ ...newProduct, imageUrls: [...newProduct.imageUrls, ...uploadedImageUrls] });
      toast({
        title: 'Images uploaded',
        description: 'Images have been uploaded successfully.',
      });
    } catch (error: any) {
      console.error('Error uploading images:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload images. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setNewProduct({
      ...newProduct,
      imageUrls: newProduct.imageUrls.filter((_, i) => i !== index),
    });
  };

  const handleEditImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentProduct) return;
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    if (currentProduct.imageUrls.length + files.length > 4) {
      toast({
        title: 'Too many images',
        description: 'You can only upload up to 4 images.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const uploadedImageUrls = await uploadImages(files);
      setCurrentProduct({ ...currentProduct, imageUrls: [...currentProduct.imageUrls, ...uploadedImageUrls] });
      toast({
        title: 'Images updated',
        description: 'Product images have been updated.',
      });
    } catch (error: any) {
      console.error('Error updating images:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update images. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (editFileInputRef.current) editFileInputRef.current.value = '';
    }
  };

  const handleEditRemoveImage = (index: number) => {
    if (!currentProduct) return;
    setCurrentProduct({
      ...currentProduct,
      imageUrls: currentProduct.imageUrls.filter((_, i) => i !== index),
    });
  };

  const handleGenerateContent = async () => {
    if (!prompt) {
      toast({
        title: 'Missing prompt',
        description: 'Please provide a prompt for generating content.',
        variant: 'destructive',
      });
      return;
    }
    setIsGenerating(true);
    try {
     debugger; console.log('Generating content with prompt:', prompt, 'type:', generationType); // Débogage
      const response = await fetch('http://localhost:5000/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ prompt, type: generationType }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate content');
      }
      const data = await response.json();
      console.log('Generated content:', data); // Débogage
      if (data.result) {
        if (data.type === 'text') {
          console.log('prompt response',data.result);
          updateProduct(currentProduct._id,{ ...currentProduct, description: data.result });
          newProduct.description = data.result;
          toast({ title: 'Success', description: 'Description generated!' });
        } else if (data.type === 'image-description') {
          updateProduct(currentProduct._id,{ ...newProduct, description: `Image Description: ${data.result}` });
          toast({
            title: 'Success',
            description: 'Image description generated! Use this to create an image with an external tool.',
          });
        }
      } else {
        throw new Error('No content generated');
      }
    } catch (error: any) {
      console.error('Error generating content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate content. Please check the server logs.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
      setPrompt('');
    }
  };

  const validateProductFields = (product: { price: number; stock: number }) => {
    if (product.price < 0) {
      toast({
        title: 'Invalid Price',
        description: 'Price must be a positive number.',
        variant: 'destructive',
      });
      return false;
    }
    if (product.stock < 0) {
      toast({
        title: 'Invalid Stock',
        description: 'Stock must be a positive number.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.category) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    if (!validateProductFields(newProduct)) return;

    try {
      const createdProduct = await createProduct(newProduct);
      if (createdProduct) {
        setNewProduct({
          name: '',
          description: '',
          price: 0,
          category: '',
          stock: 0,
          imageUrls: [],
        });
        setIsAddDialogOpen(false);
        await fetchProducts(); // Rafraîchir la liste
        toast({
          title: 'Product created',
          description: 'The product has been created and synced with Shopify successfully.',
        });
      } else {
        throw new Error('Failed to create product');
      }
    } catch (error: any) {
      console.error('Error creating product:', error);
      toast({
        title: 'Error',
        description: error.message.includes('Shopify') ? error.message : 'Failed to create product. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEditProduct = async () => {
    if (!currentProduct) return;

    if (!currentProduct.name || !currentProduct.category) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    if (!validateProductFields(currentProduct)) return;

    try {
      const success = await updateProduct(currentProduct._id, currentProduct);
      if (success) {
        setIsEditDialogOpen(false);
        await fetchProducts(); // Rafraîchir la liste
        toast({
          title: 'Product updated',
          description: 'The product has been updated and synced with Shopify successfully.',
        });
      } else {
        throw new Error('Failed to update product');
      }
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast({
        title: 'Error',
        description: error.message.includes('Shopify') ? error.message : 'Failed to update product. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProduct = async () => {
    if (!currentProduct) return;

    try {
      const success = await deleteProduct(currentProduct._id);
      if (success) {
        setIsDeleteDialogOpen(false);
        await fetchProducts(); // Rafraîchir la liste
        toast({
          title: 'Product deleted',
          description: 'The product has been deleted and removed from Shopify successfully.',
        });
      } else {
        throw new Error('Failed to delete product');
      }
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Error',
        description: error.message.includes('Shopify') ? error.message : 'Failed to delete product. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchProducts();
      toast({
        title: 'Refreshed',
        description: 'Product list has been refreshed and synced with Shopify.',
      });
    } catch (error: any) {
      toast({
        title: 'Refresh failed',
        description: error.message.includes('Shopify') ? error.message : 'Failed to refresh product list.',
        variant: 'destructive',
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 bg-gray-900 text-white min-h-screen p-6 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Products</h1>
            <p className="text-sm text-gray-400 font-normal">Manage your product inventory</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 font-medium text-sm">
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 font-medium text-sm">
                  <Plus className="h-4 w-4" />
                  <span>Add Product</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl bg-black border border-gray-700 rounded-lg shadow-lg font-sans">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-white">Add New Product</DialogTitle>
                  <DialogDescription className="text-xs text-gray-400 font-normal">Enter the details for the new product. You can upload up to 4 images (first image will be the main image).</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right text-gray-400 text-sm font-medium">Name*</Label>
                    <Input
                      id="name"
                      className="col-span-3 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="description" className="text-right text-gray-400 text-sm font-medium">Description</Label>
                    <div className="col-span-3 flex flex-col gap-2">
                      <Textarea
                        id="description"
                        className="col-span-3 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder={
                            generationType === 'text'
                              ? 'Enter prompt (e.g., luxury watch)'
                              : 'Enter prompt for image (e.g., modern sports shoes)'
                          }
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          className="w-full sm:w-auto bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
                        />
                        <select
                          value={generationType}
                          onChange={(e) => setGenerationType(e.target.value as 'text' | 'image-description')}
                          className="w-full sm:w-[180px] bg-gray-800 border border-gray-600 text-white p-2 rounded"
                        >
                          <option value="text">Product Description</option>
                          <option value="image-description">Image Description</option>
                        </select>
                        <Button
                          onClick={handleGenerateContent}
                          disabled={isGenerating}
                          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                        >
                          {isGenerating ? (
                            <>
                              <svg
                                className="animate-spin h-4 w-4 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                              Generating...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-4 w-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="price" className="text-right text-gray-400 text-sm font-medium">Price (MAD)</Label>
                    <Input
                      id="price"
                      type="number"
                      className="col-span-3 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
                      value={newProduct.price}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setNewProduct({ ...newProduct, price: isNaN(value) ? 0 : value });
                      }}
                      min={0}
                      step="0.01"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category" className="text-right text-gray-400 text-sm font-medium">Category*</Label>
                    <Input
                      id="category"
                      className="col-span-3 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="stock" className="text-right text-gray-400 text-sm font-medium">Stock</Label>
                    <Input
                      id="stock"
                      type="number"
                      className="col-span-3 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
                      value={newProduct.stock}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setNewProduct({ ...newProduct, stock: isNaN(value) ? 0 : value });
                      }}
                      min={0}
                      step="1"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right mt-2 text-gray-400 text-sm font-medium">Product Images</Label>
                    <div className="col-span-3">
                      <div className="flex flex-col gap-2">
                        <input
                          type="file"
                          id="image"
                          accept="image/*"
                          className="hidden"
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                          multiple
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading || newProduct.imageUrls.length >= 4}
                            className="bg-gray-800 border-gray-600 text-blue-400 hover:bg-blue-900/50 font-medium text-sm"
                          >
                            {isUploading ? (
                              <>
                                <svg
                                  className="animate-spin h-4 w-4 text-blue-400"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  />
                                </svg>
                                <span className="ml-2">Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4" />
                                <span className="ml-2">Upload Images ({newProduct.imageUrls.length}/4)</span>
                              </>
                            )}
                          </Button>
                        </div>
                        {newProduct.imageUrls.length > 0 ? (
                          <div className="mt-2 grid grid-cols-4 gap-2">
                            {newProduct.imageUrls.map((url, index) => (
                              <div key={index} className="relative">
                                <div className="border border-gray-600 rounded-md overflow-hidden w-full h-[100px]">
                                  <img
                                    src={url}
                                    alt={`Product image ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = 'https://via.placeholder.com/100';
                                      console.error(`Failed to load image for new product: ${url}`);
                                    }}
                                  />
                                </div>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-1 right-1 h-6 w-6 bg-red-600 hover:bg-red-700"
                                  onClick={() => handleRemoveImage(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                {index === 0 && (
                                  <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs font-normal px-1 rounded">
                                    Main
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 border border-gray-600 rounded-md w-full h-[100px] flex items-center justify-center bg-gray-800">
                            <Package className="h-6 w-6 text-blue-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700 font-medium text-sm">
                    Cancel
                  </Button>
                  <Button onClick={handleCreateProduct} className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm">Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search products..."
              className="pl-8 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="flex gap-2 items-center ml-auto bg-gray-800 border-gray-600 text-blue-400 hover:bg-blue-900/50 font-medium text-sm">
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-900/20 border-red-700 text-red-400 font-sans">
            <AlertDescription className="text-sm font-normal">{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="text-center py-8 font-sans">
            <svg
              className="animate-spin h-8 w-8 text-blue-400 mx-auto"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-400 font-normal">Loading products...</p>
          </div>
        ) : (
          <div className="border border-gray-700 rounded-lg bg-black font-sans">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-800 hover:bg-gray-700">
                  <TableHead className="w-[80px] text-gray-400 text-sm font-medium">ID</TableHead>
                  <TableHead onClick={() => handleSort('name')} className="cursor-pointer text-gray-400 text-sm font-medium">
                    <div className="flex items-center gap-1">
                      Name
                      {sortConfig?.key === 'name' && (
                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-400" /> : <ArrowDown className="h-3 w-3 text-blue-400" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('category')} className="cursor-pointer text-gray-400 text-sm font-medium hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      Category
                      {sortConfig?.key === 'category' && (
                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-400" /> : <ArrowDown className="h-3 w-3 text-blue-400" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('price')} className="cursor-pointer text-gray-400 text-sm font-medium">
                    <div className="flex items-center gap-1">
                      Price
                      {sortConfig?.key === 'price' && (
                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-400" /> : <ArrowDown className="h-3 w-3 text-blue-400" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('stock')} className="cursor-pointer text-gray-400 text-sm font-medium">
                    <div className="flex items-center gap-1">
                      Stock
                      {sortConfig?.key === 'stock' && (
                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-400" /> : <ArrowDown className="h-3 w-3 text-blue-400" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-right text-gray-400 text-sm font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.length > 0 ? (
                  sortedProducts.map((product) => (
                    <TableRow key={product._id} className="border-gray-700 hover:bg-gray-800">
                      <TableCell className="font-medium text-white text-sm">{product._id.slice(0, 5)}...</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {product.imageUrls && product.imageUrls.length > 0 ? (
                            <div className="w-10 h-10 rounded-md overflow-hidden">
                              <img
                                src={product.imageUrls[0]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://via.placeholder.com/40';
                                  console.error(`Failed to load main image for ${product.name}: ${product.imageUrls[0]}`);
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-blue-900/50 flex items-center justify-center">
                              <Package className="h-4 w-4 text-blue-500" />
                            </div>
                          )}
                          <span className="text-white text-sm font-medium">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-400 text-sm font-normal">{product.category}</TableCell>
                      <TableCell className="text-blue-400 text-sm font-medium">{product.price.toFixed(2)} MAD</TableCell>
                      <TableCell className="text-white text-sm font-normal">{product.stock}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-blue-400">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-white font-sans">
                            <DropdownMenuItem
                              onClick={() => {
                                setCurrentProduct(product);
                                setIsEditDialogOpen(true);
                              }}
                              className="hover:bg-blue-900/50 text-sm font-normal"
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCurrentProduct(product);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="text-red-400 hover:bg-red-900/50 text-sm font-normal"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-400 text-sm font-normal">
                      {searchTerm ? 'No products found matching your search.' : 'No products added yet.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl bg-black border border-gray-700 rounded-lg shadow-lg font-sans">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-white">Edit Product</DialogTitle>
              <DialogDescription className="text-xs text-gray-400 font-normal">Update the product details. You can upload up to 4 images (first image will be the main image).</DialogDescription>
            </DialogHeader>
            {currentProduct && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right text-gray-400 text-sm font-medium">Name</Label>
                  <Input
                    id="edit-name"
                    className="col-span-3 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
                    value={currentProduct.name}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="edit-description" className="text-right text-gray-400 text-sm font-medium">Description</Label>
                  <div className="col-span-3 flex flex-col gap-2">
                    <Textarea
                      id="edit-description"
                      className="col-span-3 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
                      value={currentProduct.description}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, description: e.target.value })}
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder={
                          generationType === 'text'
                            ? 'Enter prompt (e.g., luxury watch)'
                            : 'Enter prompt for image (e.g., modern sports shoes)'
                        }
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full sm:w-auto bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
                      />
                      <select
                        value={generationType}
                        onChange={(e) => setGenerationType(e.target.value as 'text' | 'image-description')}
                        className="w-full sm:w-[180px] bg-gray-800 border border-gray-600 text-white p-2 rounded"
                      >
                        <option value="text">Product Description</option>
                        <option value="image-description">Image Description</option>
                      </select>
                      <Button
                        onClick={handleGenerateContent}
                        disabled={isGenerating}
                        className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                      >
                        {isGenerating ? (
                          <>
                            <svg
                              className="animate-spin h-4 w-4 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4" />
                            Generate
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-price" className="text-right text-gray-400 text-sm font-medium">Price (MAD)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    className="col-span-3 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
                    value={currentProduct.price}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setCurrentProduct({ ...currentProduct, price: isNaN(value) ? 0 : value });
                    }}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-category" className="text-right text-gray-400 text-sm font-medium">Category</Label>
                  <Input
                    id="edit-category"
                    className="col-span-3 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
                    value={currentProduct.category}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, category: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-stock" className="text-right text-gray-400 text-sm font-medium">Stock</Label>
                  <Input
                    id="edit-stock"
                    type="number"
                    className="col-span-3 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm font-normal"
                    value={currentProduct.stock}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setCurrentProduct({ ...currentProduct, stock: isNaN(value) ? 0 : value });
                    }}
                    min={0}
                    step="1"
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right mt-2 text-gray-400 text-sm font-medium">Product Images</Label>
                  <div className="col-span-3">
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        id="edit-image"
                        accept="image/*"
                        className="hidden"
                        ref={editFileInputRef}
                        onChange={handleEditImageUpload}
                        multiple
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => editFileInputRef.current?.click()}
                          disabled={isUploading || currentProduct.imageUrls.length >= 4}
                          className="bg-gray-800 border-gray-600 text-blue-400 hover:bg-blue-900/50 font-medium text-sm"
                        >
                          {isUploading ? (
                            <>
                              <svg
                                className="animate-spin h-4 w-4 text-blue-400"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                              <span className="ml-2">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4" />
                              <span className="ml-2">Upload Images ({currentProduct.imageUrls.length}/4)</span>
                            </>
                          )}
                        </Button>
                      </div>
                      {currentProduct.imageUrls.length > 0 ? (
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {currentProduct.imageUrls.map((url, index) => (
                            <div key={index} className="relative">
                              <div className="border border-gray-600 rounded-md overflow-hidden w-full h-[100px]">
                                <img
                                  src={url}
                                  alt={`Product image ${index + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://via.placeholder.com/100';
                                    console.error(`Failed to load image for ${currentProduct.name}: ${url}`);
                                  }}
                                />
                              </div>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6 bg-red-600 hover:bg-red-700"
                                onClick={() => handleEditRemoveImage(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              {index === 0 && (
                                <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs font-normal px-1 rounded">
                                  Main
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 border border-gray-600 rounded-md w-full h-[100px] flex items-center justify-center bg-gray-800">
                          <Package className="h-6 w-6 text-blue-500" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700 font-medium text-sm">
                Cancel
              </Button>
              <Button onClick={handleEditProduct} className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm">Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="bg-black border border-gray-700 rounded-lg shadow-lg font-sans">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-white">Delete Product</DialogTitle>
              <DialogDescription className="text-xs text-gray-400 font-normal">
                Are you sure you want to delete this product? This action cannot be undone and will remove the product from Shopify.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700 font-medium text-sm">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteProduct} className="bg-red-600 hover:bg-red-700 font-medium text-sm">Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Products;