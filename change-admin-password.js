import bcrypt from 'bcryptjs';
import pg from 'pg';
import readline from 'readline';
const { Pool } = pg;

// Create a connection to your database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function changeAdminCredentials() {
  try {
    console.log('===== Change Admin Credentials =====');
    
    // Get current admin info
    console.log('\nCurrent admin information:');
    const client = await pool.connect();
    const currentAdmin = await client.query('SELECT username, email FROM users WHERE role = \'admin\'');
    
    if (currentAdmin.rows.length > 0) {
      console.log(`Username: ${currentAdmin.rows[0].username}`);
      console.log(`Email: ${currentAdmin.rows[0].email}`);
    } else {
      console.log('No admin user found!');
      client.release();
      await pool.end();
      rl.close();
      return;
    }
    
    // Get new credentials
    console.log('\nEnter new admin credentials (leave blank to keep current value):');
    const newUsername = await askQuestion('New username: ');
    const newPassword = await askQuestion('New password: ');
    const newEmail = await askQuestion('New email: ');
    
    // Use current values if new ones aren't provided
    const username = newUsername.trim() || currentAdmin.rows[0].username;
    const email = newEmail.trim() || currentAdmin.rows[0].email;
    
    // Update the database
    if (newPassword.trim()) {
      // If password was changed, hash it and update all fields
      const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
      const updateQuery = `
        UPDATE users 
        SET username = $1, password = $2, email = $3
        WHERE role = 'admin'
        RETURNING id, username, email, role
      `;
      const result = await client.query(updateQuery, [username, hashedPassword, email]);
      console.log('\nAdmin credentials updated successfully:');
      console.log(`Username: ${result.rows[0].username}`);
      console.log(`Email: ${result.rows[0].email}`);
      console.log(`Password: Updated to your new password`);
    } else {
      // If password wasn't changed, update only username and email
      const updateQuery = `
        UPDATE users 
        SET username = $1, email = $2
        WHERE role = 'admin'
        RETURNING id, username, email, role
      `;
      const result = await client.query(updateQuery, [username, email]);
      console.log('\nAdmin credentials updated successfully:');
      console.log(`Username: ${result.rows[0].username}`);
      console.log(`Email: ${result.rows[0].email}`);
      console.log('Password: Unchanged');
    }
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error updating admin credentials:', error);
  } finally {
    rl.close();
  }
}

// Run the script
changeAdminCredentials();