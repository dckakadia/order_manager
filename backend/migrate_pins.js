#!/usr/bin/env node

/**
 * IMPORTANT: PIN Migration Script
 * 
 * This script migrates existing plain-text PINs to bcrypt hashed PINs
 * Run this ONCE after updating to the new code
 * 
 * Usage: node migrate_pins.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

async function migratePins() {
  try {
    console.log('Starting PIN migration to bcrypt...');
    
    // Get all users
    const users = await prisma.user.findMany();
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const user of users) {
      // Check if PIN is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
      if (user.pin && user.pin.startsWith('$2')) {
        console.log(`✓ User "${user.username}" - PIN already hashed, skipping`);
        skippedCount++;
        continue;
      }
      
      if (!user.pin) {
        console.warn(`⚠️  User "${user.username}" - No PIN found, skipping`);
        skippedCount++;
        continue;
      }
      
      // Hash the plain-text PIN
      const hashedPin = await bcrypt.hash(user.pin, 10);
      
      // Update user with hashed PIN
      await prisma.user.update({
        where: { id: user.id },
        data: { pin: hashedPin }
      });
      
      console.log(`✓ User "${user.username}" - PIN migrated to bcrypt hash`);
      migratedCount++;
    }
    
    console.log(`\n✅ Migration complete!`);
    console.log(`   - Migrated: ${migratedCount} users`);
    console.log(`   - Skipped: ${skippedCount} users`);
    console.log(`\n⚠️  Users can continue to login with their existing PINs.`);
    console.log(`    The PINs are now securely hashed in the database.\n`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migratePins();
