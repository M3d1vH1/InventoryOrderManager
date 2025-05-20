import bcrypt from 'bcryptjs';
import pg from 'pg';
const { Pool } = pg;

// Create a connection to your database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function resetAdminPassword() {
  try {
    console.log('===== Resetting Admin Password =====');
    
    // Connect to database
    const client = await pool.connect();
    
    // New password to set
    const newPassword = 'newabc123';
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the admin user's password
    const updateQuery = `
      UPDATE users 
      SET password = $1
      WHERE role = 'admin'
      RETURNING id, username, email
    `;
    
    const result = await client.query(updateQuery, [hashedPassword]);
    
    if (result.rows.length > 0) {
      console.log('\nAdmin password reset successfully:');
      console.log(`Username: ${result.rows[0].username}`);
      console.log(`Email: ${result.rows[0].email}`);
      console.log(`Password: Reset to "${newPassword}"`);
    } else {
      console.log('No admin user found!');
    }
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error resetting admin password:', error);
  }
}

// Run the script
resetAdminPassword();