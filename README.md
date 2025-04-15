# Admin Dashboard with MongoDB Atlas Integration

A clean, modern admin dashboard with product management capabilities and authentication.

## Features

- User authentication (sign up & sign in)
- Dashboard overview with key metrics
- Product management (create, read, update, delete)
- MongoDB Atlas integration for data storage
- Responsive design for all devices

## MongoDB Atlas Setup

To connect this dashboard to your MongoDB Atlas database:

1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster
3. In the Security section, create a database user with read/write permissions
4. In the Network Access section, add your IP address or allow access from anywhere
5. Get your connection string from the Connect section
6. Create a .env file in your project root with:

```
VITE_MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
VITE_MONGODB_DB=admin_dashboard
```

Replace `<username>`, `<password>`, `<cluster>`, and `<dbname>` with your actual values.

## Tech Stack

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- MongoDB Atlas (for backend storage)

## Getting Started

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies
npm i

# Step 4: Create a .env file with your MongoDB connection details
echo "VITE_MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>" > .env
echo "VITE_MONGODB_DB=admin_dashboard" >> .env

# Step 5: Start the development server
npm run dev
```

## Demo Account

For testing purposes, you can use the following credentials:
- Email: admin@example.com
- Password: admin123

## Project Structure

- `src/pages/` - All page components
- `src/components/` - Reusable UI components
- `src/contexts/` - React context providers
- `src/lib/` - Utility functions and configuration
