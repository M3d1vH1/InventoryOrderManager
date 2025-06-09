import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import { users } from './shared/schema.js';

async function createWarehouseUser() {
  try {
    // Connect to the database
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('newabc123', 10);
    
    // Create the warehouse user
    const newUser = {
      username: 'warehouse',
      password: hashedPassword,
      fullName: 'Warehouse User',
      role: 'warehouse',
      email: null,
      active: true
    };
    
    // Insert the user into the database
    const [createdUser] = await db.insert(users).values(newUser).returning();
    
    console.log('✓ Warehouse user created successfully:');
    console.log(`  Username: ${createdUser.username}`);
    console.log(`  Full Name: ${createdUser.fullName}`);
    console.log(`  Role: ${createdUser.role}`);
    console.log(`  ID: ${createdUser.id}`);
    console.log(`  Created: ${createdUser.createdAt}`);
    console.log('');
    console.log('Login credentials:');
    console.log('  Username: warehouse');
    console.log('  Password: newabc123');
    
  } catch (error) {
    console.error('Error creating warehouse user:', error);
    process.exit(1);
  }
}

createWarehouseUser();