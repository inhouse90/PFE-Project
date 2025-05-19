import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useProducts, Order } from '@/contexts/ProductContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Search, RefreshCw, ShoppingCart, Info, FileText, Mail, MessageSquare } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const Orders = () => {
  const { orders, isLoading, error, fetchOrders } = useProducts();
  const { token } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingSMS, setIsSendingSMS] = useState(false);

  const filteredOrders = orders.filter(
    (order) =>
      order.orderNumber.toString().includes(searchTerm) ||
      (order.customer?.email?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
      order.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRefresh = async () => {
    try {
      await fetchOrders();
      toast({ title: 'Refreshed', description: 'Order list synced with Shopify.' });
    } catch (error: any) {
      toast({ title: 'Refresh failed', description: error.message || 'Failed to refresh orders.', variant: 'destructive' });
    }
  };

  const handleViewDetails = async (order: Order) => {
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${order._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch order details');
      const orderDetails = await response.json();
      setSelectedOrder(orderDetails);
      setIsDetailsDialogOpen(true);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to fetch order details.', variant: 'destructive' });
    }
  };

  const handleGeneratePDF = async (order: Order) => {
    setIsGeneratingPDF(true);
    try {
      const doc = new jsPDF();
      const logoUrl = '/logo-shopify.png';
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.addImage(logoUrl, 'PNG', 20, 10, 30, 15);
      doc.setFontSize(12);
      doc.text(`Bill #${order.orderNumber}`, 60, 20);
      doc.setFontSize(10);
      doc.text('30-day billing cycle', 60, 30);
      doc.text(`Paid on ${new Date(order.createdAt).toLocaleDateString()}`, 60, 40);
      doc.text(new Date(order.createdAt).toLocaleDateString(), 60, 50);

      doc.setFillColor(240, 240, 240);
      doc.rect(20, 60, pageWidth - 40, 50, 'F');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('shopify', 30, 70);
      doc.setFontSize(10);
      doc.text('Shopify International Limited', 30, 80);
      doc.text('2nd Floor, 1-2 Victoria Buildings', 30, 90);
      doc.text('Haddington Road', 30, 100);
      doc.text('Dublin 4, D04 XN32, Ireland', 30, 110);

      doc.setFillColor(255, 255, 255);
      doc.rect(pageWidth - 60, 60, 40, 50, 'F');
      doc.setFontSize(14);
      doc.text('TOTAL DUE', pageWidth - 50, 70, { align: 'right' });
      doc.text(`${order.totalPrice.toFixed(2)} ${order.currency}`, pageWidth - 50, 80, { align: 'right' });
      doc.setFontSize(10);
      doc.text('Visa ending in 4843', pageWidth - 50, 90, { align: 'right' });

      doc.setFillColor(240, 240, 240);
      doc.rect(20, 120, pageWidth - 40, 80, 'F');
      doc.setFontSize(14);
      doc.text('OVERVIEW', 30, 130);
      doc.setFontSize(12);
      doc.text('Shop Store', 30, 140);
      doc.text(`Subscription (${order.lineItems.length} item${order.lineItems.length !== 1 ? 's' : ''})`, 30, 150);
      doc.text(`${order.totalPrice.toFixed(2)} ${order.currency}`, pageWidth - 30, 150, { align: 'right' });

      doc.text('Credit', 30, 170);
      doc.text('0.00 USD', pageWidth - 30, 170, { align: 'right' });
      doc.text('Subtotal', 30, 180);
      doc.text(`${order.totalPrice.toFixed(2)} ${order.currency}`, pageWidth - 30, 180, { align: 'right' });
      doc.text('Total', 30, 190);
      doc.text(`${order.totalPrice.toFixed(2)} ${order.currency}`, pageWidth - 30, 190, { align: 'right' });

      doc.setFontSize(10);
      doc.text('Account billed', 30, 210);
      doc.text('Shop Store', 30, 220);
      doc.text(order.customer?.email || 'N/A', 30, 230);
      doc.text(order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'N/A', 30, 240);

      doc.text('Payment status', 30, 260);
      doc.text(`Bill created ${new Date(order.createdAt).toLocaleDateString()}`, 30, 270);
      doc.text(`Bill paid ${new Date(order.createdAt).toLocaleDateString()}`, 30, 280);

      doc.text('Learn more about your bill in the Shopify Help Center: https://help.shopify.com/', 30, 290);
      doc.text('Page 1/2', pageWidth - 20, 290, { align: 'right' });

      doc.addPage();
      doc.addImage(logoUrl, 'PNG', 20, 10, 30, 15);
      doc.setFontSize(12);
      doc.text(`Bill #${order.orderNumber}`, 60, 20);
      doc.setFontSize(10);
      doc.text('30-day billing cycle', 60, 30);
      doc.text(`Paid on ${new Date(order.createdAt).toLocaleDateString()}`, 60, 40);
      doc.text(new Date(order.createdAt).toLocaleDateString(), 60, 50);

      doc.setFillColor(240, 240, 240);
      doc.rect(20, 60, pageWidth - 40, 50, 'F');
      doc.setFontSize(14);
      doc.text('shopify', 30, 70);
      doc.setFontSize(10);
      doc.text('Shopify International Limited', 30, 80);
      doc.text('2nd Floor, 1-2 Victoria Buildings', 30, 90);
      doc.text('Haddington Road', 30, 100);
      doc.text('Dublin 4, D04 XN32, Ireland', 30, 110);

      doc.setFillColor(240, 240, 240);
      doc.rect(20, 120, pageWidth - 40, 80, 'F');
      doc.setFontSize(14);
      doc.text('DETAILED VIEW', 30, 130);
      doc.setFontSize(12);
      doc.text('Shop Store', 30, 140);
      doc.text(`Subscription (${order.lineItems.length} item${order.lineItems.length !== 1 ? 's' : ''})`, 30, 150);
      doc.text(`${order.totalPrice.toFixed(2)} ${order.currency}`, pageWidth - 30, 150, { align: 'right' });

      doc.text('Grow plan', 30, 170);
      doc.text(`${order.totalPrice.toFixed(2)} ${order.currency}`, pageWidth - 30, 170, { align: 'right' });
      doc.text('Every 30 days', 30, 180);

      doc.text('Credit', 30, 200);
      doc.text('0.00 USD', pageWidth - 30, 200, { align: 'right' });
      doc.text('Subtotal', 30, 210);
      doc.text(`${order.totalPrice.toFixed(2)} ${order.currency}`, pageWidth - 30, 210, { align: 'right' });
      doc.text('Total', 30, 220);
      doc.text(`${order.totalPrice.toFixed(2)} ${order.currency}`, pageWidth - 30, 220, { align: 'right' });

      doc.setFontSize(10);
      doc.text('Learn more about your bill in the Shopify Help Center: https://help.shopify.com/', 30, 290);
      doc.text('Page 2/2', pageWidth - 20, 290, { align: 'right' });

      doc.save(`order_${order.orderNumber}.pdf`);
      toast({ title: 'PDF Generated', description: 'Order invoice has been downloaded.' });
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to generate PDF.', variant: 'destructive' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSendEmail = async (order: Order) => {
    setIsSendingEmail(true);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${order._id}/send-confirmation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to send email');
      toast({ title: 'Email Sent', description: 'Confirmation email sent successfully.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send confirmation email.', variant: 'destructive' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendSMS = async (order: Order) => {
    setIsSendingSMS(true);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${order._id}/send-sms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to send SMS');
      toast({ title: 'SMS Sent', description: 'Confirmation SMS sent successfully.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send confirmation SMS.', variant: 'destructive' });
    } finally {
      setIsSendingSMS(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Orders</h1>
            <p className="text-gray-500">View your Shopify orders</p>
          </div>
          <Button className="flex items-center gap-2" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search orders..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <svg className="animate-spin h-8 w-8 text-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-2 text-gray-500">Loading orders...</p>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Fulfillment Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <TableRow key={order._id}>
                      <TableCell>#{order.orderNumber}</TableCell>
                      <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'N/A'}</TableCell>
                      <TableCell>{order.totalPrice.toFixed(2)} {order.currency}</TableCell>
                      <TableCell>{order.status}</TableCell>
                      <TableCell>{order.fulfillmentStatus}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            className="button-outline"
                            size="icon"
                            onClick={() => handleViewDetails(order)}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                          <Button
                            className="button-outline"
                            size="icon"
                            onClick={() => handleGeneratePDF(order)}
                            disabled={isGeneratingPDF}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            className="button-outline"
                            size="icon"
                            onClick={() => handleSendEmail(order)}
                            disabled={isSendingEmail || !order.customer?.email}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            className="button-outline"
                            size="icon"
                            onClick={() => handleSendSMS(order)}
                            disabled={isSendingSMS || !order.customer?.phone}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {searchTerm ? 'No orders found matching your search.' : 'No orders found.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-2xl bg-white rounded-lg shadow-lg p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-900 border-b pb-2">Order Details</DialogTitle>
              <DialogDescription className="text-gray-600 mt-2">
                Detailed information about the selected order.
              </DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <div className="mt-4 space-y-6">
                <div className="bg-gray-100 p-4 rounded-md shadow-sm">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Order Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-gray-700">
                    <div><span className="font-medium">Order Number:</span> #{selectedOrder.orderNumber}</div>
                    <div><span className="font-medium">Date:</span> {new Date(selectedOrder.createdAt).toLocaleDateString()}</div>
                    <div><span className="font-medium">Total:</span> {selectedOrder.totalPrice.toFixed(2)} {selectedOrder.currency}</div>
                    <div><span className="font-medium">Payment Status:</span> {selectedOrder.status}</div>
                    <div><span className="font-medium">Fulfillment Status:</span> {selectedOrder.fulfillmentStatus}</div>
                  </div>
                </div>
                <div className="bg-gray-100 p-4 rounded-md shadow-sm">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-gray-700">
                    <div><span className="font-medium">Name:</span> {selectedOrder.customer ? `${selectedOrder.customer.firstName} ${selectedOrder.customer.lastName}` : 'N/A'}</div>
                    <div><span className="font-medium">Email:</span> {selectedOrder.customer?.email || 'N/A'}</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-lg font-semibold text-gray-800">Items</h3>
                  <ul className="mt-2 space-y-2">
                    {selectedOrder.lineItems.map((item, index) => (
                      <li key={index} className="text-gray-700">
                        <span className="font-medium">{item.title}</span> - Quantity: {item.quantity} - Price: {item.price.toFixed(2)} {selectedOrder.currency}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Orders;