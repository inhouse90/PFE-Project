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
import { Package, Plus, MoreHorizontal, Pencil, Trash2, Search, Filter, ArrowDown, ArrowUp, Upload, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Products = () => {
  const { products, isLoading, error, fetchProducts, createProduct, updateProduct, deleteProduct, uploadImage } = useProducts();
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
    imageUrl: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Product;
    direction: 'asc' | 'desc';
  } | null>(null);

  // Filtering products based on search term
  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sorting products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortConfig) return 0;

    const key = sortConfig.key;

    if (a[key] < b[key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[key] > b[key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const handleSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';

    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    setSortConfig({ key, direction });
  };

  // Handle image upload for new product
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const imageUrl = await uploadImage(file);
      setNewProduct({ ...newProduct, imageUrl });
      toast({
        title: 'Image uploaded',
        description: 'Image has been uploaded successfully.',
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle image upload for editing product
  const handleEditImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentProduct) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const imageUrl = await uploadImage(file);
      setCurrentProduct({ ...currentProduct, imageUrl });
      toast({
        title: 'Image updated',
        description: 'Product image has been updated.',
      });
    } catch (error: any) {
      console.error('Error updating image:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Validate price and stock
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

  // Handle create product
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
          imageUrl: '',
        });
        setIsAddDialogOpen(false);
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

  // Handle edit product
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

  // Handle delete product
  const handleDeleteProduct = async () => {
    if (!currentProduct) return;

    try {
      const success = await deleteProduct(currentProduct._id);
      if (success) {
        setIsDeleteDialogOpen(false);
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

  // Handle manual refresh
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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Products</h1>
            <p className="text-gray-500">Manage your product inventory</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Product</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Product</DialogTitle>
                  <DialogDescription>Enter the details for the new product.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name*
                    </Label>
                    <Input
                      id="name"
                      className="col-span-3"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      className="col-span-3"
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="price" className="text-right">
                      Price ($)
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      className="col-span-3"
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
                    <Label htmlFor="category" className="text-right">
                      Category*
                    </Label>
                    <Input
                      id="category"
                      className="col-span-3"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="stock" className="text-right">
                      Stock
                    </Label>
                    <Input
                      id="stock"
                      type="number"
                      className="col-span-3"
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
                    <Label htmlFor="image" className="text-right mt-2">
                      Product Image
                    </Label>
                    <div className="col-span-3">
                      <div className="flex flex-col gap-2">
                        <input
                          type="file"
                          id="image"
                          accept="image/*"
                          className="hidden"
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="flex items-center gap-2"
                          >
                            {isUploading ? (
                              <>
                                <svg
                                  className="animate-spin h-4 w-4 text-primary"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                                <span>Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4" />
                                <span>Upload Image</span>
                              </>
                            )}
                          </Button>
                        </div>
                        {newProduct.imageUrl ? (
                          <div className="mt-2">
                            <div className="border rounded-md overflow-hidden w-full max-w-[200px] h-[150px]">
                              <img
                                src={newProduct.imageUrl}
                                alt="Product preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 border rounded-md w-full max-w-[200px] h-[150px] flex items-center justify-center bg-gray-100">
                            <Package className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateProduct}>Save</Button>
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
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="flex gap-2 items-center ml-auto">
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <svg
              className="animate-spin h-8 w-8 text-primary mx-auto"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="mt-2 text-gray-500">Loading products...</p>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead onClick={() => handleSort('name')} className="cursor-pointer">
                    <div className="flex items-center gap-1">
                      Name
                      {sortConfig?.key === 'name' && (
                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('category')} className="cursor-pointer hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      Category
                      {sortConfig?.key === 'category' && (
                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('price')} className="cursor-pointer">
                    <div className="flex items-center gap-1">
                      Price
                      {sortConfig?.key === 'price' && (
                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('stock')} className="cursor-pointer">
                    <div className="flex items-center gap-1">
                      Stock
                      {sortConfig?.key === 'stock' && (
                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.length > 0 ? (
                  sortedProducts.map((product) => (
                    <TableRow key={product._id}>
                      <TableCell className="font-medium">{product._id.slice(0, 5)}...</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {product.imageUrl ? (
                            <div className="w-10 h-10 rounded-md overflow-hidden">
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center">
                              <Package className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          <span>{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{product.category}</TableCell>
                      <TableCell>${product.price.toFixed(2)}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setCurrentProduct(product);
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCurrentProduct(product);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="text-red-600"
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
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchTerm ? 'No products found matching your search.' : 'No products added yet.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update the product details.</DialogDescription>
          </DialogHeader>
          {currentProduct && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="edit-name"
                  className="col-span-3"
                  value={currentProduct.name}
                  onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  Description
                </Label>
                <Textarea
                  id="edit-description"
                  className="col-span-3"
                  value={currentProduct.description}
                  onChange={(e) => setCurrentProduct({ ...currentProduct, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-price" className="text-right">
                  Price ($)
                </Label>
                <Input
                  id="edit-price"
                  type="number"
                  className="col-span-3"
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
                <Label htmlFor="edit-category" className="text-right">
                  Category
                </Label>
                <Input
                  id="edit-category"
                  className="col-span-3"
                  value={currentProduct.category}
                  onChange={(e) => setCurrentProduct({ ...currentProduct, category: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-stock" className="text-right">
                  Stock
                </Label>
                <Input
                  id="edit-stock"
                  type="number"
                  className="col-span-3"
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
                <Label htmlFor="edit-image" className="text-right mt-2">
                  Product Image
                </Label>
                <div className="col-span-3">
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      id="edit-image"
                      accept="image/*"
                      className="hidden"
                      ref={editFileInputRef}
                      onChange={handleEditImageUpload}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => editFileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2"
                      >
                        {isUploading ? (
                          <>
                            <svg
                              className="animate-spin h-4 w-4 text-primary"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            <span>Change Image</span>
                          </>
                        )}
                      </Button>
                    </div>
                    {currentProduct.imageUrl ? (
                      <div className="mt-2">
                        <div className="border rounded-md overflow-hidden w-full max-w-[200px] h-[150px]">
                          <img
                            src={currentProduct.imageUrl}
                            alt="Product preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 border rounded-md w-full max-w-[200px] h-[150px] flex items-center justify-center bg-gray-100">
                        <Package className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditProduct}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Product Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this product? This action cannot be undone and will remove the product from Shopify.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Products;