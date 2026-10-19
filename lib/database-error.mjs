export function databaseErrorCode(error) {
  let current = error;
  for (let depth = 0; current && typeof current === 'object' && depth < 5; depth++) {
    if (typeof current.code === 'string') return current.code;
    current = current.cause;
  }
  return 'DATABASE_ERROR';
}

export function databaseFailure(error) {
  const code = databaseErrorCode(error);
  if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code)) {
    return { error: 'The database is busy. Please try again.', errorCode: 'DATABASE_BUSY' };
  }
  if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(code)) {
    return { error: 'The database tables need to be set up or updated before you can continue. Ask your administrator to run database setup.', errorCode: 'DATABASE_SETUP_REQUIRED' };
  }
  if (['ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR'].includes(code)) {
    return { error: 'Database access was denied. Ask your administrator to check the database username, password and permissions.', errorCode: 'DATABASE_ACCESS_DENIED' };
  }
  return { error: 'The server cannot reach the attendance database. Check the database connection settings and make sure MySQL and any private connection to your laptop are online.', errorCode: 'DATABASE_UNAVAILABLE' };
}
