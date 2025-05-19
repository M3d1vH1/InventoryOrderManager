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
    
    const newPassword = 'Rekt1943.';
    
    // Connect to database
    const client = await pool.connect();
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the admin user's password
    const updateQuery = `
      UPDATE users 
      SET password = $1
      WHERE role = 'admin'
      RETURNING id, username, email, role
    `;
    
    const result = await client.query(updateQuery, [hashedPassword]);
    
    if (result.rows.length > 0) {
      console.log('\nAdmin password updated successfully:');
      console.log(`Username: ${result.rows[0].username}`);
      console.log(`Email: ${result.rows[0].email}`);
      console.log(`New password has been set to: ${newPassword}`);
    } else {
      console.log('No admin user found!');
    }
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error updating admin password:', error);
  }
}

// Run the script
resetAdminPassword();