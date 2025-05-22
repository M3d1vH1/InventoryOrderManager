const fs = require('fs');
const path = require('path');

// Function to check for access patterns around 1 AM
function analyzeAccessPatterns() {
  console.log('Analyzing server access patterns...');
  
  // Define log locations to search
  const possibleLogLocations = [
    './server/logs',
    './logs',
    './.data/logs',
    './temp'
  ];
  
  // Access patterns to search for
  const patterns = [
    /\[(\d{2}):(\d{2}):(\d{2}) [AP]M\] \[express\] GET/i,
    /\[(\d{2}):(\d{2}):(\d{2}) [AP]M\] \[express\] POST/i,
    /\[(\d{1,2}):00:(\d{2}) [AP]M\]/i,  // Exactly at 1:00 AM pattern
    /01:(\d{2}):(\d{2})/i,              // 24-hour format for 1 AM
    /1:(\d{2}):(\d{2}) AM/i             // 12-hour format for 1 AM
  ];

  let logFilesFound = false;
  let accessFound = false;
  
  // Search each possible log location
  for (const logPath of possibleLogLocations) {
    if (!fs.existsSync(logPath)) continue;
    
    const files = fs.readdirSync(logPath);
    for (const file of files) {
      if (!file.endsWith('.log') && !file.includes('access')) continue;
      
      logFilesFound = true;
      const filePath = path.join(logPath, file);
      console.log(`Checking log file: ${filePath}`);
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // Process each line looking for access patterns around 1 AM
        const matchingLines = lines.filter(line => 
          patterns.some(pattern => pattern.test(line))
        );
        
        if (matchingLines.length > 0) {
          accessFound = true;
          console.log(`Found ${matchingLines.length} matching access patterns in ${file}:`);
          matchingLines.forEach(line => console.log(`- ${line}`));
        }
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
      }
    }
  }
  
  // Check active connections in the database log
  try {
    const files = fs.readdirSync('./server');
    const dbLogFiles = files.filter(f => f.includes('db') && f.endsWith('.log'));
    
    for (const dbFile of dbLogFiles) {
      logFilesFound = true;
      const dbFilePath = path.join('./server', dbFile);
      console.log(`Checking database log: ${dbFilePath}`);
      
      const content = fs.readFileSync(dbFilePath, 'utf8');
      const dbAccessPatterns = [
        /connection at 01:/i,
        /connection at 1:.* AM/i,
        /active connections: (\d+)/i
      ];
      
      const dbMatchingLines = content.split('\n').filter(line => 
        dbAccessPatterns.some(pattern => pattern.test(line))
      );
      
      if (dbMatchingLines.length > 0) {
        accessFound = true;
        console.log(`Found ${dbMatchingLines.length} database connection patterns at 1 AM:`);
        dbMatchingLines.forEach(line => console.log(`- ${line}`));
      }
    }
  } catch (error) {
    console.error('Error checking database logs:', error.message);
  }
  
  // If no logs were found, check memory usage from process reports
  if (!logFilesFound) {
    console.log('No log files found in expected locations. Checking process reports...');
    
    try {
      if (fs.existsSync('./temp')) {
        const tempFiles = fs.readdirSync('./temp');
        const reportFiles = tempFiles.filter(f => f.includes('report') || f.includes('stats'));
        
        for (const reportFile of reportFiles) {
          const reportPath = path.join('./temp', reportFile);
          console.log(`Checking report file: ${reportPath}`);
          
          const content = fs.readFileSync(reportPath, 'utf8');
          if (content.includes('01:') || content.includes('1:00 AM')) {
            console.log(`Found potential 1 AM activity in report file ${reportFile}`);
            console.log(content);
            accessFound = true;
          }
        }
      }
    } catch (error) {
      console.error('Error checking process reports:', error.message);
    }
  }
  
  if (!logFilesFound) {
    console.log('No log files or process reports found. Unable to determine access patterns at 1 AM.');
  } else if (!accessFound) {
    console.log('Log files found, but no access patterns detected at 1 AM.');
  }
}

analyzeAccessPatterns();