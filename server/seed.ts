import bcrypt from "bcryptjs";
import { storage } from "./storage";
import "./db"; // Initialize database connection

async function seed() {
  try {
    console.log("🌱 Starting database seed...");
    
    // Create a test user
    const testEmail = "test@picscripter.com";
    const testPassword = "testpassword123";
    
    // Check if test user already exists
    const existing = await storage.getUserByEmail(testEmail);
    
    if (existing) {
      console.log("✅ Test user already exists:");
      console.log(`   Email: ${testEmail}`);
      console.log(`   User ID: ${existing.id}`);
      console.log("\n💡 Use these credentials to log in:");
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: ${testPassword}`);
      return;
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(testPassword, 10);
    
    // Create user
    const user = await storage.createUser({
      email: testEmail,
      passwordHash,
    });
    
    console.log("✅ Test user created successfully!");
    console.log(`   Email: ${testEmail}`);
    console.log(`   User ID: ${user.id}`);
    console.log("\n💡 Use these credentials to log in:");
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log("\n📝 Next steps:");
    console.log("   1. Start the application: npm run dev");
    console.log("   2. Log in with the credentials above");
    console.log("   3. Connect your social media accounts");
    console.log("   4. Start posting!");
    
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
