const db = require('../backend/config/db');
const fs = require('fs');

(async () => {
  const [fks] = await db.query(`
    SELECT 
      kcu.TABLE_NAME, 
      kcu.COLUMN_NAME, 
      kcu.CONSTRAINT_NAME, 
      kcu.REFERENCED_TABLE_NAME, 
      kcu.REFERENCED_COLUMN_NAME,
      rc.UPDATE_RULE,
      rc.DELETE_RULE
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
      ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
    WHERE kcu.TABLE_SCHEMA = 'rentiq' AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME
  `);

  const [indexes] = await db.query(`
    SELECT 
      TABLE_NAME, 
      INDEX_NAME, 
      NON_UNIQUE, 
      COLUMN_NAME, 
      SEQ_IN_INDEX,
      INDEX_TYPE
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = 'rentiq'
    ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
  `);

  console.log('FK count:', fks.length);
  console.log('Index count:', indexes.length);
  fs.writeFileSync('./scratch/db_fks_and_indexes.json', JSON.stringify({ fks, indexes }, null, 2));
  process.exit(0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
