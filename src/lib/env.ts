
// Environment variable utilities

interface EnvVariables {
  MONGODB_URI?: string;
  MONGODB_DB?: string;
}

// For development, provide a mock MongoDB connection
// In production, these would be real environment variables
const developmentEnv: EnvVariables = {
  MONGODB_URI: "mongodb+srv://your-username:your-password@cluster0.mongodb.net/admin_dashboard",
  MONGODB_DB: "admin_dashboard"
};

// Get environment variables with fallbacks
export function getEnvVariable(key: keyof EnvVariables): string | undefined {
  // First check for real environment variables
  const envValue = import.meta.env[`VITE_${key}`];
  
  if (envValue) {
    return envValue;
  }
  
  // Use development fallbacks when in development mode
  if (import.meta.env.DEV) {
    return developmentEnv[key];
  }
  
  return undefined;
}

// Instructions for setting up MongoDB connection
export const mongoDbSetupInstructions = `
# MongoDB Atlas Connection Setup

To connect this admin dashboard to your MongoDB Atlas database:

1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster
3. In the Security section, create a database user with read/write permissions
4. In the Network Access section, add your IP address or allow access from anywhere
5. Get your connection string from the Connect section
6. Create a .env file in your project root with:

\`\`\`
VITE_MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
VITE_MONGODB_DB=admin_dashboard
\`\`\`

Replace <username>, <password>, <cluster>, and <dbname> with your actual values.
`;
