import dotenv from "dotenv";
dotenv.config();

export const CASHFREE_CONFIG = {
  clientId: process.env.CASHFREE_CLIENT_ID || "TEST10384883f3db3e6189569dc9ce238848301",
  clientSecret: process.env.CASHFREE_CLIENT_SECRET || "cfsk_ma_test_0e334df7718eeb83cb8f21e05ea8d3b7_1333d45e",
  environment: (process.env.CASHFREE_ENV || "SANDBOX").toUpperCase(),
  apiVersion: process.env.CASHFREE_API_VERSION || "2023-08-01",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  get baseUrl() {
    return this.environment === "PRODUCTION"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";
  },
};

export default CASHFREE_CONFIG;
