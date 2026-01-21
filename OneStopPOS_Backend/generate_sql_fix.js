const bcrypt = require('bcryptjs');

async function generateFix() {
    const password = 'userA123';
    const hash = await bcrypt.hash(password, 10);
    
    console.log('\nCopy and run this SQL command in your Render Database to fix the password:');
    console.log('---------------------------------------------------------------------');
    console.log(`UPDATE users SET password = '${hash}' WHERE username = 'userA';`);
    console.log('---------------------------------------------------------------------');
}

generateFix();

