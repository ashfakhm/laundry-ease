/**
 * Script to manually create an admin user in the database
 * Run with: npx tsx scripts/create-admin.ts
 */

import { createAdmin } from "../lib/db";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log("=== Create Admin User ===\n");

  const email = await question("Admin email: ");
  const name = await question("Admin name: ");
  const password = await question("Admin password: ");

  if (!email || !name || !password) {
    console.error("All fields are required!");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters!");
    process.exit(1);
  }

  try {
    const admin = await createAdmin({ email, name, password });
    console.log("\n✅ Admin user created successfully!");
    console.log("Email:", admin.email);
    console.log("Name:", admin.name);
    console.log("ID:", admin._id?.toString());
  } catch (error) {
    console.error("\n❌ Failed to create admin:", error);
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
