import { db } from "../db";
import { connections, ecommerceConnections } from "../../shared/schema";
import { encryptToken, decryptToken, getTokenKeyId, getCurrentKeyId } from "../utils/encryption";

async function rotateEncryptionKeys() {
  console.log("🔄 Starting encryption key rotation...\n");

  const currentKid = getCurrentKeyId();
  console.log(`Current key ID: ${currentKid}\n`);

  let rotatedConnections = 0;
  let rotatedEcommerceConnections = 0;
  let skippedConnections = 0;
  let skippedEcommerceConnections = 0;
  let errors = 0;

  try {
    console.log("📱 Processing social media connections...");
    const allConnections = await db.select().from(connections);
    
    for (const conn of allConnections) {
      try {
        const accessTokenKid = getTokenKeyId(conn.accessTokenEnc);
        const refreshTokenKid = conn.refreshTokenEnc ? getTokenKeyId(conn.refreshTokenEnc) : null;

        // Skip if already using current key
        if (accessTokenKid === currentKid && (!refreshTokenKid || refreshTokenKid === currentKid)) {
          skippedConnections++;
          continue;
        }

        console.log(`  Re-encrypting ${conn.platform} connection (${conn.id}): ${accessTokenKid} → ${currentKid}`);

        // Decrypt with old key, encrypt with new key
        const accessToken = decryptToken(conn.accessTokenEnc);
        const newAccessTokenEnc = encryptToken(accessToken, currentKid);

        let newRefreshTokenEnc = conn.refreshTokenEnc;
        if (conn.refreshTokenEnc) {
          const refreshToken = decryptToken(conn.refreshTokenEnc);
          newRefreshTokenEnc = encryptToken(refreshToken, currentKid);
        }

        await db
          .update(connections)
          .set({
            accessTokenEnc: newAccessTokenEnc,
            refreshTokenEnc: newRefreshTokenEnc,
            updatedAt: new Date(),
          })
          .where(eq(connections.id, conn.id));

        rotatedConnections++;
      } catch (error: any) {
        console.error(`  ❌ Error rotating connection ${conn.id}: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n🛒 Processing e-commerce connections...`);
    const allEcommerceConnections = await db.select().from(ecommerceConnections);
    
    for (const conn of allEcommerceConnections) {
      try {
        const accessTokenKid = getTokenKeyId(conn.accessTokenEnc);
        const refreshTokenKid = conn.refreshTokenEnc ? getTokenKeyId(conn.refreshTokenEnc) : null;

        // Skip if already using current key
        if (accessTokenKid === currentKid && (!refreshTokenKid || refreshTokenKid === currentKid)) {
          skippedEcommerceConnections++;
          continue;
        }

        console.log(`  Re-encrypting ${conn.platform} connection (${conn.id}): ${accessTokenKid} → ${currentKid}`);

        // Decrypt with old key, encrypt with new key
        const accessToken = decryptToken(conn.accessTokenEnc);
        const newAccessTokenEnc = encryptToken(accessToken, currentKid);

        let newRefreshTokenEnc = conn.refreshTokenEnc;
        if (conn.refreshTokenEnc) {
          const refreshToken = decryptToken(conn.refreshTokenEnc);
          newRefreshTokenEnc = encryptToken(refreshToken, currentKid);
        }

        await db
          .update(ecommerceConnections)
          .set({
            accessTokenEnc: newAccessTokenEnc,
            refreshTokenEnc: newRefreshTokenEnc,
            updatedAt: new Date(),
          })
          .where(eq(ecommerceConnections.id, conn.id));

        rotatedEcommerceConnections++;
      } catch (error: any) {
        console.error(`  ❌ Error rotating e-commerce connection ${conn.id}: ${error.message}`);
        errors++;
      }
    }

    console.log("\n✅ Encryption key rotation complete!\n");
    console.log("Summary:");
    console.log(`  Social media connections rotated: ${rotatedConnections}`);
    console.log(`  Social media connections skipped: ${skippedConnections} (already using current key)`);
    console.log(`  E-commerce connections rotated: ${rotatedEcommerceConnections}`);
    console.log(`  E-commerce connections skipped: ${skippedEcommerceConnections} (already using current key)`);
    console.log(`  Total rotated: ${rotatedConnections + rotatedEcommerceConnections}`);
    console.log(`  Total skipped: ${skippedConnections + skippedEcommerceConnections}`);
    console.log(`  Errors: ${errors}`);

    if (errors > 0) {
      console.error("\n⚠️  Some connections failed to rotate. Please review errors above.");
      process.exit(1);
    }

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Fatal error during key rotation:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Import eq from drizzle-orm
import { eq } from "drizzle-orm";

// Run the rotation
rotateEncryptionKeys();
